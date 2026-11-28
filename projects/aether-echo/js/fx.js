/* ============================================================
 * fx.js — 粒子 / 伤害数字 / 冲击环 / 闪电 / 星场背景 / 屏幕效果
 * 全部程序化绘制，不依赖图片素材。
 * ============================================================ */
(function (g) {
  'use strict';
  const AE = (g.AE = g.AE || {});
  const U = AE.U;
  function wrap(v, m) { return ((v % m) + m) % m; }
  const FX = {
    particles: [], rings: [], texts: [], lines: [], flashes: [],
    t: 0, W: 1280, H: 720, dpr: 1,
    hitstop: 0,
    shakeMul: 1, dmgText: true, quality: 1, motion: true, contrast: false,
    vignette: null, lowHp: 0,
    glows: {}, stars: null, nebulae: [],

    init: function (w, h, dpr) {
      this.W = w; this.H = h; this.dpr = dpr || 1;
      this.buildStars();
      this.buildNebula();
      this.buildVignette();
    },

    resize: function (w, h, dpr) {
      this.W = w; this.H = h; this.dpr = dpr || 1;
      this.buildVignette();
    },

    reset: function () {
      this.particles.length = 0;
      this.rings.length = 0;
      this.texts.length = 0;
      this.lines.length = 0;
      this.flashes.length = 0;
      this.hitstop = 0;
      this.lowHp = 0;
      this.t = 0;
    },

    /* ---------- 预渲染素材 ---------- */
    buildVignette: function () {
      const c = document.createElement('canvas');
      c.width = Math.max(1, Math.floor(this.W));
      c.height = Math.max(1, Math.floor(this.H));
      const x = c.getContext('2d');
      if (!x) { this.vignette = c; return; }
      const grad = x.createRadialGradient(this.W / 2, this.H / 2, Math.min(this.W, this.H) * 0.35,
        this.W / 2, this.H / 2, Math.max(this.W, this.H) * 0.72);
      grad.addColorStop(0, 'rgba(0,0,0,0)');
      grad.addColorStop(0.7, 'rgba(2,3,10,0.32)');
      grad.addColorStop(1, 'rgba(1,2,7,0.78)');
      x.fillStyle = grad;
      x.fillRect(0, 0, this.W, this.H);
      this.vignette = c;
    },

    buildStars: function () {
      const layers = [];
      const counts = [70, 46, 26];
      const sizes = [0.9, 1.4, 2.1];
      const alphas = [0.5, 0.65, 0.9];
      const tints = ['#93a6d8', '#c8d6ff', '#eef4ff'];
      for (let l = 0; l < 3; l++) {
        const c = document.createElement('canvas');
        c.width = 640; c.height = 640;
        const x = c.getContext('2d');
        for (let i = 0; i < counts[l]; i++) {
          const sx = Math.random() * 640, sy = Math.random() * 640;
          const s = sizes[l] * (0.6 + Math.random() * 0.9);
          x.globalAlpha = alphas[l] * (0.5 + Math.random() * 0.5);
          x.fillStyle = tints[l];
          x.beginPath();
          x.arc(sx, sy, s, 0, U.TAU);
          x.fill();
          if (l === 2 && Math.random() < 0.25) {
            x.globalAlpha *= 0.5;
            x.fillRect(sx - s * 3, sy - 0.4, s * 6, 0.8);
            x.fillRect(sx - 0.4, sy - s * 3, 0.8, s * 6);
          }
        }
        x.globalAlpha = 1;
        layers.push(c);
      }
      this.stars = layers;
    },

    buildNebula: function () {
      const cols = [
        ['rgba(80,40,180,0.5)', 'rgba(20,10,60,0)'],
        ['rgba(20,110,150,0.38)', 'rgba(5,20,40,0)'],
        ['rgba(150,30,90,0.3)', 'rgba(40,5,25,0)']
      ];
      this.nebulae = cols.map(function (col) {
        const c = document.createElement('canvas');
        c.width = 512; c.height = 512;
        const x = c.getContext('2d');
        for (let i = 0; i < 5; i++) {
          const cx = 60 + Math.random() * 392, cy = 60 + Math.random() * 392;
          const r = 70 + Math.random() * 170;
          const gr = x.createRadialGradient(cx, cy, 0, cx, cy, r);
          gr.addColorStop(0, col[0]);
          gr.addColorStop(1, col[1]);
          x.fillStyle = gr;
          x.beginPath(); x.arc(cx, cy, r, 0, U.TAU); x.fill();
        }
        // 边缘淡出，避免贴图接缝出现直角
        x.globalCompositeOperation = 'destination-in';
        const mask = x.createRadialGradient(256, 256, 0, 256, 256, 256);
        mask.addColorStop(0, 'rgba(0,0,0,1)');
        mask.addColorStop(0.7, 'rgba(0,0,0,0.85)');
        mask.addColorStop(1, 'rgba(0,0,0,0)');
        x.fillStyle = mask;
        x.fillRect(0, 0, 512, 512);
        x.globalCompositeOperation = 'source-over';
        return c;
      });
      // 预缩放：每帧按 760 / 600 两种尺寸双线性重采样 2.5M 像素很贵，
      // 这里一次性把两种目标尺寸烘焙好，绘制时 1:1 拷贝（视觉一致，省掉每帧缩放）。
      const prescale = function (src, size) {
        const c = document.createElement('canvas');
        c.width = size; c.height = size;
        const x = c.getContext('2d');
        if (!x) return src;
        x.imageSmoothingEnabled = true;
        if ('imageSmoothingQuality' in x) x.imageSmoothingQuality = 'high';
        x.drawImage(src, 0, 0, size, size);
        return c;
      };
      this.nebulaeBig = this.nebulae.map(function (c) { return prescale(c, 760); });
      this.nebulaeSmall = this.nebulae.map(function (c) { return prescale(c, 600); });
    },

    glowSprite: function (color) {
      if (this.glows[color]) return this.glows[color];
      const c = document.createElement('canvas');
      c.width = 96; c.height = 96;
      const x = c.getContext('2d');
      const gr = x.createRadialGradient(48, 48, 0, 48, 48, 48);
      gr.addColorStop(0, color);
      gr.addColorStop(0.35, this.alpha(color, 0.55));
      gr.addColorStop(1, this.alpha(color, 0));
      x.fillStyle = gr;
      x.fillRect(0, 0, 96, 96);
      this.glows[color] = c;
      return c;
    },
    alpha: function (color, a) {
      // #rrggbb → rgba()
      if (color.charAt(0) === '#') {
        const r = parseInt(color.substr(1, 2), 16);
        const gg = parseInt(color.substr(3, 2), 16);
        const b = parseInt(color.substr(5, 2), 16);
        return 'rgba(' + r + ',' + gg + ',' + b + ',' + a + ')';
      }
      return color;
    },
    glow: function (ctx, x, y, r, color, a) {
      const sp = this.glowSprite(color);
      ctx.globalAlpha = a === undefined ? 1 : a;
      ctx.drawImage(sp, x - r, y - r, r * 2, r * 2);
      ctx.globalAlpha = 1;
    },

    /* ---------- 发射接口 ---------- */
    spark: function (x, y, color, n, o) {
      o = o || {};
      n = n || 4;
      const cap = (AE.Data.CONST.MAX_PARTICLES || 600) * (this.quality || 1);
      for (let i = 0; i < n; i++) {
        if (this.particles.length >= cap) this.particles.shift();
        const ang = o.angle !== undefined ? o.angle + U.rnd(-(o.spread || 0.6), o.spread || 0.6) : U.rnd(0, U.TAU);
        const spd = U.rnd((o.spd || 60) * 0.4, o.spd || 160);
        const life = U.rnd((o.life || 0.4) * 0.6, o.life || 0.4);
        this.particles.push({
          x: x, y: y,
          vx: Math.cos(ang) * spd, vy: Math.sin(ang) * spd,
          life: life, max: life,
          size: U.rnd((o.size || 2.4) * 0.5, o.size || 2.4),
          color: color, drag: o.drag === undefined ? 3.2 : o.drag,
          grav: o.grav || 0, add: o.add !== false,
          kind: o.kind || 'dot', rot: U.rnd(0, U.TAU), vr: U.rnd(-8, 8)
        });
      }
    },

    ring: function (x, y, color, r0, r1, life, width) {
      this.rings.push({ x: x, y: y, r0: r0, r1: r1, life: life, max: life, color: color, w: width || 3 });
      if (this.rings.length > 70) this.rings.shift();
    },

    text: function (x, y, str, color, size, crit) {
      if (this.texts.length >= (AE.Data.CONST.MAX_TEXTS || 60)) this.texts.shift();
      this.texts.push({
        x: x + U.rnd(-8, 8), y: y, str: str, color: color,
        size: size || 15, life: 0.75, max: 0.75, vy: -55, crit: !!crit
      });
    },

    line: function (x1, y1, x2, y2, color, life, width, jagged) {
      if (this.lines.length > 40) this.lines.shift();
      this.lines.push({
        x1: x1, y1: y1, x2: x2, y2: y2, color: color,
        life: life || 0.16, max: life || 0.16, w: width || 2, jag: !!jagged
      });
    },

    flash: function (a, color) {
      if (!this.motion) return;
      if (AE.Save && AE.Save.data && AE.Save.data.settings &&
          AE.Save.data.settings.flash === false) return;
      this.flashes.push({ a: a, color: color || '#ffffff', life: 0.22, max: 0.22 });
      if (this.flashes.length > 6) this.flashes.shift();
    },

    shake: function (v) { if (this.motion && AE.Cam) AE.Cam.addShake(v * this.shakeMul); },

    hitStop: function (t) { this.hitstop = Math.max(this.hitstop, t); },

    /* ---------- 更新 ---------- */
    update: function (dt) {
      this.t += dt;
      if (this.hitstop > 0) this.hitstop = Math.max(0, this.hitstop - dt);

      const ps = this.particles;
      for (let i = ps.length - 1; i >= 0; i--) {
        const p = ps[i];
        p.life -= dt;
        if (p.life <= 0) { ps.splice(i, 1); continue; }
        const dr = Math.max(0, 1 - p.drag * dt);
        p.vx *= dr; p.vy *= dr;
        p.vy += p.grav * dt;
        p.x += p.vx * dt; p.y += p.vy * dt;
        p.rot += p.vr * dt;
      }
      const rs = this.rings;
      for (let i = rs.length - 1; i >= 0; i--) {
        const r = rs[i]; r.life -= dt;
        if (r.life <= 0) rs.splice(i, 1);
      }
      const ts = this.texts;
      for (let i = ts.length - 1; i >= 0; i--) {
        const t = ts[i]; t.life -= dt;
        t.y += t.vy * dt;
        t.vy *= Math.max(0, 1 - 3 * dt);
        if (t.life <= 0) ts.splice(i, 1);
      }
      const ls = this.lines;
      for (let i = ls.length - 1; i >= 0; i--) {
        ls[i].life -= dt;
        if (ls[i].life <= 0) ls.splice(i, 1);
      }
      const fs = this.flashes;
      for (let i = fs.length - 1; i >= 0; i--) {
        fs[i].life -= dt;
        if (fs[i].life <= 0) fs.splice(i, 1);
      }
      const player = AE.G && AE.G.player;
      if (player) {
        const k = player.hp / player.maxHp;
        this.lowHp = U.lerp(this.lowHp, k < 0.35 ? (1 - k / 0.35) : 0, Math.min(1, dt * 4));
      } else this.lowHp = 0;
    },

    /* ---------- 背景 ---------- */
    /* 层级天体：每层一张离屏缓存，避免每帧重建渐变 */
    makeBody: function (stage) {
      if (typeof document === 'undefined' || !document.createElement) return null;
      const c = document.createElement('canvas');
      c.width = 620; c.height = 620;
      const x = c.getContext('2d');
      if (!x) return null;
      x.translate(310, 310);
      if (stage === 0) {
        const g0 = x.createRadialGradient(-60, -70, 20, 0, 0, 210);
        g0.addColorStop(0, '#e8f2ff');
        g0.addColorStop(0.55, '#9fb6d8');
        g0.addColorStop(1, 'rgba(80,100,140,0)');
        x.fillStyle = g0;
        x.beginPath(); x.arc(0, 0, 210, 0, U.TAU); x.fill();
        x.fillStyle = 'rgba(90,110,150,0.35)';
        [[-50, -30, 26], [40, 45, 18], [70, -60, 12], [-20, 80, 14]].forEach(function (cr) {
          x.beginPath(); x.arc(cr[0], cr[1], cr[2], 0, U.TAU); x.fill();
        });
      } else if (stage === 1) {
        const g1 = x.createRadialGradient(-80, -90, 20, 0, 0, 230);
        g1.addColorStop(0, '#d9c4ff');
        g1.addColorStop(0.5, '#7a5bd0');
        g1.addColorStop(1, 'rgba(40,20,80,0)');
        x.fillStyle = g1;
        x.beginPath(); x.arc(0, 0, 230, 0, U.TAU); x.fill();
        x.strokeStyle = 'rgba(200,180,255,0.42)';
        x.lineWidth = 3;
        x.save(); x.rotate(-0.38); x.scale(1, 0.28);
        x.beginPath(); x.arc(0, 0, 300, 0, U.TAU); x.stroke();
        x.beginPath(); x.arc(0, 0, 340, 0, U.TAU); x.stroke();
        x.restore();
      } else if (stage === 2) {
        [[-70, -20, 150, 'rgba(90,255,190,0.55)'], [90, 50, 110, 'rgba(80,220,255,0.4)']].forEach(function (s) {
          const g2 = x.createRadialGradient(s[0] - 30, s[1] - 30, 10, s[0], s[1], s[2]);
          g2.addColorStop(0, '#e6fff5');
          g2.addColorStop(0.5, s[3]);
          g2.addColorStop(1, 'rgba(0,30,25,0)');
          x.fillStyle = g2;
          x.beginPath(); x.arc(s[0], s[1], s[2], 0, U.TAU); x.fill();
        });
      } else if (stage === 3) {
        x.fillStyle = 'rgba(0,0,0,0.82)';
        x.beginPath(); x.arc(0, 0, 150, 0, U.TAU); x.fill();
        for (let i = 0; i < 3; i++) {
          x.strokeStyle = 'rgba(255,' + (120 + i * 35) + ',80,' + (0.5 - i * 0.12) + ')';
          x.lineWidth = 5 - i;
          x.beginPath(); x.arc(0, 0, 176 + i * 26, i * 1.8, i * 1.8 + 4.4); x.stroke();
        }
        const g3 = x.createRadialGradient(0, 0, 120, 0, 0, 300);
        g3.addColorStop(0, 'rgba(0,0,0,0)');
        g3.addColorStop(0.7, 'rgba(255,120,60,0.10)');
        g3.addColorStop(1, 'rgba(255,120,60,0)');
        x.fillStyle = g3;
        x.beginPath(); x.arc(0, 0, 300, 0, U.TAU); x.fill();
      } else {
        const g4 = x.createRadialGradient(-40, -50, 20, 0, 0, 250);
        g4.addColorStop(0, '#fff3c4');
        g4.addColorStop(0.4, '#ffb35c');
        g4.addColorStop(0.75, 'rgba(255,80,60,0.5)');
        g4.addColorStop(1, 'rgba(120,20,10,0)');
        x.fillStyle = g4;
        x.beginPath(); x.arc(0, 0, 250, 0, U.TAU); x.fill();
        x.strokeStyle = 'rgba(255,200,120,0.28)';
        x.lineWidth = 2;
        for (let i = 0; i < 24; i++) {
          const a = i * U.TAU / 24;
          x.beginPath();
          x.moveTo(Math.cos(a) * 170, Math.sin(a) * 170);
          x.lineTo(Math.cos(a) * (260 + (i % 3) * 24), Math.sin(a) * (260 + (i % 3) * 24));
          x.stroke();
        }
      }
      return c;
    },

    drawBackground: function (ctx, cam, w, h) {
      const t = this.t;
      const G = AE.G;
      const gt = (G && G.state !== 'menu') ? (G.time || 0) : 0;
      const stage = gt >= 600 ? 4 : (gt >= 450 ? 3 : (gt >= 300 ? 2 : (gt >= 150 ? 1 : 0)));
      // 每层独立底色
      if (!this._bgGrad || this._bgW !== w || this._bgH !== h || this._bgStage !== stage) {
        const pal = [
          ['#060812', '#080c1c', '#05060f'],
          ['#0b0618', '#140a26', '#06040f'],
          ['#04100f', '#071d1e', '#030a0c'],
          ['#14060c', '#1f0a13', '#080306'],
          ['#120d05', '#1e1608', '#06040a']
        ][stage];
        const grad = ctx.createLinearGradient(0, 0, 0, h);
        grad.addColorStop(0, pal[0]);
        grad.addColorStop(0.55, pal[1]);
        grad.addColorStop(1, pal[2]);
        this._bgGrad = grad; this._bgW = w; this._bgH = h; this._bgStage = stage;
      }
      ctx.fillStyle = this._bgGrad;
      ctx.fillRect(0, 0, w, h);

      // 每层一颗巨型天体（离屏缓存，只绘制一次）
      if (this.quality > 0.65) {
        this._bodyCache = this._bodyCache || {};
        let body = this._bodyCache[stage];
        if (body === undefined) {
          body = this.makeBody(stage);
          this._bodyCache[stage] = body;
        }
        if (body) {
          const bw = body.width;
          const nx = wrap((-cam.x * 0.018 + stage * 233 + t * 3), w + bw) - bw * 0.5;
          const ny = wrap((-cam.y * 0.014 + stage * 151), h + bw) - bw * 0.6;
          ctx.globalAlpha = 0.5;
          ctx.drawImage(body, nx, ny);
          ctx.globalAlpha = 1;
        }
        // 流星
        ctx.globalCompositeOperation = 'lighter';
        for (let i = 0; i < 2; i++) {
          const sx = wrap(t * (120 + i * 55) + i * 610, w + 500) - 250;
          const sy = wrap(t * (36 + i * 18) + i * 330, h + 200) - 100;
          const lg = ctx.createLinearGradient(sx, sy, sx - 90, sy - 40);
          lg.addColorStop(0, 'rgba(200,235,255,0.45)');
          lg.addColorStop(1, 'rgba(200,235,255,0)');
          ctx.strokeStyle = lg;
          ctx.lineWidth = 1.6;
          ctx.beginPath(); ctx.moveTo(sx, sy); ctx.lineTo(sx - 90, sy - 40); ctx.stroke();
        }
        ctx.globalCompositeOperation = 'source-over';
      }

      // 星云（低画质时跳过，节省填充率）
      if (this.quality > 0.65) {
        const big = this.nebulaeBig, small = this.nebulaeSmall;
        ctx.globalCompositeOperation = 'lighter';
        for (let i = 0; i < this.nebulae.length; i++) {
          const p = 0.015 + i * 0.012;
          const nx = ((-cam.x * p) % 900) - 200 + i * 260;
          const ny = ((-cam.y * p) % 700) - 150 + i * 190;
          ctx.globalAlpha = 0.62 + Math.sin(t * 0.12 + i) * 0.08;
          ctx.drawImage(big ? big[i] : this.nebulae[i], nx, ny, 760, 760);
          ctx.drawImage(small ? small[i] : this.nebulae[i], nx + 900, ny + 300, 600, 600);
        }
        ctx.globalAlpha = 1;
        ctx.globalCompositeOperation = 'source-over';
      }

      // 星层：只画与视口相交的瓦片（原先每层多画 1 列 + 1 行，纯属浪费调用）
      if (this.stars) {
        const cw = Math.ceil(w / 640), chh = Math.ceil(h / 640);
        for (let l = 0; l < this.stars.length; l++) {
          const p = 0.06 + l * 0.09;
          const ox = ((-cam.x * p) % 640 + 640) % 640;
          const oy = ((-cam.y * p) % 640 + 640) % 640;
          ctx.globalAlpha = 0.72 + l * 0.09;
          for (let gx = 0; gx <= cw; gx++) {
            for (let gy = 0; gy <= chh; gy++) {
              ctx.drawImage(this.stars[l], gx * 640 + ox - 640, gy * 640 + oy - 640);
            }
          }
        }
        ctx.globalAlpha = 1;
      }

      // 世界网格（视差 1）
      const z = cam.zoom;
      const step = 160;
      ctx.strokeStyle = 'rgba(96,132,210,0.055)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      const v = cam.view();
      const gx0 = Math.floor(v.x0 / step) * step;
      for (let x = gx0; x <= v.x1; x += step) {
        const s = cam.toScreen(x, v.y0);
        ctx.moveTo(Math.round(s.x) + 0.5, 0);
        ctx.lineTo(Math.round(s.x) + 0.5, h);
      }
      const gy0 = Math.floor(v.y0 / step) * step;
      for (let y = gy0; y <= v.y1; y += step) {
        const s = cam.toScreen(v.x0, y);
        ctx.moveTo(0, Math.round(s.y) + 0.5);
        ctx.lineTo(w, Math.round(s.y) + 0.5);
      }
      ctx.stroke();
    },

    drawWorldDecor: function (ctx, cam) {
      const v = cam.view();
      // 世界边界
      const W = AE.Data.CONST.WORLD_W, H = AE.Data.CONST.WORLD_H;
      ctx.save();
      ctx.strokeStyle = 'rgba(88,132,220,0.22)';
      ctx.lineWidth = 2;
      ctx.strokeRect(0, 0, W, H);
      ctx.strokeStyle = 'rgba(125,249,255,0.10)';
      ctx.lineWidth = 8;
      ctx.strokeRect(-4, -4, W + 8, H + 8);
      ctx.fillStyle = 'rgba(2,4,10,0.65)';
      ctx.fillRect(-120, -120, W + 240, 120);
      ctx.fillRect(-120, H, W + 240, 120);
      ctx.fillRect(-120, 0, 120, H);
      ctx.fillRect(W, 0, 120, H);
      ctx.restore();

      // 地面符文（装饰）
      const seed = 1337;
      for (let i = 0; i < 26; i++) {
        const x = ((i * 733 + seed) % (W - 200)) + 100;
        const y = ((i * 1193 + 511) % (H - 200)) + 100;
        if (x < v.x0 - 80 || x > v.x1 + 80 || y < v.y0 - 80 || y > v.y1 + 80) continue;
        const a = 0.05 + 0.035 * Math.sin(this.t * 0.7 + i);
        ctx.save();
        ctx.translate(x, y);
        ctx.rotate(i * 1.7 + this.t * 0.05);
        ctx.strokeStyle = 'rgba(120,180,255,' + a.toFixed(3) + ')';
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.arc(0, 0, 34 + (i % 3) * 12, 0, U.TAU);
        ctx.stroke();
        ctx.beginPath();
        for (let k = 0; k < 3; k++) {
          const aa = k * U.TAU / 3;
          ctx.moveTo(Math.cos(aa) * 40, Math.sin(aa) * 40);
          ctx.lineTo(Math.cos(aa + 2.09) * 40, Math.sin(aa + 2.09) * 40);
        }
        ctx.stroke();
        ctx.restore();
      }
    },

    /* ---------- 世界层特效 ---------- */
    drawRings: function (ctx) {
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      for (let i = 0; i < this.rings.length; i++) {
        const r = this.rings[i];
        const k = 1 - r.life / r.max;
        const rad = U.lerp(r.r0, r.r1, 1 - Math.pow(1 - k, 2));
        const a = Math.pow(1 - k, 1.6) * 0.9;
        ctx.globalAlpha = a;
        ctx.strokeStyle = r.color;
        ctx.lineWidth = r.w * (1 - k * 0.6);
        ctx.beginPath();
        ctx.arc(r.x, r.y, Math.max(1, rad), 0, U.TAU);
        ctx.stroke();
      }
      ctx.restore();
    },

    drawWorld: function (ctx) {
      // 粒子：视口裁剪 + 合并重复的状态设置（同色/同混合模式不重复赋值）
      const v = AE.Cam.view();
      const mx = v.x0 - 60, my = v.y0 - 60, Mx = v.x1 + 60, My = v.y1 + 60;
      ctx.save();
      let lastOp = '', lastFill = '', lastStroke = '';
      for (let i = 0; i < this.particles.length; i++) {
        const p = this.particles[i];
        if (p.x < mx || p.x > Mx || p.y < my || p.y > My) continue;
        const a = Math.max(0, p.life / p.max);
        ctx.globalAlpha = a;
        const op = p.add ? 'lighter' : 'source-over';
        if (op !== lastOp) { ctx.globalCompositeOperation = op; lastOp = op; }
        if (p.kind === 'spark') {
          if (p.color !== lastStroke) { ctx.strokeStyle = p.color; lastStroke = p.color; }
          ctx.lineWidth = Math.max(0.6, p.size * a);
          ctx.beginPath();
          ctx.moveTo(p.x, p.y);
          ctx.lineTo(p.x - p.vx * 0.03, p.y - p.vy * 0.03);
          ctx.stroke();
        } else if (p.kind === 'shard') {
          ctx.save();
          ctx.translate(p.x, p.y);
          ctx.rotate(p.rot);
          ctx.fillStyle = p.color;
          ctx.fillRect(-p.size, -p.size * 0.35, p.size * 2, p.size * 0.7);
          ctx.restore();
          lastFill = '';
        } else if (p.kind === 'ring') {
          if (p.color !== lastStroke) { ctx.strokeStyle = p.color; lastStroke = p.color; }
          ctx.lineWidth = 1.2;
          ctx.beginPath();
          ctx.arc(p.x, p.y, p.size * (2 - a), 0, U.TAU);
          ctx.stroke();
        } else {
          if (p.color !== lastFill) { ctx.fillStyle = p.color; lastFill = p.color; }
          ctx.beginPath();
          ctx.arc(p.x, p.y, Math.max(0.4, p.size * (0.4 + a * 0.8)), 0, U.TAU);
          ctx.fill();
        }
      }
      ctx.restore();

      // 闪电
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      for (let i = 0; i < this.lines.length; i++) {
        const l = this.lines[i];
        const a = l.life / l.max;
        ctx.globalAlpha = a;
        ctx.strokeStyle = l.color;
        ctx.lineWidth = l.w * a;
        ctx.beginPath();
        ctx.moveTo(l.x1, l.y1);
        if (l.jag) {
          const dx = l.x2 - l.x1, dy = l.y2 - l.y1;
          const len = Math.hypot(dx, dy);
          const nx = -dy / (len || 1), ny = dx / (len || 1);
          const seg = 4;
          for (let s = 1; s <= seg; s++) {
            const k = s / seg;
            const off = s === seg ? 0 : (Math.random() - 0.5) * 16;
            ctx.lineTo(l.x1 + dx * k + nx * off, l.y1 + dy * k + ny * off);
          }
        } else {
          ctx.lineTo(l.x2, l.y2);
        }
        ctx.stroke();
        ctx.lineWidth = l.w * 0.4 * a;
        ctx.strokeStyle = '#ffffff';
        ctx.stroke();
      }
      ctx.restore();
    },

    /* ---------- 屏幕层 ---------- */
    drawScreen: function (ctx, cam, w, h) {
      // 伤害数字 / 拾取文字
      ctx.save();
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      let lastFont = '';
      for (let i = 0; i < this.texts.length; i++) {
        const t = this.texts[i];
        const s = cam.toScreen(t.x, t.y);
        const k = t.life / t.max;
        const sz = t.size * (t.crit ? 1.35 : 1) * (0.75 + 0.25 * Math.min(1, (1 - k) * 6));
        ctx.globalAlpha = Math.min(1, k * 2.2);
        const fkey = '800 ' + sz.toFixed(0) + 'px "Segoe UI", system-ui, sans-serif';
        if (fkey !== lastFont) { lastFont = fkey; ctx.font = fkey; }
        ctx.lineWidth = 3;
        ctx.strokeStyle = 'rgba(4,6,14,0.85)';
        ctx.strokeText(t.str, s.x, s.y);
        ctx.fillStyle = t.color;
        ctx.fillText(t.str, s.x, s.y);
      }
      ctx.restore();

      // 全屏闪白
      for (let i = 0; i < this.flashes.length; i++) {
        const f = this.flashes[i];
        ctx.globalAlpha = Math.max(0, f.life / f.max) * f.a;
        ctx.fillStyle = f.color;
        ctx.fillRect(0, 0, w, h);
      }
      ctx.globalAlpha = 1;

      // 暗角
      if (this.vignette) ctx.drawImage(this.vignette, 0, 0, w, h);

      // 低血量红边：渐变几何固定，缓存一次，用 globalAlpha 调制强度
      if (this.lowHp > 0.02) {
        const pulse = 0.55 + 0.45 * Math.sin(this.t * 7);
        if (!this._lowGrad || this._lowW !== w || this._lowH !== h) {
          const gr = ctx.createRadialGradient(w / 2, h / 2, Math.min(w, h) * 0.28, w / 2, h / 2, Math.max(w, h) * 0.62);
          gr.addColorStop(0, 'rgba(255,40,80,0)');
          gr.addColorStop(1, 'rgba(255,30,70,1)');
          this._lowGrad = gr; this._lowW = w; this._lowH = h;
        }
        ctx.globalAlpha = 0.42 * this.lowHp * pulse;
        ctx.fillStyle = this._lowGrad;
        ctx.fillRect(0, 0, w, h);
        ctx.globalAlpha = 1;
      }

      // BOSS 战：屏幕边缘的压迫感
      if (AE.G && AE.G.boss && AE.G.boss.alive) {
        const p2 = 0.5 + 0.5 * Math.sin(this.t * 2.2);
        if (!this._bossGrad || this._bossW !== w || this._bossH !== h) {
          const gr2 = ctx.createRadialGradient(w / 2, h / 2, Math.min(w, h) * 0.34, w / 2, h / 2, Math.max(w, h) * 0.6);
          gr2.addColorStop(0, 'rgba(140,20,50,0)');
          gr2.addColorStop(1, 'rgba(150,20,55,1)');
          this._bossGrad = gr2; this._bossW = w; this._bossH = h;
        }
        ctx.globalAlpha = 0.1 + p2 * 0.07;
        ctx.fillStyle = this._bossGrad;
        ctx.fillRect(0, 0, w, h);
        ctx.globalAlpha = 1;
      }

      // 扫描线（极淡，质感；低动态 / 低画质时关闭）
      // 用 1×4 图案一次性填充替代 h/4 次 fillRect
      if (this.motion && this.quality > 0.75) {
        if (!this._scanPat) {
          const c = document.createElement('canvas');
          c.width = 1; c.height = 4;
          const sx = c.getContext('2d');
          if (sx) { sx.fillStyle = '#9fd8ff'; sx.fillRect(0, 0, 1, 1); }
          this._scanPat = ctx.createPattern(c, 'repeat');
        }
        ctx.globalAlpha = 0.035;
        ctx.fillStyle = this._scanPat || '#9fd8ff';
        if (this._scanPat) ctx.fillRect(0, 0, w, h);
        else for (let y = 0; y < h; y += 4) ctx.fillRect(0, y, w, 1);
        ctx.globalAlpha = 1;
      }
    }
  };

  AE.FX = FX;
})(typeof window !== 'undefined' ? window : globalThis);
