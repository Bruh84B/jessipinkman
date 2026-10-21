'use strict';
/* MindButter — синхронизация через GitHub.
   Заметки лежат в приватном репозитории пользователя; каждое устройство отправляет туда свои изменения
   и забирает чужие. Доступ — токен GitHub (fine-grained: только этот репозиторий, Contents: read/write),
   хранится только в этом браузере.
   Схема трёх состояний: «база» (каким файл был при прошлой синхронизации), локальное и удалённое.
   Сравниваются git-хеши, поэтому скачиваются и отправляются только изменённые файлы.
   Если файл изменили и здесь, и там — удалённая версия остаётся на месте, а здешняя сохраняется рядом
   копией «(конфликт, устройство дата)». Ничего не теряется. */

/* ---------- git-хеш файла (sha1 от «blob <длина>\0<байты>») ---------- */
const UTF8 = new TextEncoder();
function sha1js(bytes){
  /* запасной SHA-1 для страниц без crypto.subtle (например, http по локальной сети) */
  const l = bytes.length, words = new Uint32Array(((l + 8 >> 6) + 1) * 16);
  for(let i = 0; i < l; i++) words[i >> 2] |= bytes[i] << (24 - (i % 4) * 8);
  words[l >> 2] |= 0x80 << (24 - (l % 4) * 8);
  words[words.length - 1] = l * 8;
  let a = 0x67452301, b = 0xEFCDAB89, c = 0x98BADCFE, d = 0x10325476, e = 0xC3D2E1F0;
  const w = new Uint32Array(80);
  for(let i = 0; i < words.length; i += 16){
    for(let t = 0; t < 80; t++){
      w[t] = t < 16 ? words[i + t] : ((x) => (x << 1) | (x >>> 31))(w[t - 3] ^ w[t - 8] ^ w[t - 14] ^ w[t - 16]);
    }
    let A = a, B = b, C = c, D = d, E = e;
    for(let t = 0; t < 80; t++){
      const f = t < 20 ? (B & C) | (~B & D) : t < 40 ? B ^ C ^ D : t < 60 ? (B & C) | (B & D) | (C & D) : B ^ C ^ D;
      const k = t < 20 ? 0x5A827999 : t < 40 ? 0x6ED9EBA1 : t < 60 ? 0x8F1BBCDC : 0xCA62C1D6;
      const tmp = (((A << 5) | (A >>> 27)) + f + E + k + w[t]) >>> 0;
      E = D; D = C; C = (B << 30) | (B >>> 2); B = A; A = tmp;
    }
    a = (a + A) >>> 0; b = (b + B) >>> 0; c = (c + C) >>> 0; d = (d + D) >>> 0; e = (e + E) >>> 0;
  }
  return [a, b, c, d, e].map(x => (x >>> 0).toString(16).padStart(8, '0')).join('');
}
async function gitSha(bytes){
  const head = UTF8.encode('blob ' + bytes.length + '\0');
  const all = new Uint8Array(head.length + bytes.length);
  all.set(head); all.set(bytes, head.length);
  if(window.crypto && crypto.subtle){
    try {
      const h = await crypto.subtle.digest('SHA-1', all);
      return Array.from(new Uint8Array(h), x => x.toString(16).padStart(2, '0')).join('');
    } catch(e){ /* ниже — запасной вариант */ }
  }
  return sha1js(all);
}
function toB64(bytes){
  let s = '';
  for(let i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode.apply(null, bytes.subarray(i, i + 0x8000));
  return btoa(s);
}
function fromB64(s){
  const bin = atob(String(s).replace(/\s/g, ''));
  const out = new Uint8Array(bin.length);
  for(let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}
const MIME = {png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg', gif: 'image/gif', webp: 'image/webp', svg: 'image/svg+xml', bmp: 'image/bmp', avif: 'image/avif'};

class SyncError extends Error {
  constructor(msg, kind){ super(msg); this.kind = kind || 'error'; }
}

const GHSync = {
  state: 'off',          /* off | idle | sync | ok | offline | error */
  message: '',
  lastAt: 0,
  running: false, again: false, timer: 0,
  shaCache: new Map(),   /* path → {mtime, sha} */

  api(){ return window.MB_GH_API || 'https://api.github.com'; },
  cfg(){ const c = LS.get('gh', null); return c && c.repo && c.token ? c : null; },
  enabled(){ return !window.SLUDA_DEMO && !!this.cfg() && !!S.vault; },
  stateKey(){ const c = this.cfg(); return 'ghsync:' + vaultKey() + ':' + (c ? c.repo.toLowerCase() : ''); },
  device(){
    const ua = navigator.userAgent || '';
    return /iPhone|Android.*Mobile|Mobile Safari/i.test(ua) ? 'телефон' : /iPad|Tablet|Android/i.test(ua) ? 'планшет' : 'компьютер';
  },

  async req(method, path, body){
    const c = this.cfg();
    let res;
    try {
      res = await fetch(this.api() + path, {
        method, cache: 'no-store',
        headers: Object.assign({
          'Authorization': 'Bearer ' + c.token,
          'Accept': 'application/vnd.github+json',
          'X-GitHub-Api-Version': '2022-11-28',
        }, body ? {'Content-Type': 'application/json'} : {}),
        body: body ? JSON.stringify(body) : undefined,
      });
    } catch(e){
      throw new SyncError('Нет связи с GitHub — синхронизирую, когда появится сеть.', 'offline');
    }
    let data = null;
    try { data = await res.json(); } catch(e){ data = null; }
    if(!res.ok){
      const m = (data && data.message) || '';
      const err = new SyncError(m || ('HTTP ' + res.status), 'error');
      err.status = res.status;
      throw err;
    }
    return data;
  },
  explain(e){
    if(e.kind === 'offline' || !e.status) return e.message;
    if(e.status === 401) return 'Токен не подходит: проверь, что скопирован целиком и не истёк срок.';
    if(e.status === 404) return 'Репозиторий не найден или токен не даёт к нему доступа. Проверь название и что токену выбран этот репозиторий.';
    if(e.status === 403) return /rate limit/i.test(e.message) ? 'GitHub временно ограничил запросы. Попробую позже.' : 'Токену не хватает прав. Нужно Contents: Read and write для этого репозитория.';
    return 'Ошибка GitHub: ' + e.message;
  },

  /* ---------- удалённое состояние ---------- */
  async remote(){
    const c = this.cfg();
    const repo = await this.req('GET', '/repos/' + c.repo);
    if(!repo.private) throw new SyncError('Репозиторий публичный — заметки увидят все. Сделай его приватным: Settings → Danger Zone → Change visibility.', 'error');
    const branch = repo.default_branch || 'main';
    let ref;
    try { ref = await this.req('GET', '/repos/' + c.repo + '/git/ref/heads/' + encodeURIComponent(branch)); }
    catch(e){
      if(e.status !== 409 && e.status !== 404) throw e;
      /* пустой репозиторий: первый коммит делаем через Contents API, иначе Git API не работает */
      await this.req('PUT', '/repos/' + c.repo + '/contents/.mindbutter.json', {
        message: 'MindButter: начало синхронизации',
        content: toB64(UTF8.encode(JSON.stringify({app: 'MindButter', note: 'Заметки синхронизирует приложение MindButter.'}, null, 2) + '\n')),
        branch,
      });
      ref = await this.req('GET', '/repos/' + c.repo + '/git/ref/heads/' + encodeURIComponent(branch));
    }
    const head = ref.object.sha;
    const commit = await this.req('GET', '/repos/' + c.repo + '/git/commits/' + head);
    const tree = await this.req('GET', '/repos/' + c.repo + '/git/trees/' + commit.tree.sha + '?recursive=1');
    const files = {};
    for(const t of tree.tree || []) if(t.type === 'blob' && this.syncable(t.path)) files[t.path] = t.sha;
    return {branch, head, tree: commit.tree.sha, files};
  },
  syncable(path){ return !path.split('/').some(s => s.charAt(0) === '.') && !!typeOf(path); },

  /* ---------- локальное состояние ---------- */
  async bytesOf(path){
    const f = S.files.get(path);
    if(f.type === 'md') return UTF8.encode(f.text || '');
    const data = await S.vault.read(path);
    return new Uint8Array(await data.arrayBuffer());
  },
  async localSha(path){
    const f = S.files.get(path);
    const c = this.shaCache.get(path);
    if(c && c.mtime === f.mtime && (f.type !== 'md' || c.len === (f.text || '').length)) return c.sha;
    const sha = await gitSha(await this.bytesOf(path));
    this.shaCache.set(path, {mtime: f.mtime, len: f.type === 'md' ? (f.text || '').length : 0, sha});
    return sha;
  },
  async seedShas(){
    if(!this._seeds){
      this._seeds = {};
      for(const [p, t] of Object.entries(WELCOME)) this._seeds[p] = await gitSha(UTF8.encode(t));
    }
    return this._seeds;
  },
  async local(){
    const out = {};
    for(const [p, f] of S.files) if((f.type === 'md' || f.type === 'img') && this.syncable(p)) out[p] = await this.localSha(p);
    return out;
  },

  /* ---------- применить удалённое изменение здесь ---------- */
  async pull(path, sha){
    const c = this.cfg();
    const blob = await this.req('GET', '/repos/' + c.repo + '/git/blobs/' + sha);
    const bytes = fromB64(blob.content);
    const type = typeOf(path);
    const data = type === 'md' ? new TextDecoder('utf-8').decode(bytes) : new Blob([bytes], {type: MIME[extOf(path)] || 'application/octet-stream'});
    const mtime = await S.vault.write(path, data);
    addFileRec({path, type, mtime, text: type === 'md' ? data : undefined});
    this.shaCache.set(path, {mtime, len: type === 'md' ? data.length : 0, sha});
    if(path === S.cur && S.curType === 'md'){
      const ed = $('#editor'), s = ed.selectionStart;
      ed.value = data;
      ed.setSelectionRange(Math.min(s, data.length), Math.min(s, data.length));
      if(S.mode === 'read' && S.view === 'note') renderPreview();
    }
  },
  async dropLocal(path){
    await S.vault.remove(path);
    S.files.delete(path);
    this.shaCache.delete(path);
    if(path === S.cur){ S.cur = null; S.curType = null; showView('empty'); }
  },
  /* правят ли этот файл прямо сейчас — тогда не трогаем, разберёмся в следующий раз */
  async busy(path, snapSha){
    if(path === S.cur && S.dirty) return true;
    if(!S.files.has(path)) return snapSha !== undefined;
    return (await this.localSha(path)) !== snapSha;
  },
  conflictPath(path){
    const ext = '.' + extOf(path);
    const base = baseOf(path).slice(0, -ext.length);
    const d = new Date();
    const stamp = todayKey() + ' ' + String(d.getHours()).padStart(2, '0') + '-' + String(d.getMinutes()).padStart(2, '0');
    return uniquePath(parentOf(path), base + ' (конфликт, ' + this.device() + ' ' + stamp + ')', ext);
  },

  /* ---------- синхронизация ---------- */
  async sync(manual){
    if(!this.enabled()) return;
    if(this.running){ this.again = true; return; }
    this.running = true;
    clearTimeout(this.timer);
    this.set('sync');
    let pulled = 0, pushed = 0;
    const conflicts = [];
    try {
      let done = false;
      for(let attempt = 0; attempt < 3; attempt++){
        await flushSave();
        const stored = (await meta.get(this.stateKey())) || {files: {}};
        const base = Object.assign({}, stored.files);
        const remote = await this.remote();
        const local = await this.local();
        const paths = new Set(Object.keys(base).concat(Object.keys(local), Object.keys(remote.files)));
        /* нетронутые приветственные заметки нового устройства уступают версиям из репозитория:
           иначе каждая заметка, которую уже правили или удалили на другом устройстве, дала бы конфликт */
        /* но только если в репозитории уже есть заметки: в пустой репозиторий первое устройство отправляет всё */
        const seeds = await this.seedShas();
        const remoteHasNotes = Object.keys(remote.files).length > 0;
        for(const p of Object.keys(local)) if(!(p in base) && seeds[p] === local[p] && remoteHasNotes) base[p] = local[p];
        const adds = new Map();      /* path → bytes к отправке */
        const dels = new Set();
        let changedHere = false;

        for(const p of paths){
          const b = base[p], l = local[p], r = remote.files[p];
          if(l === r){ if(r) base[p] = r; else delete base[p]; continue; }
          if(l === b){
            /* здесь не меняли — берём удалённое */
            if(await this.busy(p, l)) continue;
            if(r){ await this.pull(p, r); base[p] = r; } else { await this.dropLocal(p); delete base[p]; }
            pulled++; changedHere = true;
          } else if(r === b){
            /* там не меняли — отправляем здешнее */
            if(l){ adds.set(p, await this.bytesOf(p)); } else dels.add(p);
          } else if(l && r){
            /* изменили и здесь, и там: здешнюю версию сохраняем копией, на место ставим удалённую */
            if(await this.busy(p, l)) continue;
            const mine = await this.bytesOf(p);
            const copy = this.conflictPath(p);
            const type = typeOf(p);
            const data = type === 'md' ? new TextDecoder('utf-8').decode(mine) : new Blob([mine], {type: MIME[extOf(p)] || 'application/octet-stream'});
            const mtime = await S.vault.write(copy, data);
            addFileRec({path: copy, type, mtime, text: type === 'md' ? data : undefined});
            await this.pull(p, r);
            base[p] = r;
            adds.set(copy, mine);
            conflicts.push({path: p, copy});
            pulled++; changedHere = true;
          } else if(r){
            /* здесь удалили, там изменили — возвращаем изменённую */
            await this.pull(p, r); base[p] = r; pulled++; changedHere = true;
          } else {
            /* там удалили, здесь изменили — отправляем заново */
            adds.set(p, await this.bytesOf(p));
          }
        }
        if(changedHere){ reindex(); refreshAll(); }
        await meta.set(this.stateKey(), {files: base, head: remote.head, at: Date.now()});

        if(!adds.size && !dels.size){ this.lastAt = Date.now(); done = true; break; }

        const c = this.cfg();
        const entries = [];
        for(const [p, bytes] of adds){
          const blob = await this.req('POST', '/repos/' + c.repo + '/git/blobs', {content: toB64(bytes), encoding: 'base64'});
          entries.push({path: p, mode: '100644', type: 'blob', sha: blob.sha});
        }
        for(const p of dels) entries.push({path: p, mode: '100644', type: 'blob', sha: null});
        const tree = await this.req('POST', '/repos/' + c.repo + '/git/trees', {base_tree: remote.tree, tree: entries});
        const n = adds.size + dels.size;
        const commit = await this.req('POST', '/repos/' + c.repo + '/git/commits', {
          message: 'MindButter (' + this.device() + '): ' + n + ' ' + plural(n, 'изменение', 'изменения', 'изменений'),
          tree: tree.sha, parents: [remote.head],
        });
        try {
          await this.req('PATCH', '/repos/' + c.repo + '/git/refs/heads/' + encodeURIComponent(remote.branch), {sha: commit.sha, force: false});
        } catch(e){
          /* пока мы собирали коммит, другое устройство успело отправить свой — начинаем заново */
          if(e.status === 422 || e.status === 409) continue;
          throw e;
        }
        for(const e of entries){ if(e.sha) base[e.path] = e.sha; else delete base[e.path]; }
        await meta.set(this.stateKey(), {files: base, head: commit.sha, at: Date.now()});
        pushed += n;
        this.lastAt = Date.now();
        done = true;
        break;
      }
      if(!done) throw new SyncError('Не получилось отправить изменения: репозиторий всё время меняется с другого устройства. Попробую позже.', 'error');
      this.set('ok');
      if(conflicts.length){
        toast('Заметку «' + noteName(conflicts[0].path) + '» меняли на двух устройствах. Твоя версия сохранена рядом: «' + noteName(conflicts[0].copy) + '».', 7000);
      } else if(manual){
        toast(pulled || pushed ? 'Синхронизировано: получено ' + pulled + ', отправлено ' + pushed : 'Всё уже синхронизировано');
      } else if(pulled){
        toast('С другого устройства: ' + pulled + ' ' + plural(pulled, 'изменение', 'изменения', 'изменений'));
      }
    } catch(e){
      this.set(e.kind === 'offline' ? 'offline' : 'error', this.explain(e));
      if(manual) toast(this.message, 6000);
    } finally {
      this.running = false;
      if(this.again){ this.again = false; this.soon(1500); }
    }
  },
  soon(ms){
    if(!this.enabled()) return;
    clearTimeout(this.timer);
    this.timer = setTimeout(() => this.sync(false), ms === undefined ? 8000 : ms);
  },

  /* ---------- состояние в строке внизу и окно настройки ---------- */
  set(state, message){
    this.state = state;
    this.message = message || '';
    const b = $('#st-sync');
    if(!b) return;
    b.hidden = !this.enabled();
    b.className = 'st-sync ' + state;
    const time = this.lastAt ? new Date(this.lastAt).toTimeString().slice(0, 5) : '';
    b.textContent = state === 'sync' ? 'GitHub · синхронизация…'
      : state === 'ok' ? 'GitHub · ' + time
      : state === 'offline' ? 'GitHub · нет сети'
      : state === 'error' ? 'GitHub · ошибка'
      : 'GitHub';
    b.title = state === 'ok' ? 'Синхронизировано в ' + time + '. Нажми, чтобы синхронизировать сейчас.' : (this.message || 'Синхронизация через GitHub');
    if(!$('#sync').hidden) this.fillStatus();
  },
  fillStatus(){
    const st = $('#sync-status');
    if(!this.cfg()){ st.textContent = ''; st.className = 'sync-status'; return; }
    const time = this.lastAt ? new Date(this.lastAt).toLocaleString('ru-RU', {day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit'}) : '';
    st.className = 'sync-status ' + this.state;
    st.textContent = this.state === 'sync' ? 'Синхронизирую…'
      : this.state === 'ok' ? 'Подключено. Последняя синхронизация: ' + time + '.'
      : this.message || 'Подключено.';
  },
  openSettings(){
    hideMenu(); closeDrawers();
    const c = this.cfg();
    $('#sync-repo').value = c ? c.repo : '';
    $('#sync-token').value = '';
    $('#sync-token').placeholder = c ? 'сохранён — оставь пустым' : 'github_pat_…';
    $('#sync-go').textContent = c ? 'Синхронизировать' : 'Подключить';
    $('#sync-off').hidden = !c;
    this.fillStatus();
    $('#sync').hidden = false;
    setTimeout(() => (c ? $('#sync-go') : $('#sync-repo')).focus(), 0);
  },
  closeSettings(){ $('#sync').hidden = true; },
  async connect(){
    const repo = $('#sync-repo').value.trim()
      .replace(/^https?:\/\/github\.com\//i, '').replace(/\.git$/i, '').replace(/\/+$/, '');
    const old = this.cfg();
    const token = $('#sync-token').value.trim() || (old && old.repo.toLowerCase() === repo.toLowerCase() ? old.token : '');
    const st = $('#sync-status');
    if(!/^[\w.-]+\/[\w.-]+$/.test(repo)){ st.className = 'sync-status error'; st.textContent = 'Напиши репозиторий так: логин/название, например Bruh84B/mindbutter-notes.'; return; }
    if(!token){ st.className = 'sync-status error'; st.textContent = 'Вставь токен GitHub.'; return; }
    LS.set('gh', {repo, token});
    $('#sync-token').value = '';
    await this.sync(true);
    if(this.state === 'error' && /токен|не найден|публичный|прав/i.test(this.message) && !(old && old.token === token && old.repo === repo)){
      /* неверные данные не сохраняем */
      const msg = this.message;
      if(old) LS.set('gh', old); else LS.set('gh', null);
      if(!old) this.set('off');
      st.className = 'sync-status error';
      st.textContent = msg;
      return;
    }
    this.openSettings();
  },
  async disconnect(){
    if(!(await askConfirm('Отключить синхронизацию на этом устройстве? Заметки останутся здесь и в репозитории.', 'Отключить'))) return;
    await meta.del(this.stateKey()).catch(() => {});
    LS.set('gh', null);
    this.set('off');
    const b = $('#st-sync'); if(b) b.hidden = true;
    this.openSettings();
    toast('Синхронизация отключена');
  },
  onVaultOpen(){
    this.shaCache.clear();
    this.set(this.enabled() ? 'idle' : 'off');
    if(this.enabled()) this.soon(600);
  },
  bind(){
    $('#st-sync').addEventListener('click', () => { if(this.state === 'error') this.openSettings(); else this.sync(true); });
    $('#sync-form').addEventListener('submit', e => { e.preventDefault(); this.connect(); });
    $('#sync-close').addEventListener('click', () => this.closeSettings());
    $('#sync-off').addEventListener('click', () => this.disconnect());
    $('#sync').addEventListener('click', e => { if(e.target.id === 'sync') this.closeSettings(); });
    document.addEventListener('visibilitychange', () => {
      if(!document.hidden && Date.now() - this.lastAt > 20000) this.soon(400);
    });
    window.addEventListener('online', () => this.soon(400));
    setInterval(() => { if(!document.hidden && Date.now() - this.lastAt > 170000) this.sync(false); }, 60000);
  },
};
