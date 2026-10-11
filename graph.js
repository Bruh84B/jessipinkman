'use strict';
/* MindButter — граф связей. Свой физический движок на canvas: точки отталкиваются,
   связи тянут как пружины, всё слегка притягивается к центру. Без библиотек. */

class GraphView {
  constructor(canvas, opts){
    this.cv = canvas;
    this.ctx = canvas.getContext('2d');
    this.onOpen = opts.onOpen || (() => {});
    this.nodes = []; this.links = []; this.byId = new Map();
    this.scale = 1; this.tx = 0; this.ty = 0;
    this.alpha = 0; this.raf = 0;
    this.hover = null; this.drag = null; this.pan = null;
    this.pointers = new Map(); this.pinch = null;
    this.focusId = null;
    this._bind();
    this.ro = new ResizeObserver(() => this.resize());
    this.ro.observe(canvas);
  }

  resize(){
    const r = this.cv.getBoundingClientRect();
    this.w = r.width; this.h = r.height;
    this.dpr = window.devicePixelRatio || 1;
    this.cv.width = Math.max(1, Math.round(r.width * this.dpr));
    this.cv.height = Math.max(1, Math.round(r.height * this.dpr));
    this.draw();
  }

  /* nodes: [{id, label, kind:'note'|'ghost'|'tag'}], links: [[idA, idB]] */
  setData(nodes, links, focusId, fit){
    if(fit) this.autoFit = true;
    const old = this.byId;
    this.byId = new Map();
    this.focusId = focusId || null;
    this.nodes = nodes.map(n => {
      const o = old.get(n.id);
      const node = Object.assign({x: 0, y: 0, vx: 0, vy: 0, deg: 0, nb: new Set()}, n);
      if(o){ node.x = o.x; node.y = o.y; }
      else { const a = Math.random() * Math.PI * 2, r = 40 + Math.random() * 160; node.x = Math.cos(a) * r; node.y = Math.sin(a) * r; node.fresh = true; }
      this.byId.set(n.id, node);
      return node;
    });
    this.links = [];
    for(const [a, b] of links){
      const A = this.byId.get(a), B = this.byId.get(b);
      if(!A || !B || A === B || A.nb.has(B.id)) continue;
      A.nb.add(B.id); B.nb.add(A.id); A.deg++; B.deg++;
      this.links.push([A, B]);
    }
    /* новые точки ставим рядом с уже стоящим соседом — граф не «взрывается» при обновлении */
    for(const n of this.nodes){
      if(!n.fresh) continue;
      for(const id of n.nb){ const m = this.byId.get(id); if(m && !m.fresh){ n.x = m.x + (Math.random() - .5) * 40; n.y = m.y + (Math.random() - .5) * 40; break; } }
      delete n.fresh;
    }
    this.heat(1);
  }

  heat(a){ this.alpha = Math.max(this.alpha, a); if(!this.raf) this.raf = requestAnimationFrame(() => this._frame()); }
  redraw(){ if(!this.raf) this.raf = requestAnimationFrame(() => { this.raf = 0; this.draw(); }); }

  _frame(){
    this.raf = 0;
    if(this.alpha > 0.004){ this._tick(); this._tick(); this.alpha *= 0.975; }
    /* один раз после открытия: когда точки почти встали, вписываем граф в экран */
    if(this.autoFit && this.alpha < 0.12){ this.autoFit = false; this.center(); }
    this.draw();
    if(this.alpha > 0.004 || this.drag) this.raf = requestAnimationFrame(() => this._frame());
  }

  _tick(){
    const N = this.nodes, k = this.alpha;
    for(let i = 0; i < N.length; i++){
      const a = N[i];
      for(let j = i + 1; j < N.length; j++){
        const b = N[j];
        let dx = b.x - a.x, dy = b.y - a.y, d2 = dx * dx + dy * dy;
        if(d2 > 360000) continue;
        if(d2 < 1){ dx = Math.random() - .5; dy = Math.random() - .5; d2 = 1; }
        const d = Math.sqrt(d2), f = 2600 * k / d2;
        const fx = dx / d * f, fy = dy / d * f;
        a.vx -= fx; a.vy -= fy; b.vx += fx; b.vy += fy;
      }
    }
    for(const [a, b] of this.links){
      const dx = b.x - a.x, dy = b.y - a.y, d = Math.sqrt(dx * dx + dy * dy) || 1;
      const f = (d - 95) * 0.04 * k;
      const fx = dx / d * f, fy = dy / d * f;
      a.vx += fx; a.vy += fy; b.vx -= fx; b.vy -= fy;
    }
    for(const n of N){
      n.vx -= n.x * 0.004 * k; n.vy -= n.y * 0.004 * k;
      if(n === this.drag){ n.vx = n.vy = 0; continue; }
      n.vx *= 0.6; n.vy *= 0.6;
      n.x += n.vx; n.y += n.vy;
    }
  }

  radius(n){ return n.kind === 'tag' ? 3.5 : 3.5 + Math.min(9, Math.sqrt(n.deg) * 1.8); }

  draw(){
    const c = this.ctx, css = getComputedStyle(this.cv);
    const col = name => css.getPropertyValue(name).trim();
    const C = {line: col('--g-line'), lineHi: col('--accent'), node: col('--g-node'), ghost: col('--g-ghost'),
      tag: col('--g-tag'), focus: col('--accent'), text: col('--text'), bg: col('--bg')};
    c.setTransform(1, 0, 0, 1, 0, 0);
    c.clearRect(0, 0, this.cv.width, this.cv.height);
    const s = this.scale * this.dpr;
    c.setTransform(s, 0, 0, s, (this.w / 2 + this.tx) * this.dpr, (this.h / 2 + this.ty) * this.dpr);
    const hv = this.hover || this.drag;
    const lit = hv ? hv.nb : null;

    c.lineWidth = 1 / this.scale;
    for(const [a, b] of this.links){
      const on = hv && (a === hv || b === hv);
      c.globalAlpha = hv ? (on ? 0.9 : 0.12) : 0.55;
      c.strokeStyle = on ? C.lineHi : C.line;
      c.beginPath(); c.moveTo(a.x, a.y); c.lineTo(b.x, b.y); c.stroke();
    }
    for(const n of this.nodes){
      const on = !hv || n === hv || lit.has(n.id);
      c.globalAlpha = on ? 1 : 0.18;
      c.fillStyle = n.id === this.focusId || n === hv ? C.focus : n.kind === 'ghost' ? C.ghost : n.kind === 'tag' ? C.tag : C.node;
      c.beginPath(); c.arc(n.x, n.y, this.radius(n), 0, Math.PI * 2); c.fill();
    }
    /* подписи: при крупном масштабе — все, при мелком — только подсвеченные */
    const fs = 11;
    c.font = fs + 'px system-ui, -apple-system, "Segoe UI", sans-serif';
    c.textAlign = 'center'; c.textBaseline = 'top';
    const showAll = this.scale * fs >= 8.5;
    for(const n of this.nodes){
      const on = !hv || n === hv || lit.has(n.id);
      if(!(showAll || (hv && on) || n.id === this.focusId)) continue;
      c.globalAlpha = on ? (n.kind === 'ghost' ? 0.6 : 0.9) : 0.12;
      c.fillStyle = C.text;
      c.fillText(n.label, n.x, n.y + this.radius(n) + 3);
    }
    c.globalAlpha = 1;
  }

  toWorld(sx, sy){ return {x: (sx - this.w / 2 - this.tx) / this.scale, y: (sy - this.h / 2 - this.ty) / this.scale}; }
  hit(sx, sy){
    const p = this.toWorld(sx, sy);
    let best = null, bd = Infinity;
    for(const n of this.nodes){
      const d = Math.hypot(n.x - p.x, n.y - p.y), r = this.radius(n) + 5 / this.scale;
      if(d < r && d < bd){ best = n; bd = d; }
    }
    return best;
  }
  zoomAt(sx, sy, f){
    const ns = Math.min(5, Math.max(0.15, this.scale * f));
    const p = this.toWorld(sx, sy);
    this.scale = ns;
    this.tx = sx - this.w / 2 - p.x * ns;
    this.ty = sy - this.h / 2 - p.y * ns;
    this.redraw();
  }
  center(){
    if(!this.nodes.length) return;
    let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
    for(const n of this.nodes){ x0 = Math.min(x0, n.x); y0 = Math.min(y0, n.y); x1 = Math.max(x1, n.x); y1 = Math.max(y1, n.y); }
    const s = Math.min(1.6, Math.max(0.2, Math.min((this.w - 80) / Math.max(1, x1 - x0), (this.h - 80) / Math.max(1, y1 - y0))));
    this.scale = s; this.tx = -(x0 + x1) / 2 * s; this.ty = -(y0 + y1) / 2 * s;
    this.redraw();
  }

  _bind(){
    const cv = this.cv;
    const pos = e => { const r = cv.getBoundingClientRect(); return {x: e.clientX - r.left, y: e.clientY - r.top}; };
    cv.addEventListener('pointerdown', e => {
      this.autoFit = false;
      cv.setPointerCapture(e.pointerId);
      const p = pos(e);
      this.pointers.set(e.pointerId, p);
      if(this.pointers.size === 2){
        const [a, b] = [...this.pointers.values()];
        this.pinch = {d: Math.hypot(a.x - b.x, a.y - b.y), s: this.scale};
        this.drag = null; this.pan = null; return;
      }
      const n = this.hit(p.x, p.y);
      this.down = {x: p.x, y: p.y, node: n, moved: false};
      if(n){ this.drag = n; this.heat(0.25); }
      else this.pan = {x: p.x, y: p.y, tx: this.tx, ty: this.ty};
    });
    cv.addEventListener('pointermove', e => {
      const p = pos(e);
      if(this.pointers.has(e.pointerId)) this.pointers.set(e.pointerId, p);
      if(this.pinch && this.pointers.size === 2){
        const [a, b] = [...this.pointers.values()];
        const d = Math.hypot(a.x - b.x, a.y - b.y);
        this.zoomAt((a.x + b.x) / 2, (a.y + b.y) / 2, (this.pinch.s * d / this.pinch.d) / this.scale);
        return;
      }
      if(this.down && Math.hypot(p.x - this.down.x, p.y - this.down.y) > 4) this.down.moved = true;
      if(this.drag){
        const w = this.toWorld(p.x, p.y);
        this.drag.x = w.x; this.drag.y = w.y;
        this.heat(0.25);
      } else if(this.pan){
        this.tx = this.pan.tx + p.x - this.pan.x; this.ty = this.pan.ty + p.y - this.pan.y;
        this.redraw();
      } else if(e.pointerType === 'mouse'){
        const n = this.hit(p.x, p.y);
        if(n !== this.hover){ this.hover = n; cv.style.cursor = n ? 'pointer' : 'grab'; this.redraw(); }
      }
    });
    const up = e => {
      this.pointers.delete(e.pointerId);
      if(this.pinch){ if(this.pointers.size < 2) this.pinch = null; this.down = null; return; }
      const d = this.down;
      this.down = null; this.drag = null; this.pan = null;
      if(d && d.node && !d.moved) this.onOpen(d.node);
      this.redraw();
    };
    cv.addEventListener('pointerup', up);
    cv.addEventListener('pointercancel', up);
    cv.addEventListener('pointerleave', () => { if(this.hover && !this.drag){ this.hover = null; this.redraw(); } });
    cv.addEventListener('wheel', e => {
      e.preventDefault();
      this.autoFit = false;
      const p = pos(e);
      this.zoomAt(p.x, p.y, Math.exp(-e.deltaY * (e.ctrlKey ? 0.01 : 0.0015)));
    }, {passive: false});
  }
}
