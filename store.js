'use strict';
/* Слюда — хранилище.
   Два вида хранилища с одним интерфейсом:
     BrowserVault — IndexedDB этого браузера (работает везде, включая телефон);
     FolderVault  — настоящая папка на диске через File System Access API (Chrome/Edge на компьютере).
   Пути относительные, через «/», без ведущего слэша: "Папка/Заметка.md".
   Интерфейс: scan() → [{path, type, mtime, text?}], read(path), write(path, data) → mtime,
              mkdir(path), remove(path), rename(from, to). */

const IMG_EXT = ['png', 'jpg', 'jpeg', 'gif', 'webp', 'svg', 'bmp', 'avif'];

function extOf(path){ const m = /\.([^./]+)$/.exec(path); return m ? m[1].toLowerCase() : ''; }
function typeOf(path){
  const e = extOf(path);
  if(e === 'md') return 'md';
  if(IMG_EXT.indexOf(e) >= 0) return 'img';
  return null;
}
function parentOf(path){ const i = path.lastIndexOf('/'); return i < 0 ? '' : path.slice(0, i); }
function baseOf(path){ return path.slice(path.lastIndexOf('/') + 1); }
function joinPath(dir, name){ return dir ? dir + '/' + name : name; }
function under(path, dir){ return path === dir || path.indexOf(dir + '/') === 0; }

/* ---------- IndexedDB ---------- */
const DB_NAME = 'sluda', DB_VER = 1;
let _db = null;
function idb(){
  if(_db) return Promise.resolve(_db);
  return new Promise((res, rej) => {
    const r = indexedDB.open(DB_NAME, DB_VER);
    r.onupgradeneeded = () => {
      const db = r.result;
      if(!db.objectStoreNames.contains('files')) db.createObjectStore('files', {keyPath: 'path'});
      if(!db.objectStoreNames.contains('meta')) db.createObjectStore('meta');
    };
    r.onsuccess = () => { _db = r.result; res(_db); };
    r.onerror = () => rej(r.error);
  });
}
function rq(r){ return new Promise((res, rej) => { r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error); }); }
function txDone(t){ return new Promise((res, rej) => { t.oncomplete = () => res(); t.onerror = () => rej(t.error); t.onabort = () => rej(t.error); }); }

const meta = {
  async get(k){ const db = await idb(); return rq(db.transaction('meta').objectStore('meta').get(k)); },
  async set(k, v){ const db = await idb(); return rq(db.transaction('meta', 'readwrite').objectStore('meta').put(v, k)); },
  async del(k){ const db = await idb(); return rq(db.transaction('meta', 'readwrite').objectStore('meta').delete(k)); },
};

/* ---------- хранилище в браузере ---------- */
class BrowserVault {
  constructor(){ this.kind = 'browser'; this.name = 'В браузере'; }

  async scan(){
    const db = await idb();
    const all = await rq(db.transaction('files').objectStore('files').getAll());
    return all.map(r => ({path: r.path, type: r.type, mtime: r.mtime, text: r.type === 'md' ? r.data : undefined}));
  }
  async isEmpty(){
    const db = await idb();
    return (await rq(db.transaction('files').objectStore('files').count())) === 0;
  }
  async read(path){
    const db = await idb();
    const r = await rq(db.transaction('files').objectStore('files').get(path));
    if(!r) throw new Error('Нет файла: ' + path);
    return r.data;
  }
  async write(path, data){
    const db = await idb();
    const t = db.transaction('files', 'readwrite');
    const mtime = Date.now();
    t.objectStore('files').put({path, type: typeOf(path) || 'md', data, mtime});
    await txDone(t);
    return mtime;
  }
  async mkdir(path){
    const db = await idb();
    const t = db.transaction('files', 'readwrite');
    t.objectStore('files').put({path, type: 'dir', data: null, mtime: Date.now()});
    await txDone(t);
  }
  async remove(path){
    const db = await idb();
    const t = db.transaction('files', 'readwrite');
    const s = t.objectStore('files');
    const keys = await rq(s.getAllKeys());
    for(const k of keys) if(under(k, path)) s.delete(k);
    await txDone(t);
  }
  async rename(from, to){
    const db = await idb();
    const t = db.transaction('files', 'readwrite');
    const s = t.objectStore('files');
    const all = await rq(s.getAll());
    for(const r of all){
      if(!under(r.path, from)) continue;
      const np = to + r.path.slice(from.length);
      s.delete(r.path);
      s.put(Object.assign({}, r, {path: np, type: r.type === 'dir' ? 'dir' : (typeOf(np) || r.type)}));
    }
    await txDone(t);
  }
}

/* ---------- папка на диске ---------- */
const FS_SUPPORTED = typeof window !== 'undefined' && typeof window.showDirectoryPicker === 'function';

async function fsPermission(handle, ask){
  const opts = {mode: 'readwrite'};
  if((await handle.queryPermission(opts)) === 'granted') return true;
  if(!ask) return false;
  return (await handle.requestPermission(opts)) === 'granted';
}

class FolderVault {
  constructor(handle){ this.kind = 'folder'; this.handle = handle; this.name = handle.name; }

  async _dir(path, create){
    let h = this.handle;
    if(!path) return h;
    for(const part of path.split('/')) h = await h.getDirectoryHandle(part, {create: !!create});
    return h;
  }
  async _file(path, create){
    const dir = await this._dir(parentOf(path), create);
    return dir.getFileHandle(baseOf(path), {create: !!create});
  }

  /* обход: служебные папки (.obsidian, .git, .trash) пропускаем — их не трогаем никогда */
  async _walk(dirHandle, prefix, out, withText){
    const jobs = [];
    for await (const [name, h] of dirHandle.entries()){
      if(name.charAt(0) === '.') continue;
      const path = joinPath(prefix, name);
      if(h.kind === 'directory'){
        out.push({path, type: 'dir', mtime: 0});
        jobs.push(this._walk(h, path, out, withText));
      } else {
        const type = typeOf(name);
        if(!type) continue;
        jobs.push(h.getFile().then(async f => {
          const rec = {path, type, mtime: f.lastModified};
          if(type === 'md' && withText) rec.text = await f.text();
          out.push(rec);
        }));
      }
    }
    await Promise.all(jobs);
    return out;
  }
  scan(){ return this._walk(this.handle, '', [], true); }
  /* быстрый обход без чтения текста — чтобы найти изменения снаружи */
  stat(){ return this._walk(this.handle, '', [], false); }

  async read(path){
    const f = await (await this._file(path)).getFile();
    return typeOf(path) === 'md' ? f.text() : f;
  }
  async write(path, data){
    const fh = await this._file(path, true);
    const w = await fh.createWritable();
    await w.write(data);
    await w.close();
    return (await fh.getFile()).lastModified;
  }
  async mkdir(path){ await this._dir(path, true); }
  async remove(path){
    const dir = await this._dir(parentOf(path));
    await dir.removeEntry(baseOf(path), {recursive: true});
  }
  async rename(from, to){
    /* переносим копированием: move() есть не во всех браузерах */
    let isDir = false;
    try { await this._dir(from); isDir = true; } catch(e){ isDir = false; }
    if(!isDir){
      await this.write(to, await this.read(from));
    } else {
      await this.mkdir(to);
      const items = await this._walk(await this._dir(from), '', [], false);
      for(const it of items){
        if(it.type === 'dir') await this.mkdir(joinPath(to, it.path));
        else await this.write(joinPath(to, it.path), await this.read(joinPath(from, it.path)));
      }
    }
    await this.remove(from);
  }
}

/* ---------- zip без сжатия: экспорт хранилища одним файлом ---------- */
const CRC_TABLE = (() => {
  const t = new Uint32Array(256);
  for(let n = 0; n < 256; n++){
    let c = n;
    for(let k = 0; k < 8; k++) c = c & 1 ? 0xEDB88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c >>> 0;
  }
  return t;
})();
function crc32(u8){
  let c = 0xFFFFFFFF;
  for(let i = 0; i < u8.length; i++) c = CRC_TABLE[(c ^ u8[i]) & 0xFF] ^ (c >>> 8);
  return (c ^ 0xFFFFFFFF) >>> 0;
}
async function makeZip(entries){
  const enc = new TextEncoder();
  const parts = [], central = [];
  let offset = 0;
  const d = new Date();
  const time = (d.getHours() << 11) | (d.getMinutes() << 5) | (d.getSeconds() >> 1);
  const date = ((d.getFullYear() - 1980) << 9) | ((d.getMonth() + 1) << 5) | d.getDate();
  for(const e of entries){
    const name = enc.encode(e.path);
    const data = typeof e.data === 'string' ? enc.encode(e.data) : new Uint8Array(await e.data.arrayBuffer());
    const crc = crc32(data);
    const lh = new DataView(new ArrayBuffer(30));
    lh.setUint32(0, 0x04034b50, true); lh.setUint16(4, 20, true); lh.setUint16(6, 0x0800, true);
    lh.setUint16(10, time, true); lh.setUint16(12, date, true); lh.setUint32(14, crc, true);
    lh.setUint32(18, data.length, true); lh.setUint32(22, data.length, true); lh.setUint16(26, name.length, true);
    parts.push(lh.buffer, name, data);
    const ch = new DataView(new ArrayBuffer(46));
    ch.setUint32(0, 0x02014b50, true); ch.setUint16(4, 20, true); ch.setUint16(6, 20, true); ch.setUint16(8, 0x0800, true);
    ch.setUint16(12, time, true); ch.setUint16(14, date, true); ch.setUint32(16, crc, true);
    ch.setUint32(20, data.length, true); ch.setUint32(24, data.length, true); ch.setUint16(28, name.length, true);
    ch.setUint32(42, offset, true);
    central.push(ch.buffer, name);
    offset += 30 + name.length + data.length;
  }
  const cdSize = central.reduce((a, b) => a + b.byteLength, 0);
  const end = new DataView(new ArrayBuffer(22));
  end.setUint32(0, 0x06054b50, true); end.setUint16(8, entries.length, true); end.setUint16(10, entries.length, true);
  end.setUint32(12, cdSize, true); end.setUint32(16, offset, true);
  return new Blob(parts.concat(central, [end.buffer]), {type: 'application/zip'});
}
