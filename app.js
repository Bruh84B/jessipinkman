'use strict';
/* MindButter — интерфейс: дерево файлов, редактор, чтение, связи, поиск, теги, граф, быстрый переход. */

const $ = s => document.querySelector(s);
const $$ = s => Array.from(document.querySelectorAll(s));
const IS_MAC = /Mac|iPhone|iPad/.test(navigator.platform || navigator.userAgent);
const LS = {
  get(k, d){ try { const v = localStorage.getItem('mindbutter.' + k); return v === null ? d : JSON.parse(v); } catch(e){ return d; } },
  set(k, v){ try { localStorage.setItem('mindbutter.' + k, JSON.stringify(v)); } catch(e){} },
};

const FOLDER_SVG = '<path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>';
const FILE_SVG = '<path d="M14 3H6a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z"/><path d="M14 3v6h6"/>';
const ICONS = {
  folder: FOLDER_SVG,
  'folder-plus': FOLDER_SVG + '<path d="M12 10v6M9 13h6"/>',
  file: FILE_SVG,
  'file-plus': FILE_SVG + '<path d="M12 12v6M9 15h6"/>',
  jump: FILE_SVG + '<circle cx="11.5" cy="14.5" r="2.5"/><path d="m15.5 18.5-2-2"/>',
  search: '<circle cx="11" cy="11" r="7"/><path d="m20 20-4-4"/>',
  tag: '<path d="M3 12V4a1 1 0 0 1 1-1h8l9 9-9 9z"/><circle cx="7.5" cy="7.5" r="1.3"/>',
  graph: '<circle cx="6" cy="6" r="2.2"/><circle cx="18" cy="8" r="2.2"/><circle cx="9" cy="18" r="2.2"/><path d="m8.2 6.4 7.6 1.2M6.6 8.1l1.7 7.7M16.6 9.7l-6 6.6"/>',
  calendar: '<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M3 10h18M8 3v4M16 3v4"/>',
  moon: '<path d="M20 14.5A8 8 0 1 1 9.5 4a6.5 6.5 0 0 0 10.5 10.5z"/>',
  sun: '<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/>',
  vault: '<path d="M21 8 12 3 3 8v8l9 5 9-5z"/><path d="m3 8 9 5 9-5M12 13v8"/>',
  collapse: '<path d="m7 20 5-5 5 5M7 4l5 5 5-5"/>',
  refresh: '<path d="M21 12a9 9 0 1 1-2.6-6.4L21 8"/><path d="M21 3v5h-5"/>',
  menu: '<path d="M4 6h16M4 12h16M4 18h16"/>',
  left: '<path d="m15 18-6-6 6-6"/>',
  right: '<path d="m9 18 6-6-6-6"/>',
  book: '<path d="M2 4h7a3 3 0 0 1 3 3v13a2 2 0 0 0-2-2H2z"/><path d="M22 4h-7a3 3 0 0 0-3 3v13a2 2 0 0 1 2-2h8z"/>',
  pen: '<path d="M17 3a2.8 2.8 0 0 1 4 4L7.5 20.5 2 22l1.5-5.5z"/>',
  'panel-right': '<rect x="3" y="3" width="18" height="18" rx="2"/><path d="M15 3v18"/>',
  image: '<rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="9" cy="9" r="2"/><path d="m21 15-5-5L5 21"/>',
  chev: '<path d="m9 6 6 6-6 6"/>',
  logo: '<path class="fill" d="M4 10.5 11 7l9 3.5v6.5L13 20.5 4 17z"/><path d="M4 10.5 11 7l9 3.5-7 3.5zM13 14v6.5M4 10.5V17l9 3.5 7-3.5v-6.5"/><path d="M15.5 12.3c0 1.6.2 3.2-.6 3.6-.8.4-1-.9-1-2.2"/>',
  help: '<circle cx="12" cy="12" r="9"/><path d="M9.5 9.2a2.6 2.6 0 0 1 5 1c0 1.8-2.5 2.3-2.5 3.8M12 17.2v.1"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  play: '<path d="M7 5v14l11-7z"/>',
  stop: '<rect x="7" y="7" width="10" height="10" rx="1.5"/>',
  x: '<path d="M18 6 6 18M6 6l12 12"/>',
  'panel-left': '<rect x="3" y="3" width="18" height="18" rx="2"/><path d="M9 3v18"/>',
};
function icon(name){
  return '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + (ICONS[name] || '') + '</svg>';
}
/* значок вставляется перед подписью кнопки, подпись не трогаем */
function setIcon(el, name){
  el.dataset.icon = name;
  const old = el.querySelector(':scope > svg');
  if(old) old.remove();
  el.insertAdjacentHTML('afterbegin', icon(name));
}

function plural(n, one, few, many){
  const a = Math.abs(n) % 100, b = a % 10;
  if(a > 10 && a < 20) return many;
  if(b > 1 && b < 5) return few;
  if(b === 1) return one;
  return many;
}
function todayKey(){
  const d = new Date();
  return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
}
function stamp(){ return todayKey() + ' ' + new Date().toTimeString().slice(0, 8).replace(/:/g, '-'); }
function sanitizeName(s){
  return String(s).replace(/[\\/:*?"<>|#^\[\]]/g, ' ').replace(/\s+/g, ' ').trim().replace(/^\.+/, '').slice(0, 120);
}
function sanitizePath(s){ return String(s).split('/').map(sanitizeName).filter(Boolean).join('/'); }
const collator = new Intl.Collator('ru', {numeric: true, sensitivity: 'base'});

let toastTimer = 0;
function toast(msg, ms){
  const t = $('#toast');
  t.textContent = msg; t.hidden = false;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { t.hidden = true; }, ms || 2600);
}

/* ================= состояние ================= */
const S = {
  vault: null,
  files: new Map(),       /* path → {type:'md'|'img'|'dir', mtime, text?, parsed?} */
  idx: {all: new Map(), names: new Map()},
  cur: null, curType: null,
  view: 'empty',
  mode: LS.get('mode', 'edit'),
  dirty: false,
  saveChain: Promise.resolve(),
  leftPane: 'files',
  collapsed: new Set(),
  selectedFolder: '',
  gscope: LS.get('gscope', 'all'),
  graph: null,
  pendingSub: null, pendingFind: null, focusTitle: false,
  sug: null, sw: null, menuItems: null,
};
function vaultKey(){ return S.vault ? S.vault.kind + ':' + S.vault.name : ''; }
function mdPaths(){ const out = []; for(const [p, f] of S.files) if(f.type === 'md') out.push(p); return out; }
function addFileRec(r){
  S.files.set(r.path, {type: r.type, mtime: r.mtime || 0, text: r.text,
    parsed: r.type === 'md' ? parseNote(r.text || '') : null});
}
function reindex(){ S.idx = buildIndex(S.files); }
function existsCI(path){
  const l = path.toLowerCase();
  for(const k of S.files.keys()) if(k.toLowerCase() === l) return true;
  return false;
}
function uniquePath(dir, base, ext){
  let p = joinPath(dir, base + ext), i = 1;
  while(existsCI(p)) p = joinPath(dir, base + ' ' + (i++) + ext);
  return p;
}

/* ================= запуск и выбор хранилища ================= */
async function boot(){
  $$('[data-icon]').forEach(el => setIcon(el, el.dataset.icon));
  syncThemeIcon();
  bindUI();
  Guide.bind();
  GHSync.bind();
  if(window.SLUDA_DEMO) document.documentElement.classList.add('demo');
  if(!window.SLUDA_DEMO && 'serviceWorker' in navigator && /^https?:$/.test(location.protocol)){
    navigator.serviceWorker.register('sw.js').catch(() => {});
  }
  const app = $('#app');
  if(LS.get('leftCollapsed', false)) app.classList.add('left-collapsed');
  if(LS.get('rightCollapsed', false)) app.classList.add('right-collapsed');

  if(window.SLUDA_DEMO){
    try { return await chooseBrowser(); }
    catch(e){ return showStart('Браузер не дал сохранить заметки (IndexedDB). В приватном окне так бывает — открой обычное.'); }
  }
  let m;
  try { m = await meta.get('vault'); }
  catch(e){ showStart('Браузер не дал доступ к хранилищу (IndexedDB). В приватном окне так бывает — открой обычное.'); return; }
  if(m && m.kind === 'folder' && m.handle && FS_SUPPORTED){
    const ok = await fsPermission(m.handle, false).catch(() => false);
    if(ok) return openVault(new FolderVault(m.handle));
    return showStart(null, m.handle);
  }
  if(m && m.kind === 'browser') return openVault(new BrowserVault());
  showStart();
}

function showStart(note, reopenHandle){
  $('#start').hidden = false;
  $('#start-folder').hidden = !FS_SUPPORTED || !!window.SLUDA_DEMO;
  const re = $('#start-reopen');
  re.hidden = !reopenHandle;
  if(reopenHandle){
    $('#start-reopen-name').textContent = 'Открыть папку «' + reopenHandle.name + '» снова';
    re.onclick = async () => {
      try {
        if(await fsPermission(reopenHandle, true)) openVault(new FolderVault(reopenHandle));
        else toast('Без разрешения папку не открыть');
      } catch(e){ toast('Папка недоступна: ' + e.message); }
    };
  }
  $('#start-note').textContent = note || (FS_SUPPORTED ? '' :
    'Открыть папку с диска можно в Chrome, Edge или Яндекс Браузере на компьютере. Здесь доступно хранение в браузере.');
}

async function chooseFolder(){
  let h;
  try { h = await window.showDirectoryPicker({mode: 'readwrite', id: 'mindbutter'}); }
  catch(e){ if(e.name !== 'AbortError') toast('Не удалось открыть папку: ' + e.message); return; }
  try { await meta.set('vault', {kind: 'folder', handle: h}); } catch(e){ /* не запомнится между запусками — не страшно */ }
  openVault(new FolderVault(h));
}
async function chooseBrowser(){
  await meta.set('vault', {kind: 'browser'});
  const v = new BrowserVault();
  if(await v.isEmpty()) await seedWelcome(v);
  openVault(v);
}

async function openVault(v){
  await flushSave();
  S.vault = v;
  S.cur = null; S.curType = null;
  $('#start').hidden = true;
  setSave('загрузка…');
  let list;
  try { list = await v.scan(); }
  catch(e){ showStart('Не удалось прочитать хранилище: ' + e.message); return; }
  S.files = new Map();
  for(const r of list) addFileRec(r);
  reindex();
  $('#vault-name').textContent = v.name;
  $('#vault-name').title = v.kind === 'folder' ? 'Папка на диске: ' + v.name : 'Заметки хранятся в этом браузере';
  S.collapsed = new Set(LS.get('collapsed.' + vaultKey(), []));
  renderTree(); renderTags();
  setSave('');
  GHSync.onVaultOpen();
  if(!LS.get('guideSeen', false)) setTimeout(() => { if($('#start').hidden) Guide.open(0); }, 350);
  const h = location.hash;
  if(h && h !== '#') return route();
  const last = LS.get('last.' + vaultKey(), null);
  if(last && S.files.has(last)) return navigate(last);
  const md = mdPaths().sort(collator.compare);
  const welcome = md.find(p => /добро пожаловать/i.test(p));
  if(welcome || md[0]) navigate(welcome || md[0]);
  else showView('empty');
}

/* ================= навигация (через адресную строку: работают «назад/вперёд» браузера) ================= */
function encPath(p){ return p.split('/').map(encodeURIComponent).join('/'); }
function navigate(path, sub){
  S.pendingSub = sub || null;
  const h = '#/' + encPath(path);
  if(location.hash === h) route(); else location.hash = h;
}
function route(){
  if(!S.vault) return;
  const h = location.hash.slice(1);
  if(h === 'graph'){ openGraph(); return; }
  if(h.charAt(0) === '/'){
    let p = null;
    try { p = h.slice(1).split('/').map(decodeURIComponent).join('/'); } catch(e){ p = null; }
    if(p && S.files.has(p) && S.files.get(p).type !== 'dir'){ openNote(p); return; }
    if(p) toast('Файл «' + p + '» не найден');
  }
  if(S.cur && S.files.has(S.cur)) openNote(S.cur);
  else showView('empty');
}

function showView(v){
  S.view = v;
  $('#view-note').hidden = v !== 'note';
  $('#view-graph').hidden = v !== 'graph';
  $('#view-empty').hidden = v !== 'empty';
  const t = $('#title');
  t.hidden = v !== 'note';
  $('#mode-seg').hidden = !(v === 'note' && S.curType === 'md');
  if(v === 'graph'){ $('#crumbs').textContent = 'Граф связей'; }
  else if(v === 'empty'){ $('#crumbs').textContent = ''; }
  if(v !== 'note'){ renderRight(); renderStatus(); }
}

function renderCrumbs(){
  const c = $('#crumbs');
  c.textContent = '';
  if(!S.cur) return;
  const dir = parentOf(S.cur);
  if(dir) c.textContent = dir.split('/').join(' / ') + ' /';
}

async function openNote(path){
  if(S.cur && S.cur !== path) await flushSave();
  const f = S.files.get(path);
  if(!f) return;
  S.cur = path; S.curType = f.type;
  S.selectedFolder = parentOf(path);
  LS.set('last.' + vaultKey(), path);
  pushRecent(path);
  showView('note');
  const title = $('#title');
  title.value = f.type === 'md' ? noteName(path) : baseOf(path);
  title.readOnly = f.type !== 'md';
  renderCrumbs();
  const ed = $('#editor');
  hideSuggest();
  if(f.type === 'md'){
    if(S.focusTitle && S.mode === 'read'){ S.mode = 'edit'; LS.set('mode', 'edit'); }
    ed.value = f.text || '';
    S.dirty = false;
    ed.scrollTop = 0;
    applyMode();
  } else {
    ed.hidden = true;
    const pv = $('#preview');
    pv.hidden = false;
    pv.innerHTML = '<p class="mut">' + escHtml(path) + '</p>';
    const img = document.createElement('img');
    img.alt = baseOf(path);
    pv.appendChild(img);
    blobUrl(path).then(u => { img.src = u; }).catch(() => {});
  }
  highlightTree(); renderRight(); renderStatus();
  closeDrawers();
  if(S.focusTitle){ S.focusTitle = false; title.focus(); title.select(); }
  if(S.pendingSub){ const s = S.pendingSub; S.pendingSub = null; setTimeout(() => scrollToHeading(s), 30); }
  if(S.pendingFind){ const q = S.pendingFind; S.pendingFind = null; setTimeout(() => findInNote(q), 30); }
}
function pushRecent(path){
  const k = 'recent.' + vaultKey();
  const r = LS.get(k, []).filter(p => p !== path);
  r.unshift(path);
  LS.set(k, r.slice(0, 30));
}

function applyMode(){
  if(S.curType !== 'md') return;
  const read = S.mode === 'read';
  $('#editor').hidden = read;
  $('#preview').hidden = !read;
  $('#mode-edit').classList.toggle('on', !read);
  $('#mode-read').classList.toggle('on', read);
  $('#mode-seg').hidden = false;
  if(read) renderPreview();
}
function setMode(m){ if(S.mode !== m) toggleMode(); }
function toggleMode(){
  if(S.view !== 'note' || S.curType !== 'md') return;
  const ed = $('#editor'), pv = $('#preview');
  /* сохраняем примерное место при переключении */
  const ratio = S.mode === 'read'
    ? pv.scrollTop / Math.max(1, pv.scrollHeight - pv.clientHeight)
    : ed.scrollTop / Math.max(1, ed.scrollHeight - ed.clientHeight);
  S.mode = S.mode === 'read' ? 'edit' : 'read';
  LS.set('mode', S.mode);
  applyMode();
  const el = S.mode === 'read' ? pv : ed;
  el.scrollTop = ratio * (el.scrollHeight - el.clientHeight);
  if(S.mode === 'edit') ed.focus({preventScroll: true});
}

/* ================= чтение: рендер, вложения, задачи ================= */
const BLOBS = new Map();
async function blobUrl(path){
  const f = S.files.get(path);
  const c = BLOBS.get(path);
  if(c && f && c.mtime === f.mtime) return c.url;
  if(c) URL.revokeObjectURL(c.url);
  const data = await S.vault.read(path);
  const url = URL.createObjectURL(data);
  BLOBS.set(path, {url, mtime: f ? f.mtime : 0});
  return url;
}

function renderPreview(){
  const pv = $('#preview');
  const text = $('#editor').value;
  pv.innerHTML = renderMarkdown(text, S.idx, S.cur);
  decorate(pv);
  fixImages(pv, S.cur);
  fillEmbeds(pv, S.cur, 0);
  const lines = taskLines(text);
  const boxes = Array.from(pv.querySelectorAll('input[type=checkbox]')).filter(b => !b.closest('.embed-note'));
  if(boxes.length === lines.length){
    boxes.forEach((b, i) => { b.disabled = false; b.dataset.line = lines[i]; });
  }
}

function fixImages(root, from){
  for(const img of root.querySelectorAll('img[src]')){
    const src = img.getAttribute('src');
    if(/^(https?:|data:|blob:)/i.test(src)) continue;
    let p;
    try { p = decodeURI(src); } catch(e){ p = src; }
    const r = resolveLink(S.idx, p, from);
    if(r && S.files.get(r).type === 'img') blobUrl(r).then(u => { img.src = u; }).catch(() => {});
  }
}

async function fillEmbeds(root, from, depth){
  const spans = Array.from(root.querySelectorAll('span.embed[data-embed]'));
  for(const sp of spans){
    const l = splitLink(sp.dataset.embed);
    const p = resolveLink(S.idx, l.target, from);
    if(!p){
      sp.className = 'embed missing';
      sp.textContent = '«' + l.target + '» — такого файла нет';
      continue;
    }
    const f = S.files.get(p);
    if(f.type === 'img'){
      const img = document.createElement('img');
      img.alt = baseOf(p);
      const size = /^(\d+)(?:x(\d+))?$/.exec(l.alias);
      if(size){ img.width = +size[1]; if(size[2]) img.height = +size[2]; }
      sp.replaceWith(img);
      blobUrl(p).then(u => { img.src = u; }).catch(() => {});
      continue;
    }
    const box = document.createElement('div');
    box.className = 'embed-note';
    const head = document.createElement('a');
    head.className = 'internal-link embed-title';
    head.dataset.href = l.target + (l.sub ? '#' + l.sub : '');
    head.tabIndex = 0;
    head.textContent = noteName(p) + (l.sub ? ' › ' + l.sub : '');
    box.appendChild(head);
    const body = document.createElement('div');
    if(depth >= 2 || p === from){
      body.className = 'mut';
      body.textContent = 'Вложение внутри вложения — дальше не раскрываю.';
    } else {
      let txt = f.text || '';
      if(l.sub){
        const sec = extractSection(txt, l.sub);
        txt = sec === null ? '*Заголовок «' + l.sub + '» не найден.*' : sec;
      }
      body.innerHTML = renderMarkdown(txt, S.idx, p);
      decorate(body);
      fixImages(body, p);
      await fillEmbeds(body, p, depth + 1);
    }
    box.appendChild(body);
    sp.replaceWith(box);
  }
}

async function followLink(inner){
  const l = splitLink(inner);
  if(!l.target){ scrollToHeading(l.sub); return; }
  const p = resolveLink(S.idx, l.target, S.cur);
  if(p) return navigate(p, l.sub);
  await createFromTarget(l.target);
}
async function createFromTarget(target){
  const clean = sanitizePath(String(target).replace(/\.md$/i, ''));
  if(!clean){ toast('Пустое название'); return; }
  const path = clean + '.md';
  if(!existsCI(path)) await createFile(path, '');
  S.focusTitle = false;
  navigate(resolveLink(S.idx, clean, null) || path);
  toast('Создана заметка «' + baseOf(clean) + '»');
}

function scrollToHeading(sub){
  if(!sub) return;
  if(S.mode === 'read'){
    const el = document.getElementById('h-' + slugify(sub));
    if(el) el.scrollIntoView({block: 'start'});
    return;
  }
  const ed = $('#editor');
  const lines = ed.value.split('\n');
  let pos = 0;
  for(const line of lines){
    const h = /^#{1,6}\s+(.+?)\s*#*\s*$/.exec(line);
    if(h && h[1].toLowerCase() === sub.toLowerCase()){ revealInEditor(pos, pos + line.length); return; }
    pos += line.length + 1;
  }
}
function findInNote(q){
  if(S.mode === 'read'){
    const w = window.find ? null : null; /* в чтении просто показываем заметку */
    return w;
  }
  const ed = $('#editor');
  const i = ed.value.toLowerCase().indexOf(q.toLowerCase());
  if(i >= 0) revealInEditor(i, i + q.length);
}
function revealInEditor(a, b){
  const ed = $('#editor');
  ed.focus({preventScroll: true});
  ed.setSelectionRange(a, b);
  const xy = caretXY(ed, a);
  ed.scrollTop = Math.max(0, xy.top - ed.clientHeight / 3);
}

/* ================= сохранение ================= */
let saveTimer = 0;
function setSave(s){ $('#st-save').textContent = s; }
function markDirty(){
  S.dirty = true;
  setSave('изменено…');
  clearTimeout(saveTimer);
  saveTimer = setTimeout(flushSave, 700);
}
function flushSave(){
  clearTimeout(saveTimer);
  S.saveChain = S.saveChain.then(async () => {
    if(!S.dirty || !S.cur || S.curType !== 'md' || !S.vault) return;
    const path = S.cur, text = $('#editor').value;
    S.dirty = false;
    try {
      const mtime = await S.vault.write(path, text);
      const f = S.files.get(path);
      if(f){ f.text = text; f.mtime = mtime; f.parsed = parseNote(text); }
      if(!S.dirty) setSave('сохранено');
      afterTextChange();
      GHSync.soon();
    } catch(e){
      S.dirty = true;
      setSave('не сохранено');
      toast('Не сохранилось: ' + e.message, 5000);
    }
  });
  return S.saveChain;
}
let tagsTimer = 0;
function afterTextChange(){
  renderRight();
  clearTimeout(tagsTimer);
  tagsTimer = setTimeout(() => { renderTags(); if(S.leftPane === 'search') runSearch($('#search-input').value); }, 400);
}
function refreshAll(){
  renderTree(); renderTags(); renderRight(); renderStatus();
  if(S.view === 'graph') updateGraph();
}

/* ================= операции с файлами ================= */
async function createFile(path, data){
  const mtime = await S.vault.write(path, data);
  addFileRec({path, type: typeOf(path), mtime, text: typeof data === 'string' ? data : undefined});
  let d = parentOf(path);
  while(d){ S.collapsed.delete(d); d = parentOf(d); }
  saveCollapsed();
  reindex();
  refreshAll();
  GHSync.soon();
  return path;
}
async function newNote(dir){
  if(!S.vault) return;
  if(dir === undefined) dir = S.selectedFolder || '';
  if(dir && !S.files.has(dir) && !mdPaths().some(p => under(p, dir))) dir = '';
  const path = uniquePath(dir, 'Без названия', '.md');
  await createFile(path, '');
  S.focusTitle = true;
  navigate(path);
}
async function newFolder(dir){
  if(!S.vault) return;
  if(dir === undefined) dir = S.selectedFolder || '';
  const v = await askText('Название новой папки', '');
  if(v === null) return;
  const name = sanitizePath(v);
  if(!name) return;
  const path = joinPath(dir, name);
  if(existsCI(path)){ toast('Такая папка уже есть'); return; }
  try { await S.vault.mkdir(path); } catch(e){ toast('Не получилось: ' + e.message); return; }
  let d = path;
  while(d){ if(!S.files.has(d)) S.files.set(d, {type: 'dir', mtime: 0}); S.collapsed.delete(d); d = parentOf(d); }
  S.selectedFolder = path;
  saveCollapsed();
  renderTree();
}
async function dailyNote(){
  if(!S.vault) return;
  const path = 'Ежедневные/' + todayKey() + '.md';
  if(!S.files.has(path)) await createFile(path, '');
  navigate(path);
}

async function deletePath(path){
  const f = S.files.get(path);
  const isDir = !f || f.type === 'dir';
  const name = f && f.type === 'md' ? noteName(path) : baseOf(path);
  const msg = isDir ? 'Удалить папку «' + name + '» вместе со всем содержимым?' : 'Удалить «' + name + '»?';
  if(!(await askConfirm(msg + ' Это нельзя отменить.'))) return;
  if(S.cur && under(S.cur, path)){ S.dirty = false; clearTimeout(saveTimer); }
  try { await S.vault.remove(path); } catch(e){ toast('Не удалось удалить: ' + e.message); return; }
  for(const p of Array.from(S.files.keys())) if(under(p, path)) S.files.delete(p);
  reindex();
  if(S.cur && under(S.cur, path)){
    S.cur = null; S.curType = null;
    history.replaceState(null, '', location.pathname + location.search);
    showView('empty');
  }
  refreshAll();
  GHSync.soon();
  toast('Удалено');
}

/* переименование и перенос: ссылки на перенесённые файлы переписываются во всех заметках */
async function renamePath(from, to){
  if(from === to) return true;
  if(existsCI(to) && to.toLowerCase() !== from.toLowerCase()){ toast('Такое имя уже есть'); return false; }
  if(under(to, from)){ toast('Нельзя перенести папку внутрь неё самой'); return false; }
  await flushSave();
  const moved = new Map();
  for(const p of S.files.keys()) if(under(p, from)) moved.set(p, to + p.slice(from.length));
  const after = new Map();
  for(const [p, f] of S.files) after.set(moved.get(p) || p, f);
  const newIdx = buildIndex(after);
  const rewrites = [];
  for(const [p, f] of S.files){
    if(f.type !== 'md') continue;
    const text = f.text || '';
    const newFrom = moved.get(p) || p;
    let changed = false;
    const nt = text.replace(WIKI_RE, (all, bang, inner) => {
      const l = splitLink(inner);
      if(!l.target) return all;
      const r = resolveLink(S.idx, l.target, p);
      if(!r || !moved.has(r)) return all;
      const np = moved.get(r);
      if(resolveLink(newIdx, l.target, newFrom) === np) return all;
      changed = true;
      return bang + '[[' + linkTextFor(newIdx, np) + (l.sub ? '#' + l.sub : '') + (l.alias ? '|' + l.alias : '') + ']]';
    });
    if(changed) rewrites.push({path: newFrom, text: nt});
  }
  try { await S.vault.rename(from, to); }
  catch(e){ toast('Не удалось переименовать: ' + e.message); return false; }
  S.files = after;
  for(const c of Array.from(S.collapsed)) if(under(c, from)){ S.collapsed.delete(c); S.collapsed.add(to + c.slice(from.length)); }
  saveCollapsed();
  for(const [o, n] of moved){ const b = BLOBS.get(o); if(b){ BLOBS.delete(o); BLOBS.set(n, b); } }
  for(const r of rewrites){
    try {
      const mtime = await S.vault.write(r.path, r.text);
      const f = S.files.get(r.path);
      f.text = r.text; f.mtime = mtime; f.parsed = parseNote(r.text);
    } catch(e){ toast('Не обновилась ссылка в «' + r.path + '»'); }
  }
  reindex();
  if(S.cur && moved.has(S.cur)){
    S.cur = moved.get(S.cur);
    history.replaceState(null, '', '#/' + encPath(S.cur));
    LS.set('last.' + vaultKey(), S.cur);
    if(S.view === 'note'){ $('#title').value = S.curType === 'md' ? noteName(S.cur) : baseOf(S.cur); renderCrumbs(); }
  }
  if(S.cur && S.curType === 'md' && rewrites.some(r => r.path === S.cur)){
    const ed = $('#editor'), s = ed.selectionStart;
    ed.value = S.files.get(S.cur).text;
    ed.setSelectionRange(s, s);
  }
  if(S.view === 'note' && S.mode === 'read' && S.curType === 'md') renderPreview();
  refreshAll();
  GHSync.soon();
  if(rewrites.length) toast('Ссылки обновлены в ' + rewrites.length + ' ' + plural(rewrites.length, 'заметке', 'заметках', 'заметках'));
  return true;
}
async function renameFromTitle(){
  if(!S.cur || S.curType !== 'md') return;
  const t = $('#title');
  const v = sanitizeName(t.value);
  if(!v || v === noteName(S.cur)){ t.value = noteName(S.cur); return; }
  const ok = await renamePath(S.cur, joinPath(parentOf(S.cur), v + '.md'));
  if(!ok) t.value = noteName(S.cur);
}
async function renameAsk(path){
  const f = S.files.get(path);
  const isMd = f && f.type === 'md';
  const cur = isMd ? noteName(path) : baseOf(path);
  const v = await askText('Новое название', cur);
  if(v === null) return;
  let name = sanitizeName(v);
  if(!name) return;
  if(isMd) name += '.md';
  else if(f && f.type === 'img' && !typeOf(name)) name += '.' + extOf(path);
  await renamePath(path, joinPath(parentOf(path), name));
}

/* ================= дерево файлов ================= */
function saveCollapsed(){ LS.set('collapsed.' + vaultKey(), Array.from(S.collapsed)); }
function buildTree(){
  const root = {name: '', path: '', dirs: new Map(), files: []};
  const getDir = path => {
    let node = root, acc = '';
    if(!path) return root;
    for(const part of path.split('/')){
      acc = joinPath(acc, part);
      if(!node.dirs.has(part)) node.dirs.set(part, {name: part, path: acc, dirs: new Map(), files: []});
      node = node.dirs.get(part);
    }
    return node;
  };
  for(const [p, f] of S.files){
    if(f.type === 'dir') getDir(p);
    else getDir(parentOf(p)).files.push(p);
  }
  return root;
}
function renderTree(){
  const out = [];
  const walk = (node, depth) => {
    const dirs = Array.from(node.dirs.values()).sort((a, b) => collator.compare(a.name, b.name));
    for(const d of dirs){
      const closed = S.collapsed.has(d.path);
      out.push('<div class="ti dir' + (closed ? ' closed' : '') + '" data-path="' + escHtml(d.path) + '" draggable="true" style="--d:' + depth + '">' +
        '<span class="tw">' + icon('chev') + '</span><span class="tn">' + escHtml(d.name) + '</span></div>');
      if(!closed) walk(d, depth + 1);
    }
    const files = node.files.slice().sort((a, b) => collator.compare(baseOf(a), baseOf(b)));
    for(const p of files){
      const f = S.files.get(p);
      out.push('<div class="ti file' + (p === S.cur ? ' active' : '') + '" data-path="' + escHtml(p) + '" draggable="true" style="--d:' + depth + '">' +
        '<span class="tw">' + (f.type === 'img' ? icon('image') : '') + '</span><span class="tn">' +
        escHtml(f.type === 'md' ? noteName(p) : baseOf(p)) + '</span></div>');
    }
  };
  walk(buildTree(), 0);
  $('#tree').innerHTML = out.join('') || '<div class="hint pad">Пусто. Создай первую заметку — кнопка выше или Ctrl+N.</div>';
}
function highlightTree(){
  for(const el of $$('#tree .ti.active')) el.classList.remove('active');
  if(!S.cur) return;
  let d = parentOf(S.cur), opened = false;
  while(d){ if(S.collapsed.delete(d)) opened = true; d = parentOf(d); }
  if(opened){ saveCollapsed(); renderTree(); }
  const el = Array.from($$('#tree .ti.file')).find(x => x.dataset.path === S.cur);
  if(el){ el.classList.add('active'); el.scrollIntoView({block: 'nearest'}); }
}

/* ================= правая панель: связи и оглавление ================= */
/* строка для списков: без [[скобок]], решёток заголовков, маркеров списка и звёздочек */
function plainLine(s){
  return s
    .replace(/!?\[\[([^\]|]+)\|([^\]]+)\]\]/g, '$2')
    .replace(/!?\[\[([^\]]+)\]\]/g, (m, a) => a.replace('#', ' › '))
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
    .replace(/^\s*(?:>\s*)*(?:\[![\w-]+\][+-]?\s*)?/, '')
    .replace(/^#{1,6}\s+/, '')
    .replace(/^(?:[-*+]|\d+[.)])\s+(?:\[[ xX]\]\s+)?/, '')
    .replace(/\*\*|__|==|`/g, '')
    .trim();
}
function lineAround(text, pos){
  const a = text.lastIndexOf('\n', pos - 1) + 1;
  let b = text.indexOf('\n', pos);
  if(b < 0) b = text.length;
  let s = plainLine(text.slice(a, b));
  if(s.length > 160) s = s.slice(0, 150).trim() + '…';
  return s;
}
function renderRight(){
  const ids = ['backlinks', 'unlinked', 'outlinks', 'outline'];
  if(!S.cur || S.curType !== 'md' || S.view === 'empty' || !S.files.has(S.cur)){
    ids.forEach(id => { $('#' + id).innerHTML = '<div class="hint">Открой заметку.</div>'; });
    ['bl-count', 'ul-count', 'ol-count', 'links-n'].forEach(id => { $('#' + id).textContent = ''; });
    return;
  }
  const cur = S.cur, name = noteName(cur), lname = name.toLowerCase();
  const curFile = S.files.get(cur);
  const bl = [], ul = [];
  for(const [p, f] of S.files){
    if(f.type !== 'md' || p === cur) continue;
    const hits = f.parsed.links.filter(l => l.target && resolveLink(S.idx, l.target, p) === cur);
    if(hits.length) bl.push({p, f, hits});
    else if(lname.length >= 3 && (f.text || '').toLowerCase().indexOf(lname) >= 0) ul.push({p, f});
  }
  bl.sort((a, b) => collator.compare(noteName(a.p), noteName(b.p)));
  $('#bl-count').textContent = bl.length || '';
  $('#links-n').textContent = bl.length || '';
  $('#backlinks').innerHTML = bl.length ? bl.map(x =>
    '<div class="res" data-open="' + escHtml(x.p) + '"><div class="res-name">' + escHtml(noteName(x.p)) + '</div>' +
    x.hits.slice(0, 3).map(h => '<div class="res-snip">' + escHtml(lineAround(x.f.text, h.pos)) + '</div>').join('') + '</div>'
  ).join('') : '<div class="hint">Сюда пока никто не ссылается.</div>';

  $('#ul-count').textContent = ul.length || '';
  $('#unlinked').innerHTML = ul.length ? ul.slice(0, 50).map(x => {
    const i = x.f.text.toLowerCase().indexOf(lname);
    return '<div class="res" data-open="' + escHtml(x.p) + '"><div class="res-name">' + escHtml(noteName(x.p)) + '</div>' +
      '<div class="res-snip">' + escHtml(lineAround(x.f.text, i)) + '</div></div>';
  }).join('') : '<div class="hint">Нет.</div>';

  const seen = new Set(), out = [];
  for(const l of curFile.parsed.links){
    if(!l.target) continue;
    const r = resolveLink(S.idx, l.target, cur);
    const key = r || 'x:' + l.target.toLowerCase();
    if(seen.has(key)) continue;
    seen.add(key);
    out.push(r
      ? '<div class="res" data-open="' + escHtml(r) + '"><div class="res-name">' + escHtml(S.files.get(r).type === 'md' ? noteName(r) : baseOf(r)) + '</div></div>'
      : '<div class="res unresolved" data-create="' + escHtml(l.target) + '" title="Нажми, чтобы создать"><div class="res-name">' + escHtml(l.target) + '</div></div>');
  }
  $('#ol-count').textContent = out.length || '';
  $('#outlinks').innerHTML = out.join('') || '<div class="hint">Ссылок нет. Напиши [[ и название.</div>';

  const hs = curFile.parsed.headings;
  const minL = hs.reduce((m, h) => Math.min(m, h.level), 6);
  $('#outline').innerHTML = hs.length ? hs.map(h =>
    '<div class="res ol" data-heading="' + escHtml(h.text) + '" style="--l:' + (h.level - minL) + '">' + escHtml(h.text) + '</div>'
  ).join('') : '<div class="hint">Заголовков нет.</div>';
}

function renderStatus(){
  if(S.view !== 'note' || S.curType !== 'md'){ $('#st-words').textContent = ''; $('#st-links').textContent = ''; return; }
  const t = $('#editor').value;
  const w = (t.match(/[\p{L}\p{N}]+/gu) || []).length;
  $('#st-words').textContent = w + ' ' + plural(w, 'слово', 'слова', 'слов') + ' · ' + t.length + ' зн.';
  const n = +($('#bl-count').textContent || 0);
  $('#st-links').textContent = n ? n + ' ' + plural(n, 'обратная ссылка', 'обратные ссылки', 'обратных ссылок') : '';
}

/* ================= поиск и теги ================= */
function highlight(line, terms){
  if(!terms.length) return escHtml(line);
  const re = new RegExp('(' + terms.map(t => t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|') + ')', 'gi');
  return line.split(re).map((part, i) => i % 2 ? '<mark>' + escHtml(part) + '</mark>' : escHtml(part)).join('');
}
function runSearch(q){
  const box = $('#search-results');
  const terms = String(q || '').toLowerCase().split(/\s+/).filter(Boolean);
  if(!terms.length){ box.innerHTML = ''; return; }
  const tags = terms.filter(t => t.charAt(0) === '#' && t.length > 1).map(t => t.slice(1));
  const words = terms.filter(t => !(t.charAt(0) === '#' && t.length > 1));
  const res = [];
  for(const [p, f] of S.files){
    if(f.type !== 'md') continue;
    const text = f.text || '', tl = text.toLowerCase(), nl = noteName(p).toLowerCase();
    if(tags.length){
      const nt = f.parsed.tags.map(x => x.toLowerCase());
      if(!tags.every(t => nt.some(x => x === t || x.indexOf(t + '/') === 0))) continue;
    }
    if(!words.every(w => tl.indexOf(w) >= 0 || nl.indexOf(w) >= 0)) continue;
    const snips = [];
    const probe = words[0] || '#' + tags[0];
    let from = 0;
    while(snips.length < 3){
      const i = tl.indexOf(probe, from);
      if(i < 0) break;
      snips.push(lineAround(text, i));
      from = text.indexOf('\n', i);
      if(from < 0) break;
    }
    res.push({p, score: words.filter(w => nl.indexOf(w) >= 0).length, snips});
  }
  res.sort((a, b) => b.score - a.score || collator.compare(noteName(a.p), noteName(b.p)));
  const hl = words.concat(tags.map(t => '#' + t));
  box.innerHTML = '<div class="hint">' + res.length + ' ' + plural(res.length, 'заметка', 'заметки', 'заметок') + '</div>' +
    res.slice(0, 200).map(x => '<div class="res" data-open="' + escHtml(x.p) + '" data-find="' + escHtml(words[0] || '') + '">' +
      '<div class="res-name">' + highlight(noteName(x.p), words) + '</div>' +
      x.snips.map(s => '<div class="res-snip">' + highlight(s, hl) + '</div>').join('') + '</div>').join('');
}
function searchFor(q){
  setPane('search');
  const inp = $('#search-input');
  inp.value = q;
  runSearch(q);
  openLeftDrawer();
}
function renderTags(){
  const count = new Map();
  for(const [, f] of S.files){
    if(f.type !== 'md') continue;
    for(const t of new Set(f.parsed.tags.map(x => x.toLowerCase()))) count.set(t, (count.get(t) || 0) + 1);
  }
  const list = Array.from(count).sort((a, b) => b[1] - a[1] || collator.compare(a[0], b[0]));
  $('#tag-list').innerHTML = list.length ? list.map(([t, n]) =>
    '<div class="res tagrow" data-tagq="' + escHtml(t) + '"><span class="tag">#' + escHtml(t) + '</span><span class="count">' + n + '</span></div>'
  ).join('') : '<div class="hint">Тегов нет. Напиши в заметке #что-нибудь.</div>';
}

/* ================= левая панель и выдвижные панели на телефоне ================= */
function isNarrow(){ return window.matchMedia('(max-width: 820px)').matches; }
function setPane(name){
  const app = $('#app');
  S.leftPane = name;
  app.classList.remove('left-collapsed');
  LS.set('leftCollapsed', false);
  for(const p of ['files', 'search', 'tags']) $('#pane-' + p).hidden = p !== name;
  for(const b of $$('.tab[data-cmd^="pane-"]')){ const on = b.dataset.cmd === 'pane-' + name; b.classList.toggle('on', on); b.setAttribute('aria-selected', on); }
  if(name === 'search') setTimeout(() => $('#search-input').focus(), 0);
}
function openLeftDrawer(){ if(isNarrow()){ $('#leftwrap').classList.add('open'); $('#backdrop').hidden = false; } }
function closeDrawers(){
  $('#leftwrap').classList.remove('open');
  $('#right').classList.remove('open');
  $('#backdrop').hidden = true;
}
function toggleRight(){
  if(isNarrow()){
    const open = !$('#right').classList.contains('open');
    closeDrawers();
    if(open){ $('#right').classList.add('open'); $('#backdrop').hidden = false; }
  } else {
    const c = $('#app').classList.toggle('right-collapsed');
    LS.set('rightCollapsed', c);
  }
}

/* ================= быстрый переход (Ctrl+O) ================= */
function openSwitcher(){
  if(!S.vault) return;
  hideMenu();
  $('#switcher').hidden = false;
  const inp = $('#sw-input');
  inp.value = '';
  renderSwitcher();
  inp.focus();
}
function closeSwitcher(){ $('#switcher').hidden = true; }
function renderSwitcher(){
  const q = $('#sw-input').value.trim();
  let items;
  const all = mdPaths();
  if(!q){
    const recent = LS.get('recent.' + vaultKey(), []).filter(p => S.files.has(p));
    const rest = all.filter(p => recent.indexOf(p) < 0).sort((a, b) => collator.compare(noteName(a), noteName(b)));
    items = recent.concat(rest).slice(0, 60).map(p => ({p}));
  } else {
    items = all.map(p => ({p, s: Math.max(fuzzyScore(q, noteName(p)), fuzzyScore(q, p) - 60)}))
      .filter(x => x.s >= 0).sort((a, b) => b.s - a.s).slice(0, 60);
    if(!all.some(p => noteName(p).toLowerCase() === q.toLowerCase() || p.toLowerCase() === (q + '.md').toLowerCase())) items.push({create: q});
  }
  S.sw = {items, sel: 0};
  drawSwitcher();
}
function drawSwitcher(){
  const {items, sel} = S.sw;
  $('#sw-list').innerHTML = items.map((it, i) => it.create
    ? '<div class="sw-i create' + (i === sel ? ' sel' : '') + '" data-i="' + i + '">Создать «' + escHtml(it.create) + '»</div>'
    : '<div class="sw-i' + (i === sel ? ' sel' : '') + '" data-i="' + i + '"><span>' + escHtml(noteName(it.p)) + '</span>' +
      (parentOf(it.p) ? '<span class="sw-path">' + escHtml(parentOf(it.p)) + '</span>' : '') + '</div>'
  ).join('') || '<div class="hint pad">Заметок пока нет.</div>';
  const el = $('#sw-list .sel');
  if(el) el.scrollIntoView({block: 'nearest'});
}
async function pickSwitcher(i, forceCreate){
  const q = $('#sw-input').value.trim();
  const it = S.sw && S.sw.items[i];
  closeSwitcher();
  if(forceCreate && q){ return createFromTarget(q); }
  if(!it) return;
  if(it.create) return createFromTarget(it.create);
  navigate(it.p);
}

/* ================= подсказка [[ в редакторе ================= */
const MIRROR_PROPS = ['boxSizing', 'borderTopWidth', 'borderRightWidth', 'borderBottomWidth', 'borderLeftWidth',
  'paddingTop', 'paddingRight', 'paddingBottom', 'paddingLeft', 'fontStyle', 'fontVariant', 'fontWeight', 'fontStretch',
  'fontSize', 'lineHeight', 'fontFamily', 'textAlign', 'textTransform', 'textIndent', 'letterSpacing', 'wordSpacing',
  'tabSize', 'overflowWrap', 'wordBreak'];
function caretXY(ta, pos){
  const div = document.createElement('div');
  const cs = getComputedStyle(ta);
  for(const p of MIRROR_PROPS) div.style[p] = cs[p];
  Object.assign(div.style, {position: 'absolute', visibility: 'hidden', whiteSpace: 'pre-wrap', top: '0', left: '-99999px',
    width: ta.clientWidth + 'px', boxSizing: 'border-box', borderWidth: '0', height: 'auto', overflow: 'hidden'});
  div.textContent = ta.value.slice(0, pos);
  const span = document.createElement('span');
  span.textContent = ta.value.slice(pos, pos + 1) || '.';
  div.appendChild(span);
  document.body.appendChild(div);
  const r = {top: span.offsetTop, left: span.offsetLeft, h: parseFloat(cs.lineHeight) || 24};
  div.remove();
  return r;
}
function checkSuggest(){
  const ta = $('#editor');
  const pos = ta.selectionStart;
  if(pos !== ta.selectionEnd) return hideSuggest();
  const before = ta.value.slice(Math.max(0, pos - 200), pos);
  const m = /\[\[([^\[\]\n|#]*)$/.exec(before);
  if(!m) return hideSuggest();
  const q = m[1];
  const all = [];
  for(const [p, f] of S.files) if(f.type === 'md' || f.type === 'img') all.push(p);
  const items = all.map(p => ({p, s: fuzzyScore(q, S.files.get(p).type === 'md' ? noteName(p) : baseOf(p))}))
    .filter(x => x.s >= 0).sort((a, b) => b.s - a.s).slice(0, 8);
  if(q.trim() && !all.some(p => noteName(p).toLowerCase() === q.trim().toLowerCase())) items.push({create: q.trim()});
  if(!items.length) return hideSuggest();
  const keepSel = S.sug && S.sug.q === q ? S.sug.sel : 0;
  S.sug = {start: pos - q.length, q, items, sel: Math.min(keepSel, items.length - 1)};
  const box = $('#suggest');
  box.innerHTML = items.map((it, i) => it.create
    ? '<div class="sg-i create' + (i === S.sug.sel ? ' sel' : '') + '" data-i="' + i + '">Новая заметка «' + escHtml(it.create) + '»</div>'
    : '<div class="sg-i' + (i === S.sug.sel ? ' sel' : '') + '" data-i="' + i + '">' + escHtml(S.files.get(it.p).type === 'md' ? noteName(it.p) : baseOf(it.p)) +
      (parentOf(it.p) ? '<span class="sw-path">' + escHtml(parentOf(it.p)) + '</span>' : '') + '</div>'
  ).join('');
  box.hidden = false;
  const xy = caretXY(ta, pos), r = ta.getBoundingClientRect();
  let left = r.left + xy.left - ta.scrollLeft, top = r.top + xy.top - ta.scrollTop + xy.h + 4;
  const bw = box.offsetWidth, bh = box.offsetHeight;
  left = Math.max(8, Math.min(left, window.innerWidth - bw - 8));
  if(top + bh > window.innerHeight - 8) top = r.top + xy.top - ta.scrollTop - bh - 4;
  box.style.left = left + 'px';
  box.style.top = Math.max(8, top) + 'px';
}
function hideSuggest(){ S.sug = null; $('#suggest').hidden = true; }
function acceptSuggest(i){
  const sg = S.sug;
  if(!sg) return;
  const it = sg.items[i];
  const ta = $('#editor');
  const pos = ta.selectionStart;
  const text = it.create ? it.create : linkTextFor(S.idx, it.p);
  const closed = ta.value.slice(pos, pos + 2) === ']]';
  ta.setSelectionRange(sg.start, pos);
  insertText(ta, text + (closed ? '' : ']]'));
  if(closed){ const p2 = ta.selectionStart + 2; ta.setSelectionRange(p2, p2); }
  hideSuggest();
}

/* ================= правка текста ================= */
function insertText(ta, text){
  ta.focus({preventScroll: true});
  let ok = false;
  /* пустая вставка в Chrome ставит курсор не туда — для удаления берём отдельную команду */
  const sel = ta.selectionStart;
  try { ok = text === '' ? (sel === ta.selectionEnd || document.execCommand('delete')) : document.execCommand('insertText', false, text); }
  catch(e){ ok = false; }
  if(ok && text === '') ta.setSelectionRange(sel, sel);
  if(!ok){
    ta.setRangeText(text, ta.selectionStart, ta.selectionEnd, 'end');
    onEditorInput({inputType: 'insertText', data: text});
  }
}
function wrapSel(ta, mk){
  const a = ta.selectionStart, b = ta.selectionEnd, t = ta.value.slice(a, b);
  insertText(ta, mk + t + mk);
  if(!t) ta.setSelectionRange(a + mk.length, a + mk.length);
  else ta.setSelectionRange(a + mk.length, b + mk.length);
}
function onEditorInput(e){
  if(S.curType !== 'md') return;
  const ta = $('#editor');
  if(e && e.inputType === 'insertText' && e.data === '['){
    const p = ta.selectionStart;
    if(ta.value.slice(p - 2, p) === '[[' && ta.value.slice(p, p + 2) !== ']]'){
      insertText(ta, ']]');
      ta.setSelectionRange(p, p);
    }
  }
  markDirty();
  renderStatusSoon();
  checkSuggest();
}
let statusTimer = 0;
function renderStatusSoon(){ clearTimeout(statusTimer); statusTimer = setTimeout(renderStatus, 250); }

function editorKeydown(e){
  const ta = e.target;
  if(S.sug){
    if(e.key === 'ArrowDown' || e.key === 'ArrowUp'){
      e.preventDefault();
      const n = S.sug.items.length;
      S.sug.sel = (S.sug.sel + (e.key === 'ArrowDown' ? 1 : n - 1)) % n;
      $$('#suggest .sg-i').forEach((el, i) => el.classList.toggle('sel', i === S.sug.sel));
      return;
    }
    if(e.key === 'Enter' || e.key === 'Tab'){ e.preventDefault(); acceptSuggest(S.sug.sel); return; }
    if(e.key === 'Escape'){ e.preventDefault(); hideSuggest(); return; }
  }
  const mod = IS_MAC ? e.metaKey : e.ctrlKey;
  /* закрывающую скобку, которая уже стоит после курсора, просто перешагиваем */
  if(e.key === ']' && !mod && ta.selectionStart === ta.selectionEnd && ta.value.charAt(ta.selectionStart) === ']'){
    e.preventDefault();
    ta.setSelectionRange(ta.selectionStart + 1, ta.selectionStart + 1);
    hideSuggest();
    return;
  }
  if(mod && !e.shiftKey && !e.altKey && (e.key === 'b' || e.key === 'и')){ e.preventDefault(); wrapSel(ta, '**'); return; }
  if(mod && !e.shiftKey && !e.altKey && (e.key === 'i' || e.key === 'ш')){ e.preventDefault(); wrapSel(ta, '*'); return; }
  if(e.key === 'Tab' && !mod && !e.altKey){
    e.preventDefault();
    const v = ta.value, a = ta.selectionStart, b = ta.selectionEnd;
    const ls = v.lastIndexOf('\n', a - 1) + 1;
    if(a === b && !e.shiftKey && !/^\s*([-*+]|\d+[.)])\s/.test(v.slice(ls))){ insertText(ta, '\t'); return; }
    let le = v.indexOf('\n', b - (b > a && v[b - 1] === '\n' ? 1 : 0));
    if(le < 0) le = v.length;
    const block = v.slice(ls, le);
    const nb = e.shiftKey ? block.replace(/^(\t| {1,4})/gm, '') : block.replace(/^/gm, '\t');
    ta.setSelectionRange(ls, le);
    insertText(ta, nb);
    const d0 = (e.shiftKey ? -(block.match(/^(\t| {1,4})/) || [''])[0].length : 1);
    ta.setSelectionRange(Math.max(ls, a + d0), ls + nb.length - (le - b));
    return;
  }
  if(e.key === 'Enter' && !e.shiftKey && !mod && !e.altKey && !e.isComposing){
    const v = ta.value, pos = ta.selectionStart;
    if(pos !== ta.selectionEnd) return;
    const ls = v.lastIndexOf('\n', pos - 1) + 1;
    const line = v.slice(ls, pos);
    const m = /^(\s*(?:>\s*)*)([-*+]|(\d+)([.)]))(\s+)(\[[ xX]\]\s+)?/.exec(line);
    if(!m) return;
    e.preventDefault();
    if(!line.slice(m[0].length).trim()){
      ta.setSelectionRange(ls, pos);
      insertText(ta, '');
      return;
    }
    const marker = m[3] ? (parseInt(m[3], 10) + 1) + m[4] : m[2];
    insertText(ta, '\n' + m[1] + marker + m[5] + (m[6] ? '[ ] ' : ''));
  }
}

function linkAtCaret(ta){
  const v = ta.value, pos = ta.selectionStart;
  const ls = v.lastIndexOf('\n', pos - 1) + 1;
  let le = v.indexOf('\n', pos);
  if(le < 0) le = v.length;
  const line = v.slice(ls, le);
  const re = new RegExp(WIKI_RE.source, 'g');
  let m;
  while((m = re.exec(line))){
    if(ls + m.index <= pos && pos <= ls + m.index + m[0].length) return {inner: m[2]};
  }
  const md = /\[[^\]]*\]\((https?:[^)\s]+)\)|(https?:\/\/[^\s)>\]]+)/g;
  while((m = md.exec(line))){
    if(ls + m.index <= pos && pos <= ls + m.index + m[0].length) return {url: m[1] || m[2]};
  }
  return null;
}

async function attachImages(list){
  const ta = $('#editor');
  const links = [];
  for(const f of list){
    const ext = ({'image/jpeg': 'jpg', 'image/svg+xml': 'svg'})[f.type] || (f.type.split('/')[1] || 'png');
    const base = f.name && !/^image\.\w+$/i.test(f.name) ? sanitizeName(f.name.replace(/\.[^.]+$/, '')) : 'Вставка ' + stamp();
    const path = uniquePath('Вложения', base || 'Вставка', '.' + ext);
    try { await createFile(path, f); } catch(e){ toast('Картинка не сохранилась: ' + e.message); continue; }
    links.push('![[' + linkTextFor(S.idx, path) + ']]');
  }
  if(links.length) insertText(ta, links.join('\n'));
}

/* ================= граф ================= */
function openGraph(){
  flushSave();
  showView('graph');
  if(!S.graph){
    S.graph = new GraphView($('#graph'), {onOpen: n => {
      if(n.kind === 'note') navigate(n.id);
      else if(n.kind === 'ghost') createFromTarget(n.target);
      else if(n.kind === 'tag') searchFor('#' + n.tag);
    }});
  }
  for(const b of $$('[data-graph-scope]')) b.classList.toggle('on', b.dataset.graphScope === S.gscope);
  $('#gdepth-wrap').hidden = S.gscope !== 'local';
  requestAnimationFrame(() => { S.graph.resize(); updateGraph(true); renderRight(); });
  closeDrawers();
}
function graphData(){
  const showTags = $('#g-tags').checked, showGhost = $('#g-ghost').checked, showOrph = $('#g-orphans').checked;
  const filt = $('#g-filter').value.trim().toLowerCase();
  const nodes = new Map(), links = [];
  for(const [p, f] of S.files) if(f.type === 'md') nodes.set(p, {id: p, label: noteName(p), kind: 'note'});
  for(const [p, f] of S.files){
    if(f.type !== 'md') continue;
    for(const l of f.parsed.links){
      if(!l.target) continue;
      const r = resolveLink(S.idx, l.target, p);
      if(r){ if(S.files.get(r).type === 'md') links.push([p, r]); }
      else if(showGhost){
        const gid = 'ghost:' + l.target.toLowerCase();
        if(!nodes.has(gid)) nodes.set(gid, {id: gid, label: l.target, kind: 'ghost', target: l.target});
        links.push([p, gid]);
      }
    }
    if(showTags){
      for(const t of new Set(f.parsed.tags.map(x => x.toLowerCase()))){
        const tid = 'tag:' + t;
        if(!nodes.has(tid)) nodes.set(tid, {id: tid, label: '#' + t, kind: 'tag', tag: t});
        links.push([p, tid]);
      }
    }
  }
  let keep = new Set(nodes.keys());
  if(S.gscope === 'local' && S.cur && nodes.has(S.cur)){
    const adj = new Map();
    for(const [a, b] of links){
      (adj.get(a) || adj.set(a, []).get(a)).push(b);
      (adj.get(b) || adj.set(b, []).get(b)).push(a);
    }
    const depth = +$('#gdepth').value || 2;
    keep = new Set([S.cur]);
    let front = [S.cur];
    for(let d = 0; d < depth; d++){
      const next = [];
      for(const id of front) for(const n of (adj.get(id) || [])) if(!keep.has(n)){ keep.add(n); next.push(n); }
      front = next;
    }
  }
  if(filt) keep = new Set(Array.from(keep).filter(id => nodes.get(id).label.toLowerCase().indexOf(filt) >= 0 || id === S.cur));
  const ls = links.filter(([a, b]) => keep.has(a) && keep.has(b));
  if(!showOrph){
    const deg = new Set();
    ls.forEach(([a, b]) => { deg.add(a); deg.add(b); });
    keep = new Set(Array.from(keep).filter(id => deg.has(id) || id === S.cur));
  }
  return {nodes: Array.from(keep).map(id => nodes.get(id)), links: ls};
}
function updateGraph(fit){
  if(!S.graph) return;
  const {nodes, links} = graphData();
  S.graph.setData(nodes, links, S.cur, fit);
}

/* ================= хранилище: меню, экспорт, импорт ================= */
async function exportZip(){
  if(!S.vault) return;
  await flushSave();
  toast('Собираю архив…');
  const entries = [];
  for(const [p, f] of S.files){
    try {
      if(f.type === 'md') entries.push({path: p, data: f.text || ''});
      else if(f.type === 'img') entries.push({path: p, data: await S.vault.read(p)});
    } catch(e){ /* недоступный файл пропускаем */ }
  }
  const blob = await makeZip(entries);
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = 'mindbutter-' + todayKey() + '.zip';
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 5000);
  toast('Архив: ' + entries.length + ' ' + plural(entries.length, 'файл', 'файла', 'файлов'));
}
async function importFiles(fileList){
  let n = 0, renamed = 0;
  for(const file of fileList){
    const parts = (file.webkitRelativePath || file.name).split('/');
    if(parts.length > 1) parts.shift();
    if(parts.some(s => s.charAt(0) === '.')) continue;
    let path = parts.map(sanitizeName).join('/');
    const type = typeOf(path);
    if(!type) continue;
    if(existsCI(path)){
      const ext = '.' + extOf(path);
      path = uniquePath(parentOf(path), baseOf(path).slice(0, -ext.length), ext);
      renamed++;
    }
    try {
      const data = type === 'md' ? await file.text() : file;
      const mtime = await S.vault.write(path, data);
      addFileRec({path, type, mtime, text: type === 'md' ? data : undefined});
      n++;
    } catch(e){ /* пропускаем битый файл, продолжаем */ }
  }
  reindex();
  refreshAll();
  GHSync.soon();
  toast('Добавлено: ' + n + (renamed ? ' · с новым именем из-за совпадений: ' + renamed : ''), 4000);
}
function vaultMenu(btn){
  const r = btn.getBoundingClientRect();
  const items = [
    {label: S.vault ? (S.vault.kind === 'folder' ? 'Папка: ' + S.vault.name : 'Хранится в этом браузере') : 'Хранилище не выбрано', disabled: true},
    {label: 'Скачать всё в zip', run: exportZip},
    {label: 'Добавить заметки из папки…', run: () => $('#import-input').click()},
    {label: 'Синхронизация с GitHub…', run: () => GHSync.openSettings()},
    {label: 'Перечитать хранилище', run: () => rescan(false)},
    {label: 'Инструкция', run: () => Guide.open(0)},
    '-',
    {label: 'Сменить хранилище…', run: async () => { await flushSave(); showStart(); }},
  ];
  if(window.SLUDA_DEMO){
    items.splice(0, items.length,
      {label: 'Демо: заметки хранятся только в этом браузере', disabled: true},
      {label: 'Добавить заметки из папки…', run: () => $('#import-input').click()},
      {label: 'Инструкция', run: () => Guide.open(0)});
  }
  showMenu(items, r.right + 6, Math.max(8, r.bottom - 210));
}

/* изменения снаружи (например, правка той же папки в другой программе) подхватываем при возврате в окно */
async function rescan(quiet){
  if(!S.vault || S.rescanning) return;
  S.rescanning = true;
  try {
    await flushSave();
    const list = S.vault.kind === 'folder' ? await S.vault.stat() : await S.vault.scan();
    const seen = new Set();
    let changed = false;
    for(const r of list){
      seen.add(r.path);
      const f = S.files.get(r.path);
      if(f && (r.type !== 'md' || r.mtime === f.mtime)) continue;
      if(r.type === 'md' && r.text === undefined) r.text = await S.vault.read(r.path);
      changed = true;
      if(!f){ addFileRec(r); continue; }
      f.text = r.text; f.mtime = r.mtime; f.parsed = parseNote(r.text);
      if(r.path === S.cur && !S.dirty){
        const ed = $('#editor'), s = ed.selectionStart;
        ed.value = r.text;
        ed.setSelectionRange(Math.min(s, r.text.length), Math.min(s, r.text.length));
        if(S.mode === 'read' && S.view === 'note') renderPreview();
      }
    }
    for(const p of Array.from(S.files.keys())) if(!seen.has(p)){ S.files.delete(p); changed = true; }
    if(changed){
      reindex();
      if(S.cur && !S.files.has(S.cur)){ S.cur = null; S.curType = null; showView('empty'); }
      refreshAll();
    }
    if(!quiet) toast(changed ? 'Обновлено' : 'Изменений нет');
  } catch(e){
    if(!quiet) toast('Не удалось перечитать: ' + e.message);
  } finally { S.rescanning = false; }
}

/* ================= окна ввода и подтверждения (системные prompt/confirm работают не везде) ================= */
let dialogDone = null;
function openDialog(message, opts){
  if(dialogDone) dialogDone(null);
  hideMenu();
  $('#dlg-msg').textContent = message;
  const inp = $('#dlg-input'), ok = $('#dlg-ok');
  inp.hidden = !opts.input;
  inp.value = opts.value || '';
  ok.textContent = opts.ok;
  ok.classList.toggle('danger', !!opts.danger);
  $('#dialog').hidden = false;
  setTimeout(() => { if(opts.input){ inp.focus(); inp.select(); } else ok.focus(); }, 0);
  return new Promise(res => { dialogDone = res; });
}
function closeDialog(v){
  $('#dialog').hidden = true;
  const done = dialogDone;
  dialogDone = null;
  if(done) done(v);
}
function askText(message, value){ return openDialog(message, {input: true, value, ok: 'Готово'}); }
function askConfirm(message, ok){ return openDialog(message, {ok: ok || 'Удалить', danger: true}).then(v => v === true); }

/* ================= меню ================= */
function showMenu(items, x, y){
  const m = $('#menu');
  S.menuItems = items;
  m.innerHTML = items.map((it, i) => it === '-' ? '<div class="menu-sep"></div>'
    : '<button class="menu-i' + (it.danger ? ' danger' : '') + (it.disabled ? ' label' : '') + '" data-i="' + i + '"' + (it.disabled ? ' disabled' : '') + '>' + escHtml(it.label) + '</button>'
  ).join('');
  m.hidden = false;
  const w = m.offsetWidth, h = m.offsetHeight;
  m.style.left = Math.max(8, Math.min(x, window.innerWidth - w - 8)) + 'px';
  m.style.top = Math.max(8, Math.min(y, window.innerHeight - h - 8)) + 'px';
}
function hideMenu(){ $('#menu').hidden = true; S.menuItems = null; }
function treeMenu(el, x, y){
  const items = [];
  if(!el){
    items.push({label: 'Новая заметка', run: () => newNote('')}, {label: 'Новая папка', run: () => newFolder('')});
  } else {
    const p = el.dataset.path;
    if(el.classList.contains('dir')){
      items.push({label: 'Новая заметка здесь', run: () => newNote(p)}, {label: 'Новая папка здесь', run: () => newFolder(p)}, '-',
        {label: 'Переименовать', run: () => renameAsk(p)}, {label: 'Удалить папку', danger: true, run: () => deletePath(p)});
    } else {
      items.push({label: 'Открыть', run: () => navigate(p)}, {label: 'Переименовать', run: () => renameAsk(p)},
        {label: 'Удалить', danger: true, run: () => deletePath(p)});
    }
  }
  showMenu(items, x, y);
}

/* ================= тема ================= */
function syncThemeIcon(){
  const b = $('[data-cmd="theme"]');
  if(b) setIcon(b, document.documentElement.dataset.theme === 'dark' ? 'sun' : 'moon');
}
function toggleTheme(){
  const t = document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark';
  document.documentElement.dataset.theme = t;
  try { localStorage.setItem('mindbutter.theme', t); } catch(e){}
  const m = document.querySelector('meta[name=theme-color]');
  if(m) m.content = t === 'dark' ? '#1c1e23' : '#f7f7f3';
  syncThemeIcon();
  if(S.graph && S.view === 'graph') S.graph.redraw();
}

/* ================= команды и события ================= */
const CMD = {
  'pane-files': () => setPane('files'),
  'pane-search': () => setPane('search'),
  'pane-tags': () => setPane('tags'),
  switcher: openSwitcher,
  graph: () => { if(S.vault) location.hash = 'graph'; },
  daily: dailyNote,
  theme: toggleTheme,
  'vault-menu': (b) => vaultMenu(b),
  'new-note': () => newNote(),
  'new-folder': () => newFolder(),
  'collapse-all': () => {
    for(const [p, f] of S.files) if(f.type === 'dir') S.collapsed.add(p);
    for(const p of S.files.keys()){ let d = parentOf(p); while(d){ S.collapsed.add(d); d = parentOf(d); } }
    saveCollapsed(); renderTree();
  },
  rescan: () => rescan(false),
  'toggle-left': () => {
    if(!isNarrow()){
      const c = $('#app').classList.toggle('left-collapsed');
      LS.set('leftCollapsed', c);
      return;
    }
    const open = !$('#leftwrap').classList.contains('open');
    closeDrawers();
    if(open){ $('#leftwrap').classList.add('open'); $('#backdrop').hidden = false; }
  },
  'mode-edit': () => setMode('edit'),
  'mode-read': () => setMode('read'),
  guide: () => Guide.open(0),
  'toggle-right': toggleRight,
  'toggle-mode': toggleMode,
  back: () => history.back(),
  forward: () => history.forward(),
};

function bindUI(){
  document.addEventListener('click', e => {
    const menuBtn = e.target.closest('.menu-i');
    if(menuBtn && S.menuItems){
      const it = S.menuItems[+menuBtn.dataset.i];
      hideMenu();
      if(it && it.run) it.run();
      return;
    }
    if(!e.target.closest('#menu')) hideMenu();
    if(!e.target.closest('#suggest') && !e.target.closest('#editor')) hideSuggest();

    const cmd = e.target.closest('[data-cmd]');
    if(cmd && CMD[cmd.dataset.cmd]){ CMD[cmd.dataset.cmd](cmd); return; }

    const link = e.target.closest('a.internal-link');
    if(link){ e.preventDefault(); followLink(link.dataset.href || ''); return; }
    const tag = e.target.closest('a.tag');
    if(tag){ e.preventDefault(); searchFor('#' + tag.dataset.tag); return; }
    const tagRow = e.target.closest('[data-tagq]');
    if(tagRow){ searchFor('#' + tagRow.dataset.tagq); return; }

    const open = e.target.closest('[data-open]');
    if(open){
      if(open.dataset.find) S.pendingFind = open.dataset.find;
      navigate(open.dataset.open);
      closeDrawers();
      return;
    }
    const create = e.target.closest('[data-create]');
    if(create){ createFromTarget(create.dataset.create); return; }
    const hd = e.target.closest('[data-heading]');
    if(hd){ scrollToHeading(hd.dataset.heading); closeDrawers(); return; }
    const sg = e.target.closest('.sg-i');
    if(sg){ acceptSuggest(+sg.dataset.i); return; }
    const sw = e.target.closest('.sw-i');
    if(sw){ pickSwitcher(+sw.dataset.i); return; }
    if(e.target.id === 'switcher') closeSwitcher();
  });

  /* чекбоксы задач в режиме чтения */
  $('#preview').addEventListener('change', e => {
    const b = e.target;
    if(b.type !== 'checkbox' || b.dataset.line === undefined) return;
    const ed = $('#editor');
    ed.value = toggleTaskLine(ed.value, +b.dataset.line);
    markDirty();
  });
  $('#preview').addEventListener('keydown', e => {
    if(e.key !== 'Enter') return;
    const l = e.target.closest('a.internal-link'), t = e.target.closest('a.tag');
    if(l){ e.preventDefault(); followLink(l.dataset.href || ''); }
    else if(t){ e.preventDefault(); searchFor('#' + t.dataset.tag); }
  });

  /* дерево */
  const tree = $('#tree');
  tree.addEventListener('click', e => {
    const el = e.target.closest('.ti');
    if(!el) return;
    const p = el.dataset.path;
    if(el.classList.contains('dir')){
      S.collapsed.has(p) ? S.collapsed.delete(p) : S.collapsed.add(p);
      S.selectedFolder = p;
      saveCollapsed(); renderTree(); highlightTree();
    } else navigate(p);
  });
  tree.addEventListener('contextmenu', e => {
    e.preventDefault();
    treeMenu(e.target.closest('.ti'), e.clientX, e.clientY);
  });
  let dragPath = null;
  tree.addEventListener('dragstart', e => {
    const el = e.target.closest('.ti');
    if(!el) return;
    dragPath = el.dataset.path;
    e.dataTransfer.setData('text/plain', dragPath);
    e.dataTransfer.effectAllowed = 'move';
  });
  const dropDir = e => {
    const el = e.target.closest('.ti');
    if(!el) return '';
    return el.classList.contains('dir') ? el.dataset.path : parentOf(el.dataset.path);
  };
  tree.addEventListener('dragover', e => {
    if(!dragPath) return;
    e.preventDefault();
    $$('#tree .drop').forEach(x => x.classList.remove('drop'));
    const el = e.target.closest('.ti.dir');
    if(el) el.classList.add('drop'); else tree.classList.add('drop');
  });
  tree.addEventListener('dragleave', e => { if(e.target === tree) tree.classList.remove('drop'); });
  tree.addEventListener('drop', async e => {
    e.preventDefault();
    $$('#tree .drop').forEach(x => x.classList.remove('drop'));
    tree.classList.remove('drop');
    const src = dragPath;
    dragPath = null;
    if(!src) return;
    const dir = dropDir(e);
    if(dir === parentOf(src)) return;
    await renamePath(src, joinPath(dir, baseOf(src)));
  });
  tree.addEventListener('dragend', () => { dragPath = null; tree.classList.remove('drop'); });

  /* редактор */
  const ed = $('#editor');
  ed.addEventListener('input', onEditorInput);
  ed.addEventListener('keydown', editorKeydown);
  ed.addEventListener('click', e => {
    hideSuggest();
    if(!(e.ctrlKey || e.metaKey)) return;
    const l = linkAtCaret(ed);
    if(!l) return;
    if(l.inner) followLink(l.inner);
    else if(l.url) window.open(l.url, '_blank', 'noopener');
  });
  ed.addEventListener('blur', () => { setTimeout(() => { if(document.activeElement !== ed) hideSuggest(); }, 150); flushSave(); });
  ed.addEventListener('scroll', () => { if(S.sug) checkSuggest(); });
  ed.addEventListener('paste', e => {
    const imgs = Array.from((e.clipboardData && e.clipboardData.files) || []).filter(f => /^image\//.test(f.type));
    if(!imgs.length) return;
    e.preventDefault();
    attachImages(imgs);
  });
  ed.addEventListener('dragover', e => { if(e.dataTransfer && Array.from(e.dataTransfer.types).indexOf('Files') >= 0) e.preventDefault(); });
  ed.addEventListener('drop', e => {
    const imgs = Array.from((e.dataTransfer && e.dataTransfer.files) || []).filter(f => /^image\//.test(f.type));
    if(!imgs.length) return;
    e.preventDefault();
    attachImages(imgs);
  });

  /* название = имя файла */
  const title = $('#title');
  title.addEventListener('keydown', e => {
    if(e.key === 'Enter'){ e.preventDefault(); $('#editor').hidden ? title.blur() : $('#editor').focus(); }
    if(e.key === 'Escape'){ title.value = S.cur ? noteName(S.cur) : ''; title.blur(); }
  });
  title.addEventListener('change', renameFromTitle);

  /* поиск */
  let st = 0;
  $('#search-input').addEventListener('input', e => { clearTimeout(st); st = setTimeout(() => runSearch(e.target.value), 150); });

  /* быстрый переход */
  const swi = $('#sw-input');
  swi.addEventListener('input', renderSwitcher);
  swi.addEventListener('keydown', e => {
    if(!S.sw) return;
    const n = S.sw.items.length;
    if(e.key === 'ArrowDown' || e.key === 'ArrowUp'){
      e.preventDefault();
      if(n){ S.sw.sel = (S.sw.sel + (e.key === 'ArrowDown' ? 1 : n - 1)) % n; drawSwitcher(); }
    } else if(e.key === 'Enter'){
      e.preventDefault();
      pickSwitcher(S.sw.sel, e.shiftKey);
    } else if(e.key === 'Escape'){ e.preventDefault(); closeSwitcher(); }
  });

  /* граф */
  for(const b of $$('[data-graph-scope]')){
    b.addEventListener('click', () => {
      S.gscope = b.dataset.graphScope;
      LS.set('gscope', S.gscope);
      for(const x of $$('[data-graph-scope]')) x.classList.toggle('on', x === b);
      $('#gdepth-wrap').hidden = S.gscope !== 'local';
      updateGraph(true);
    });
  }
  ['#gdepth', '#g-tags', '#g-ghost', '#g-orphans'].forEach(s => $(s).addEventListener('change', updateGraph));
  let gf = 0;
  $('#g-filter').addEventListener('input', () => { clearTimeout(gf); gf = setTimeout(updateGraph, 200); });

  /* выбор хранилища */
  $('#start-folder').addEventListener('click', chooseFolder);
  $('#start-browser').addEventListener('click', chooseBrowser);
  $('#import-input').addEventListener('change', e => {
    const files = Array.from(e.target.files || []);
    e.target.value = '';
    if(files.length) importFiles(files);
  });

  $('#backdrop').addEventListener('click', closeDrawers);
  $('#dlg-form').addEventListener('submit', e => {
    e.preventDefault();
    closeDialog($('#dlg-input').hidden ? true : $('#dlg-input').value);
  });
  $('#dlg-cancel').addEventListener('click', () => closeDialog(null));
  $('#dialog').addEventListener('click', e => { if(e.target.id === 'dialog') closeDialog(null); });
  window.addEventListener('hashchange', route);
  window.addEventListener('focus', () => { if(S.vault && S.vault.kind === 'folder') rescan(true); });
  document.addEventListener('visibilitychange', () => { if(document.hidden) flushSave(); });
  window.addEventListener('beforeunload', e => {
    if(S.dirty){ flushSave(); e.preventDefault(); e.returnValue = ''; }
  });
  window.addEventListener('resize', () => { hideSuggest(); hideMenu(); });

  /* горячие клавиши */
  document.addEventListener('keydown', e => {
    const mod = IS_MAC ? e.metaKey : e.ctrlKey;
    const k = e.key.toLowerCase();
    const code = e.code;
    if(!$('#dialog').hidden){ if(e.key === 'Escape'){ e.preventDefault(); closeDialog(null); } return; }
    if(Guide.isOpen()){ Guide.key(e); return; }
    if(!$('#sync').hidden){ if(e.key === 'Escape'){ e.preventDefault(); GHSync.closeSettings(); } return; }
    if(e.key === 'Escape'){
      if(!$('#switcher').hidden){ closeSwitcher(); return; }
      if(!$('#menu').hidden){ hideMenu(); return; }
      closeDrawers();
      return;
    }
    if(!S.vault || !$('#start').hidden) return;
    if(mod && !e.shiftKey && code === 'KeyO'){ e.preventDefault(); openSwitcher(); return; }
    if(mod && !e.shiftKey && code === 'KeyP'){ e.preventDefault(); openSwitcher(); return; }
    if(mod && !e.shiftKey && code === 'KeyN'){ e.preventDefault(); newNote(); return; }
    if(mod && !e.shiftKey && code === 'KeyE'){ e.preventDefault(); toggleMode(); return; }
    if(mod && !e.shiftKey && code === 'KeyG'){ e.preventDefault(); location.hash = 'graph'; return; }
    if(mod && !e.shiftKey && code === 'KeyS'){ e.preventDefault(); flushSave().then(() => toast('Сохранено')); return; }
    if(mod && e.shiftKey && code === 'KeyF'){ e.preventDefault(); setPane('search'); openLeftDrawer(); return; }
    if(e.altKey && !mod && (k === 'arrowleft' || k === 'arrowright')){
      const editing = /^(TEXTAREA|INPUT)$/.test(document.activeElement && document.activeElement.tagName);
      if(IS_MAC && editing) return;
      e.preventDefault();
      k === 'arrowleft' ? history.back() : history.forward();
    }
  });
}

/* ================= приветственные заметки ================= */
const WELCOME = {
  'Добро пожаловать.md':
`# Добро пожаловать в MindButter

MindButter — заметки в обычных файлах markdown, связанные ссылками. Ссылки, обратные ссылки, теги и граф.

> [!tip] Инструкция с картинками и озвучкой
> Кнопка «?» в ленте слева (на телефоне — в меню ☰).

## С чего начать
- [[Ссылки]] — главное, ради чего всё это.
- [[Теги и поиск]] и [[Граф]].
- [[Горячие клавиши]] — когда освоишься.
- [[Хранение и GitHub]] — где лежат заметки и как их не потерять.

## Два режима
**Правка** — пишешь markdown. **Чтение** — видишь оформленный текст и кликаешь по ссылкам. Переключатель «Правка | Чтение» — вверху справа, или \`Ctrl+E\`.

> [!tip] Попробуй сразу
> Напиши где-нибудь [[Моя первая мысль]], перейди в чтение и кликни по ссылке. Заметка создастся сама.

#старт
`,
  'Ссылки.md':
`# Ссылки

Ссылка на другую заметку — название в двойных квадратных скобках: [[Граф]]. Набери \`[[\` — появится подсказка с названиями.

## Виды ссылок
- Свой текст вместо названия: [[Граф|картинка связей]].
- На заголовок внутри заметки: [[Добро пожаловать#Два режима]].
- Вставить кусок другой заметки целиком — восклицательный знак перед ссылкой:

![[Горячие клавиши#Навигация]]

## Обратные ссылки
Кнопка «Связи» вверху справа показывает, **кто ссылается на эту заметку**. Открой [[Граф]] — там в обратных ссылках будет эта заметка.

## Переименование
Меняешь название в заголовке сверху — ссылки во всех заметках обновляются сами.

#старт
`,
  'Теги и поиск.md':
`# Теги и поиск

Тег — слово с решёткой: #идея, #проект/слюда. Вложенные теги пишутся через «/».

- Вкладка «Теги» — слева. Клик по тегу ищет все заметки с ним.
- Вкладка «Поиск» — там же, или \`Ctrl+Shift+F\`. Несколько слов — все должны встретиться.

## Задачи
- [x] Открыть MindButter
- [ ] Написать первую заметку
- [ ] Посмотреть на [[Граф]]

Галочки можно ставить прямо в режиме чтения. ==Выделение== — двумя знаками равенства.

#старт
`,
  'Граф.md':
`# Граф

Граф — картинка всех заметок и связей между ними. Открыть: кнопка «Граф» в ленте слева или \`Ctrl+G\`.

- **Весь граф** — все заметки.
- **Вокруг заметки** — только соседи текущей (глубина 1–3).
- Бледные точки — заметки, на которые есть ссылка, но которых ещё нет. Клик — создать.
- Можно показать теги точками.

Колесо мыши — масштаб, тянуть фон — сдвиг, тянуть точку — двигать её, клик — открыть.

#старт
`,
  'Горячие клавиши.md':
`# Горячие клавиши

На Mac вместо Ctrl — Cmd.

## Навигация
| Действие | Клавиши |
|---|---|
| Быстрый переход к заметке | Ctrl+O |
| Назад / вперёд | Alt+← / Alt+→ |
| Граф | Ctrl+G |
| Поиск | Ctrl+Shift+F |

## Правка
| Действие | Клавиши |
|---|---|
| Новая заметка | Ctrl+N |
| Чтение ↔ правка | Ctrl+E |
| Жирный / курсив | Ctrl+B / Ctrl+I |
| Открыть ссылку из правки | Ctrl + клик |
| Сохранить сейчас | Ctrl+S (сохраняется и само) |

В списке Enter продолжает пункт, Tab сдвигает вправо, Shift+Tab — влево.
`,
  'Хранение и GitHub.md':
`# Хранение и GitHub

> [!warning] Где лежат заметки
> Сейчас — **в этом браузере**. Если очистить данные сайта, заметки пропадут. Раз в неделю скачивай архив: кнопка «Хранилище» в ленте слева → «Скачать всё в zip».

## Два способа хранить
1. **В браузере** — работает везде, включая телефон.
2. **Папка на компьютере** — заметки становятся обычными файлами .md. Можно открыть и существующую папку Obsidian. Нужен Chrome, Edge или Яндекс Браузер на компьютере.

## Компьютер и телефон вместе
Синхронизация — через твой **приватный** репозиторий на GitHub: кнопка «Хранилище» → «Синхронизация с GitHub…». Там же короткая инструкция, как создать репозиторий и токен. На каждом устройстве вводишь одно и то же — и заметки ходят между ними сами.

Без этой настройки заметки никуда не уходят и остаются только на этом устройстве.
`,
};
async function seedWelcome(v){
  for(const [p, t] of Object.entries(WELCOME)) await v.write(p, t);
}

boot();
