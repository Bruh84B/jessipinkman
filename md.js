'use strict';
/* Слюда — разбор заметок: [[ссылки]], #теги, заголовки, задачи; поиск файла по ссылке; рендер markdown. */

const WIKI_RE = /(!?)\[\[([^\[\]\n]+?)\]\]/g;
/* тег: после # буквы/цифры/_-/, и хотя бы одна не цифра (#2024 — не тег) */
const TAG_BODY = '[\\p{L}\\p{N}_\\-/]*[\\p{L}_][\\p{L}\\p{N}_\\-/]*';
const TAG_RE = new RegExp('(^|[\\s(,;])#(' + TAG_BODY + ')', 'gu');
const TASK_RE = /^((?:\s*>)*\s*(?:[-*+]|\d+[.)])\s+\[)( |x|X)(\])/;

function noteName(path){ return baseOf(path).replace(/\.md$/i, ''); }

/* код и frontmatter заменяем пробелами той же длины: ссылки и теги внутри них не считаются */
function maskCode(text){
  return text
    .replace(/^(`{3,}|~{3,})[^\n]*\n[\s\S]*?(?:^\1[^\n]*$|(?![\s\S]))/gm, m => m.replace(/[^\n]/g, ' '))
    .replace(/`[^`\n]+`/g, m => ' '.repeat(m.length));
}
function splitFrontmatter(text){
  const m = /^---\r?\n([\s\S]*?)\r?\n---[ \t]*(?:\r?\n|$)/.exec(text);
  return m ? {fm: m[1], body: text.slice(m[0].length), fmLen: m[0].length} : {fm: null, body: text, fmLen: 0};
}
function fmTags(fm){
  const out = [];
  const m = /^tags:[ \t]*(.*)$/m.exec(fm);
  if(!m) return out;
  if(m[1].trim()){
    m[1].replace(/[\[\]]/g, '').split(/[,\s]+/).forEach(t => { t = t.replace(/^#/, '').trim(); if(t) out.push(t); });
  } else {
    const rest = fm.slice(m.index + m[0].length).split('\n');
    for(const line of rest){
      const li = /^\s*-\s*(.+)$/.exec(line);
      if(!li){ if(line.trim()) break; else continue; }
      out.push(li[1].replace(/^#/, '').trim());
    }
  }
  return out;
}

function splitLink(inner){
  const bar = inner.indexOf('|');
  const left = bar < 0 ? inner : inner.slice(0, bar);
  const alias = bar < 0 ? '' : inner.slice(bar + 1).trim();
  const h = left.indexOf('#');
  return {
    target: (h < 0 ? left : left.slice(0, h)).trim(),
    sub: h < 0 ? '' : left.slice(h + 1).trim(),
    alias,
  };
}

function parseNote(text){
  const {fm, fmLen} = splitFrontmatter(text);
  const masked = maskCode(text.slice(fmLen));
  const links = [], tags = [], headings = [];
  let m;
  WIKI_RE.lastIndex = 0;
  while((m = WIKI_RE.exec(masked))){
    const l = splitLink(m[2]);
    l.embed = !!m[1];
    l.pos = m.index + fmLen;
    links.push(l);
  }
  TAG_RE.lastIndex = 0;
  while((m = TAG_RE.exec(masked))) tags.push(m[2]);
  if(fm) fmTags(fm).forEach(t => tags.push(t));
  const lines = masked.split('\n');
  for(let i = 0; i < lines.length; i++){
    const h = /^(#{1,6})\s+(.+?)\s*#*\s*$/.exec(lines[i]);
    if(h) headings.push({level: h[1].length, text: h[2], line: i + text.slice(0, fmLen).split('\n').length - 1});
  }
  return {links, tags, headings};
}

/* ---------- поиск файла по тексту ссылки (как в Obsidian: по имени, затем по пути) ---------- */
function buildIndex(files){
  const all = new Map(), names = new Map();
  for(const [path, f] of files){
    if(f.type === 'dir') continue;
    all.set(path.toLowerCase(), path);
    const add = k => { const a = names.get(k); a ? a.push(path) : names.set(k, [path]); };
    const b = baseOf(path).toLowerCase();
    add(b);
    if(f.type === 'md') add(b.replace(/\.md$/, ''));
  }
  return {all, names};
}

function resolveLink(idx, target, from){
  let t = String(target || '').trim().replace(/\\/g, '/').replace(/^\.?\//, '');
  if(!t) return from || null;
  const tl = t.toLowerCase();
  if(idx.all.has(tl)) return idx.all.get(tl);
  if(idx.all.has(tl + '.md')) return idx.all.get(tl + '.md');
  const fromDir = from ? parentOf(from).toLowerCase() : '';
  if(fromDir){
    const rel = fromDir + '/' + tl;
    if(idx.all.has(rel)) return idx.all.get(rel);
    if(idx.all.has(rel + '.md')) return idx.all.get(rel + '.md');
  }
  let cands;
  if(tl.indexOf('/') >= 0){
    cands = [];
    for(const [k, p] of idx.all) if(k.endsWith('/' + tl) || k.endsWith('/' + tl + '.md')) cands.push(p);
  } else {
    cands = idx.names.get(tl) || [];
  }
  if(!cands.length) return null;
  if(cands.length === 1) return cands[0];
  const same = cands.find(p => parentOf(p).toLowerCase() === fromDir);
  if(same) return same;
  return cands.slice().sort((a, b) => a.split('/').length - b.split('/').length || a.length - b.length)[0];
}

/* как сослаться на файл короче всего: по имени, если оно уникально, иначе по пути */
function linkTextFor(idx, path){
  const isMd = /\.md$/i.test(path);
  const name = isMd ? noteName(path) : baseOf(path);
  const c = idx.names.get(name.toLowerCase()) || [];
  if(c.length <= 1) return name;
  return isMd ? path.replace(/\.md$/i, '') : path;
}

function slugify(s){
  return String(s).toLowerCase().trim().replace(/[^\p{L}\p{N}\s-]/gu, '').replace(/\s+/g, '-');
}

/* фрагмент заметки от заголовка до следующего заголовка того же уровня или выше */
function extractSection(text, heading){
  const lines = text.split('\n');
  const want = heading.toLowerCase().trim();
  let start = -1, level = 0;
  for(let i = 0; i < lines.length; i++){
    const h = /^(#{1,6})\s+(.+?)\s*#*\s*$/.exec(lines[i]);
    if(!h) continue;
    if(start < 0){
      if(h[2].toLowerCase() === want){ start = i; level = h[1].length; }
    } else if(h[1].length <= level){
      return lines.slice(start, i).join('\n');
    }
  }
  return start < 0 ? null : lines.slice(start).join('\n');
}

/* ---------- рендер ---------- */
const RENDER = {idx: null, from: null};
function escHtml(s){
  return String(s).replace(/[&<>"']/g, c => ({'&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'}[c]));
}

const MD = new marked.Marked({gfm: true, breaks: true});
MD.use({
  extensions: [
    {
      name: 'wikilink', level: 'inline',
      start(src){ const i = src.indexOf('[['); if(i < 0) return; return i > 0 && src[i - 1] === '!' ? i - 1 : i; },
      tokenizer(src){
        const m = /^(!?)\[\[([^\[\]\n]+?)\]\]/.exec(src);
        if(m) return {type: 'wikilink', raw: m[0], embed: !!m[1], inner: m[2]};
      },
      renderer(t){
        if(t.embed) return '<span class="embed" data-embed="' + escHtml(t.inner) + '"></span>';
        const l = splitLink(t.inner);
        const ok = !l.target || (RENDER.idx && resolveLink(RENDER.idx, l.target, RENDER.from));
        const label = l.alias || (l.target ? l.target + (l.sub ? ' › ' + l.sub : '') : l.sub);
        return '<a class="internal-link' + (ok ? '' : ' unresolved') + '" data-href="' +
          escHtml(l.target + (l.sub ? '#' + l.sub : '')) + '" tabindex="0">' + escHtml(label) + '</a>';
      },
    },
    {
      name: 'tag', level: 'inline',
      start(src){
        const m = new RegExp('(^|[\\s(,;])#' + TAG_BODY, 'u').exec(src);
        return m ? m.index + m[1].length : undefined;
      },
      tokenizer(src){
        const m = new RegExp('^#(' + TAG_BODY + ')', 'u').exec(src);
        if(m) return {type: 'tag', raw: m[0], tag: m[1]};
      },
      renderer(t){ return '<a class="tag" data-tag="' + escHtml(t.tag) + '" tabindex="0">#' + escHtml(t.tag) + '</a>'; },
    },
    {
      name: 'mark', level: 'inline',
      start(src){ const i = src.indexOf('=='); return i < 0 ? undefined : i; },
      tokenizer(src){
        const m = /^==(?=\S)([\s\S]*?\S)==/.exec(src);
        if(m) return {type: 'mark', raw: m[0], tokens: this.lexer.inlineTokens(m[1])};
      },
      renderer(t){ return '<mark>' + this.parser.parseInline(t.tokens) + '</mark>'; },
    },
  ],
});

function renderMarkdown(text, idx, from){
  RENDER.idx = idx; RENDER.from = from;
  const {fm, body} = splitFrontmatter(text);
  let html = '';
  if(fm !== null) html += '<pre class="frontmatter">' + escHtml(fm) + '</pre>';
  html += MD.parse(body);
  return DOMPurify.sanitize(html, {ADD_ATTR: ['target', 'tabindex']});
}

/* после вставки в DOM: якоря заголовков, выноски > [!note], внешние ссылки */
function decorate(root){
  for(const h of root.querySelectorAll('h1,h2,h3,h4,h5,h6')) if(!h.id) h.id = 'h-' + slugify(h.textContent);
  for(const a of root.querySelectorAll('a[href]')){
    if(/^(https?:|mailto:)/i.test(a.getAttribute('href'))){ a.target = '_blank'; a.rel = 'noopener noreferrer'; }
  }
  for(const bq of root.querySelectorAll('blockquote')){
    const p = bq.firstElementChild;
    if(!p || p.tagName !== 'P' || !p.firstChild || p.firstChild.nodeType !== 3) continue;
    const m = /^\[!([\w-]+)\][+-]?[ \t]*([^\n]*)/.exec(p.firstChild.nodeValue);
    if(!m) continue;
    const type = m[1].toLowerCase();
    p.firstChild.nodeValue = p.firstChild.nodeValue.slice(m[0].length).replace(/^\n/, '');
    if(p.firstChild.nextSibling && p.firstChild.nextSibling.nodeName === 'BR' && !p.firstChild.nodeValue.trim()) p.firstChild.nextSibling.remove();
    if(!p.textContent.trim() && !p.querySelector('img,a,code')) p.remove();
    const title = document.createElement('div');
    title.className = 'callout-title';
    title.textContent = m[2] || CALLOUT_NAMES[type] || (type.charAt(0).toUpperCase() + type.slice(1));
    bq.insertBefore(title, bq.firstChild);
    bq.classList.add('callout');
    bq.dataset.callout = type;
  }
}
const CALLOUT_NAMES = {note: 'Заметка', info: 'Инфо', tip: 'Совет', warning: 'Внимание', danger: 'Опасно',
  todo: 'Сделать', question: 'Вопрос', quote: 'Цитата', example: 'Пример', success: 'Готово', bug: 'Ошибка', abstract: 'Кратко'};

/* номера строк с задачами — в порядке, в котором marked рисует чекбоксы */
function taskLines(text){
  const {fmLen} = splitFrontmatter(text);
  const masked = maskCode(text.slice(fmLen));
  const off = text.slice(0, fmLen).split('\n').length - 1;
  const out = [];
  masked.split('\n').forEach((l, i) => { if(TASK_RE.test(l)) out.push(i + off); });
  return out;
}
function toggleTaskLine(text, lineNo){
  const lines = text.split('\n');
  lines[lineNo] = lines[lineNo].replace(TASK_RE, (all, a, c, b) => a + (c === ' ' ? 'x' : ' ') + b);
  return lines.join('\n');
}

/* ---------- нечёткий поиск по названию ---------- */
function fuzzyScore(query, s){
  if(!query) return 1;
  const q = query.toLowerCase(), t = s.toLowerCase();
  const i = t.indexOf(q);
  if(i >= 0) return 1000 - i * 2 - (t.length - q.length) * 0.1 + (i === 0 || /[\s/_-]/.test(t[i - 1]) ? 50 : 0);
  let ti = 0, score = 0, run = 0;
  for(const ch of q){
    const j = t.indexOf(ch, ti);
    if(j < 0) return -1;
    run = j === ti ? run + 1 : 0;
    score += 10 + run * 5 - (j - ti) * 0.5;
    ti = j + 1;
  }
  return score;
}
