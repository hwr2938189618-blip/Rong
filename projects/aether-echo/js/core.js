/* ============================================================
 * core.js — 数学工具 / 输入 / 存档 / 摄像机
 * ============================================================ */
(function (g) {
  'use strict';
  const AE = (g.AE = g.AE || {});
  const TAU = Math.PI * 2;
  const clamp = function (v, a, b) { return v < a ? a : (v > b ? b : v); };
  const lerp = function (a, b, t) { return a + (b - a) * t; };
  const rnd = function (a, b) {
    if (a === undefined) return Math.random();
    if (b === undefined) return Math.random() * a;
    return a + Math.random() * (b - a);
  };
  const rndi = function (a, b) { return Math.floor(rnd(a, b + 1)); };
  const pick = function (arr) { return arr[Math.floor(Math.random() * arr.length)]; };
  const chance = function (p) { return Math.random() < p; };
  const d2 = function (x1, y1, x2, y2) { const dx = x2 - x1, dy = y2 - y1; return dx * dx + dy * dy; };
  const dist = function (x1, y1, x2, y2) { return Math.sqrt(d2(x1, y1, x2, y2)); };
  const norm = function (x, y) {
    const l = Math.hypot(x, y) || 1;
    return { x: x / l, y: y / l };
  };
  const angLerp = function (a, b, t) {
    let d = ((b - a + Math.PI) % TAU) - Math.PI;
    if (d < -Math.PI) d += TAU;
    return a + d * t;
  };
  const fmtTime = function (sec) {
    sec = Math.max(0, Math.floor(sec));
    const m = Math.floor(sec / 60), s = sec % 60;
    return (m < 10 ? '0' : '') + m + ':' + (s < 10 ? '0' : '') + s;
  };
  const fmtNum = function (n) {
    if (n >= 100000) return (n / 1000).toFixed(0) + 'k';
    if (n >= 1000) return (n / 1000).toFixed(1) + 'k';
    return '' + Math.floor(n);
  };
  const shuffle = function (arr) {
    for (let i = arr.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      const t = arr[i]; arr[i] = arr[j]; arr[j] = t;
    }
    return arr;
  };

  AE.U = {
    TAU: TAU, clamp: clamp, lerp: lerp, rnd: rnd, rndi: rndi, pick: pick,
    chance: chance, d2: d2, dist: dist, norm: norm, angLerp: angLerp,
    fmtTime: fmtTime, fmtNum: fmtNum, shuffle: shuffle
  };

  /* ---------- 每日挑战：日期 key / 哈希 / 可复现随机 ---------- */
  AE.mulberry32 = function (a) {
    const seed = a >>> 0;
    let s = seed;
    return function () {
      s |= 0; s = (s + 0x6D2B79F5) | 0;
      let t = Math.imul(s ^ (s >>> 15), 1 | s);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  };
  AE.dateKey = function () {
    const d = new Date();
    const m = d.getMonth() + 1, day = d.getDate();
    return d.getFullYear() + '-' + (m < 10 ? '0' : '') + m + '-' + (day < 10 ? '0' : '') + day;
  };
  AE.hashSeed = function (str) {
    let h = 2166136261;
    for (let i = 0; i < str.length; i++) {
      h ^= str.charCodeAt(i);
      h = Math.imul(h, 16777619);
    }
    return h >>> 0;
  };
  AE.RNG = {
    original: Math.random,
    seeded: false,
    set: function (seed) {
      if (!this.seeded) this.original = Math.random;
      Math.random = AE.mulberry32(seed);
      this.seeded = true;
    },
    restore: function () {
      if (this.seeded) Math.random = this.original;
      this.seeded = false;
    }
  };

  /* ============================================================
   * 输入
   * ============================================================ */
  const Input = {
    keys: {},
    pressed: {},
    mouse: { x: 0, y: 0, sx: 0, sy: 0, down: false, active: false, clicked: false },
    touch: { on: false, ox: 0, oy: 0, dx: 0, dy: 0, active: false },
    joy: { active: false, dx: 0, dy: 0, mag: 0 },
    ultPressed: false,
    enabled: true,

    init: function (canvas) {
      const self = this;
      const block = ['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'ShiftLeft', 'Tab'];
      g.addEventListener('keydown', function (e) {
        if (!self.keys[e.code]) self.pressed[e.code] = true;
        self.keys[e.code] = true;
        if (block.indexOf(e.code) >= 0) e.preventDefault();
      });
      g.addEventListener('keyup', function (e) { self.keys[e.code] = false; });
      g.addEventListener('blur', function () { self.keys = {}; self.joy.active = false; self.joy.mag = 0; });

      const rect = function () { const r = canvas.getBoundingClientRect(); return r; };
      g.addEventListener('mousemove', function (e) {
        const r = rect();
        self.mouse.sx = e.clientX - r.left;
        self.mouse.sy = e.clientY - r.top;
        self.mouse.active = true;
        self.touch.on = false;
      });
      g.addEventListener('mousedown', function (e) {
        if (e.button === 0) { self.mouse.down = true; self.mouse.clicked = true; }
      });
      g.addEventListener('mouseup', function (e) { if (e.button === 0) self.mouse.down = false; });

      canvas.addEventListener('touchstart', function (e) {
        self.touch.on = true;
        self.mouse.active = false;
        if (AE.UI && AE.UI.syncDash) AE.UI.syncDash();
        const r = rect();
        for (let i = 0; i < e.changedTouches.length; i++) {
          const t = e.changedTouches[i];
          const x = t.clientX - r.left, y = t.clientY - r.top;
          if (!self.joy.active && x < r.width * 0.55) {
            self.joy.active = true; self.joy.dx = 0; self.joy.dy = 0; self.joy.mag = 0;
            self.touch.ox = x; self.touch.oy = y; self.touch.dx = x; self.touch.dy = y;
            self.touch.active = true;
          }
        }
        e.preventDefault();
      }, { passive: false });

      canvas.addEventListener('touchmove', function (e) {
        const r = rect();
        for (let i = 0; i < e.changedTouches.length; i++) {
          const t = e.changedTouches[i];
          const x = t.clientX - r.left, y = t.clientY - r.top;
          if (self.joy.active) {
            self.touch.dx = x; self.touch.dy = y;
            let dx = x - self.touch.ox, dy = y - self.touch.oy;
            const l = Math.hypot(dx, dy);
            const max = 62;
            if (l > max) { dx = dx / l * max; dy = dy / l * max; }
            self.joy.dx = dx / max; self.joy.dy = dy / max;
            self.joy.mag = Math.min(1, l / max);
          }
        }
        e.preventDefault();
      }, { passive: false });

      const endTouch = function (e) {
        self.joy.active = false; self.joy.mag = 0; self.joy.dx = 0; self.joy.dy = 0;
        self.touch.active = false;
        e.preventDefault();
      };
      canvas.addEventListener('touchend', endTouch, { passive: false });
      canvas.addEventListener('touchcancel', endTouch, { passive: false });
    },

    down: function (code) { return !!this.keys[code]; },
    hit: function (code) { return !!this.pressed[code]; },

    moveVec: function () {
      let x = 0, y = 0;
      if (this.down('KeyA') || this.down('ArrowLeft')) x -= 1;
      if (this.down('KeyD') || this.down('ArrowRight')) x += 1;
      if (this.down('KeyW') || this.down('ArrowUp')) y -= 1;
      if (this.down('KeyS') || this.down('ArrowDown')) y += 1;
      if (this.joy.mag > 0.12) { x = this.joy.dx; y = this.joy.dy; }
      const l = Math.hypot(x, y);
      if (l > 1) { x /= l; y /= l; }
      return { x: x, y: y, len: Math.min(1, l) };
    },

    endFrame: function () {
      this.pressed = {};
      this.mouse.clicked = false;
    }
  };
  AE.Input = Input;

  /* ============================================================
   * 存档
   * ============================================================ */
  const KEY = 'aether-echo-save-v1';
  const Save = {
    KEY: KEY,
    data: null,
    defaults: function () {
      return {
        v: 1, echoes: 0, totalEchoes: 0, runs: 0,
        chars: ['echo'], char: 'echo',
        meta: {}, muted: false,
        best: { time: 0, kills: 0, level: 0, score: 0 },
        seen: false,
        settings: { music: 0.7, sfx: 0.85, shake: 1, dmgText: true, quality: 1, motion: true, contrast: false, flash: true },
        stats: { kills: 0, time: 0, damage: 0, bosses: 0, wins: 0, evolves: 0, runs: 0 },
        achievements: [],
        bestRuns: [],
        leaderboard: [],
        dailyBest: {},
        bestRush: { time: 0, char: '', date: '' },
        bestPact: { tier: 0, time: 0, char: '', date: '' },
        charBest: {}
      };
    },
    load: function () {
      let d = null;
      try {
        const raw = g.localStorage && g.localStorage.getItem(KEY);
        if (raw) d = JSON.parse(raw);
      } catch (e) { d = null; }
      const base = this.defaults();
      if (d && typeof d === 'object') {
        for (const k in base) if (d[k] === undefined) d[k] = base[k];
        if (!Array.isArray(d.chars) || !d.chars.length) d.chars = ['echo'];
        if (!d.best || typeof d.best !== 'object') d.best = base.best;
        else for (const bk in base.best) if (d.best[bk] === undefined) d.best[bk] = base.best[bk];
        if (!d.meta) d.meta = {};
        ['settings', 'stats'].forEach(function (key) {
          if (!d[key] || typeof d[key] !== 'object') d[key] = base[key];
          else for (const sk in base[key]) if (d[key][sk] === undefined) d[key][sk] = base[key][sk];
        });
        if (!Array.isArray(d.achievements)) d.achievements = [];
        if (!Array.isArray(d.bestRuns)) d.bestRuns = [];
        if (!Array.isArray(d.leaderboard)) d.leaderboard = [];
        else d.leaderboard = d.leaderboard.filter(function (e) {
          return e && typeof e === 'object' && isFinite(e.score);
        }).slice(0, 8);
        if (!d.dailyBest || typeof d.dailyBest !== 'object') d.dailyBest = {};
        if (!d.bestRush || typeof d.bestRush !== 'object') d.bestRush = { time: 0, char: '', date: '' };
        if (!d.bestPact || typeof d.bestPact !== 'object') d.bestPact = base.bestPact;
        else for (const pk in base.bestPact) if (d.bestPact[pk] === undefined) d.bestPact[pk] = base.bestPact[pk];
        if (!d.charBest || typeof d.charBest !== 'object') d.charBest = {};
      } else {
        d = base;
      }
      this.data = d;
      return d;
    },
    save: function () {
      try {
        if (g.localStorage) g.localStorage.setItem(KEY, JSON.stringify(this.data));
      } catch (e) { /* 隐私模式忽略 */ }
    },
    addEchoes: function (n) {
      n = Math.max(0, Math.floor(n));
      this.data.echoes += n;
      this.data.totalEchoes += n;
      this.save();
      return n;
    },
    spend: function (n) {
      if (this.data.echoes < n) return false;
      this.data.echoes -= n;
      this.save();
      return true;
    },
    metaLevel: function (id) { return this.data.meta[id] || 0; }
  };
  AE.Save = Save;

  /* ============================================================
   * 摄像机
   * ============================================================ */
  const Cam = {
    x: 0, y: 0, zoom: 1, baseZoom: 1, targetZoom: 1,
    sx: 0, sy: 0, trauma: 0, t: 0, pulse: 0,
    W: 1280, H: 720,
    init: function (w, h) { this.W = w; this.H = h; this.resize(w, h); },
    resize: function (w, h) {
      this.W = w; this.H = h;
      const k = Math.min(w, h);
      this.baseZoom = clamp(k / 700, 0.95, 1.35);
      this.zoom = this.targetZoom = this.baseZoom;
    },
    snap: function (p) {
      this.x = p.x; this.y = p.y;
    },
    follow: function (p, dt, aimX, aimY) {
      const tx = p.x + (aimX - p.x) * 0.07;
      const ty = p.y + (aimY - p.y) * 0.07;
      const k = 1 - Math.pow(0.0006, dt);
      this.x += (tx - this.x) * k;
      this.y += (ty - this.y) * k;
      const halfW = this.W / (2 * this.zoom), halfH = this.H / (2 * this.zoom);
      if (halfW * 2 < 2800) this.x = clamp(this.x, halfW - 30, 2800 - halfW + 30);
      if (halfH * 2 < 1900) this.y = clamp(this.y, halfH - 30, 1900 - halfH + 30);
      this.t += dt;
      this.pulse *= Math.pow(0.01, dt);
      if (this.pulse < 0.001) this.pulse = 0;
      this.targetZoom = this.baseZoom * (AE.G && AE.G.boss ? 0.965 : 1) + this.pulse;
      this.zoom += (this.targetZoom - this.zoom) * Math.min(1, dt * 3);
      this.trauma = Math.max(0, this.trauma - dt * 1.45);
      const s = this.trauma * this.trauma;
      this.sx = (Math.random() * 2 - 1) * 17 * s;
      this.sy = (Math.random() * 2 - 1) * 17 * s;
    },
    addShake: function (v) { this.trauma = Math.min(1.4, this.trauma + v); },
    toScreen: function (x, y) {
      return {
        x: (x - this.x) * this.zoom + this.W / 2 + this.sx,
        y: (y - this.y) * this.zoom + this.H / 2 + this.sy
      };
    },
    toWorld: function (sx, sy) {
      return {
        x: (sx - this.W / 2 - this.sx) / this.zoom + this.x,
        y: (sy - this.H / 2 - this.sy) / this.zoom + this.y
      };
    },
    apply: function (ctx) {
      ctx.translate(this.W / 2 + this.sx, this.H / 2 + this.sy);
      ctx.scale(this.zoom, this.zoom);
      ctx.translate(-this.x, -this.y);
    },
    view: function () {
      const hw = this.W / (2 * this.zoom), hh = this.H / (2 * this.zoom);
      return { x0: this.x - hw, y0: this.y - hh, x1: this.x + hw, y1: this.y + hh, hw: hw, hh: hh };
    }
  };
  AE.Cam = Cam;
})(typeof window !== 'undefined' ? window : globalThis);
