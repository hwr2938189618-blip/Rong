/* ============================================================
 * world.js — 空间网格 / 弹幕 / 经验球 / 掉落
 * ============================================================ */
(function (g) {
  'use strict';
  const AE = (g.AE = g.AE || {});
  const U = AE.U;

  const COLS = 32, ROWS = 22, CELL = 96;

  const Grid = {
    cols: COLS, rows: ROWS, cell: CELL,
    cells: null,
    init: function () {
      this.cells = new Array(COLS * ROWS);
      for (let i = 0; i < this.cells.length; i++) this.cells[i] = [];
    },
    idx: function (cx, cy) {
      if (cx < 0 || cy < 0 || cx >= COLS || cy >= ROWS) return -1;
      return cy * COLS + cx;
    },
    build: function (list) {
      const cells = this.cells;
      for (let i = 0; i < cells.length; i++) cells[i].length = 0;
      for (let i = 0; i < list.length; i++) {
        const e = list[i];
        if (!e.alive) continue;
        const cx = Math.floor(e.x / CELL), cy = Math.floor(e.y / CELL);
        const id = this.idx(cx, cy);
        if (id >= 0) cells[id].push(e);
      }
    },
    query: function (x, y, r, out) {
      const res = out || [];
      const cx0 = Math.floor((x - r) / CELL), cx1 = Math.floor((x + r) / CELL);
      const cy0 = Math.floor((y - r) / CELL), cy1 = Math.floor((y + r) / CELL);
      for (let cy = cy0; cy <= cy1; cy++) {
        for (let cx = cx0; cx <= cx1; cx++) {
          const id = this.idx(cx, cy);
          if (id < 0) continue;
          const arr = this.cells[id];
          for (let i = 0; i < arr.length; i++) res.push(arr[i]);
        }
      }
      return res;
    }
  };

  const World = {
    grid: Grid,
    bullets: [], ebullets: [], orbs: [], pickups: [],
    reset: function () {
      this.bullets.length = 0;
      this.ebullets.length = 0;
      this.orbs.length = 0;
      this.pickups.length = 0;
      if (!this.grid.cells) this.grid.init();
    },

    gridNeighbors: function (x, y, r) {
      return this.grid.query(x, y, r);
    },

    /* ---------- 生成 ---------- */
    addBullet: function (b) {
      if (this.bullets.length >= AE.Data.CONST.MAX_BULLETS) this.bullets.shift();
      if (b.hitIds === undefined) b.hitIds = [];
      this.bullets.push(b);
      return b;
    },

    addEBullet: function (b) {
      if (this.ebullets.length >= AE.Data.CONST.MAX_EBULLETS) this.ebullets.shift();
      this.ebullets.push(b);
      return b;
    },

    addOrb: function (x, y, val) {
      if (this.orbs.length >= AE.Data.CONST.MAX_ORBS) {
        const o = this.orbs[Math.floor(Math.random() * this.orbs.length)];
        o.val += val;
        return o;
      }
      const a = Math.random() * U.TAU, sp = U.rnd(20, 90);
      const o = {
        x: x, y: y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp,
        val: val, t: 0, pull: false, r: val >= 20 ? 7 : (val >= 6 ? 5.5 : 4)
      };
      this.orbs.push(o);
      return o;
    },

    dropOrbs: function (x, y, value, elite, big) {
      let parts = 1;
      if (big) parts = 6;
      else if (elite) parts = 3;
      else if (value >= 6) parts = 3;
      else if (value >= 3) parts = 2;
      let left = value;
      for (let i = 0; i < parts; i++) {
        const v = i === parts - 1 ? left : Math.max(1, Math.floor(value / parts));
        left -= v;
        if (v <= 0) continue;
        this.addOrb(x + U.rnd(-14, 14), y + U.rnd(-14, 14), v);
      }
    },

    addPickup: function (type, x, y, n) {
      n = n || 1;
      for (let i = 0; i < n; i++) {
        this.pickups.push({
          type: type, x: x + U.rnd(-16, 16), y: y + U.rnd(-16, 16),
          t: U.rnd(0, 6), life: 24
        });
      }
    },

    /* ---------- 更新 ---------- */
    update: function (dt, p) {
      this.updateBullets(dt, p);
      this.updateEBullets(dt, p);
      this.updateOrbs(dt, p);
      this.updatePickups(dt, p);
    },

    updateBullets: function (dt, p) {
      const bs = this.bullets;
      const En = AE.Enemies;
      for (let i = bs.length - 1; i >= 0; i--) {
        const b = bs[i];
        b.life -= dt;
        if (b.life <= 0) {
          if (b.blast) this.explodeBullet(b, null);
          bs.splice(i, 1);
          continue;
        }
        // 追踪
        if (b.homing) {
          let tx = null, ty = null;
          if (b.target && b.target.alive) { tx = b.target.x; ty = b.target.y; }
          else if (b.kind === 'seeker') {
            const n = En.nearestTo(b.x, b.y, 520);
            if (n) { b.target = n; tx = n.x; ty = n.y; }
          }
          if (tx !== null) {
            const ang = Math.atan2(ty - b.y, tx - b.x);
            const cur = Math.atan2(b.vy, b.vx);
            const na = U.angLerp(cur, ang, Math.min(1, b.homing * dt));
            const sp = Math.hypot(b.vx, b.vy);
            b.vx = Math.cos(na) * sp; b.vy = Math.sin(na) * sp;
          }
        }
        b.x += b.vx * dt;
        b.y += b.vy * dt;
        if (b.x < -80 || b.x > AE.Data.CONST.WORLD_W + 80 || b.y < -80 || b.y > AE.Data.CONST.WORLD_H + 80) {
          bs.splice(i, 1);
          continue;
        }

        // 拖尾
        b.trailT = (b.trailT || 0) - dt;
        if (b.trailT <= 0 && b.kind !== 'shard') {
          b.trailT = 0.035;
          AE.FX.spark(b.x, b.y, b.color, 1, { spd: 12, life: 0.22, size: b.size * 0.5, add: true });
        }

        // 命中
        const near = Grid.query(b.x, b.y, b.r + 26);
        for (let k = 0; k < near.length; k++) {
          const e = near[k];
          if (!e.alive || e.spawning > 0) continue;
          if (b.hitIds.indexOf(e.id) >= 0) continue;
          const rr = e.r + b.r;
          if (U.d2(b.x, b.y, e.x, e.y) > rr * rr) continue;
          b.hitIds.push(e.id);
          const crit = Math.random() < (b.critChance || 0);
          const dmg = b.dmg * (crit ? (b.critDmg || 1.8) : 1);
          En.damage(e, dmg, { crit: crit });
          e.kx = (e.kx || 0) + b.vx * 0.018;
          e.ky = (e.ky || 0) + b.vy * 0.018;
          AE.FX.spark(b.x, b.y, b.color, crit ? 8 : 4, {
            spd: crit ? 220 : 140, life: 0.3, size: 2.4,
            angle: Math.atan2(-b.vy, -b.vx), spread: 0.9
          });
          if (b.blast) {
            this.explodeBullet(b, e);
            bs.splice(i, 1);
            break;
          }
          if (b.pierce > 0) {
            b.pierce--;
            b.life = Math.min(b.life, 0.35);
          } else if (b.ricochet && b.ricochet > 0) {
            const nxt = this.findRicochet(b, e);
            if (nxt) {
              b.ricochet--;
              b.hitIds = [e.id];
              const ang = Math.atan2(nxt.y - b.y, nxt.x - b.x);
              const sp = Math.hypot(b.vx, b.vy);
              b.vx = Math.cos(ang) * sp; b.vy = Math.sin(ang) * sp;
              b.life = 0.5;
            } else {
              bs.splice(i, 1);
            }
          } else {
            bs.splice(i, 1);
          }
          break;
        }
      }
    },

    findRicochet: function (b, exclude) {
      let best = null, bd = 240 * 240;
      const list = AE.Enemies.list;
      for (let i = 0; i < list.length; i++) {
        const e = list[i];
        if (!e.alive || e === exclude) continue;
        const dd = U.d2(b.x, b.y, e.x, e.y);
        if (dd < bd) { bd = dd; best = e; }
      }
      return best;
    },

    explodeBullet: function (b, direct) {
      const R = b.blastR || 40;
      AE.FX.ring(b.x, b.y, b.color, 4, R, 0.32, 3);
      AE.FX.spark(b.x, b.y, b.color, 12, { spd: 240, life: 0.4, size: 3 });
      AE.Audio.sfx('blast');
      const near = Grid.query(b.x, b.y, R);
      const hit = [];
      for (let i = 0; i < near.length; i++) {
        const e = near[i];
        if (!e.alive || e === direct) continue;
        if (hit.indexOf(e.id) >= 0) continue;
        if (U.d2(b.x, b.y, e.x, e.y) > R * R) continue;
        hit.push(e.id);
        AE.Enemies.damage(e, (b.blast || 30) * 0.85, { crit: false });
      }
    },

    updateEBullets: function (dt, p) {
      const bs = this.ebullets;
      for (let i = bs.length - 1; i >= 0; i--) {
        const b = bs[i];
        b.life -= dt;
        b.x += b.vx * dt;
        b.y += b.vy * dt;
        if (b.life <= 0 || b.x < -60 || b.x > AE.Data.CONST.WORLD_W + 60 || b.y < -60 || b.y > AE.Data.CONST.WORLD_H + 60) {
          bs.splice(i, 1);
          continue;
        }
        if (!p.alive) continue;
        const rr = p.r + b.r - 3;
        if (U.d2(b.x, b.y, p.x, p.y) < rr * rr) {
          AE.Player.hurt(p, b.dmg, b.x, b.y);
          AE.FX.spark(b.x, b.y, b.color, 6, { spd: 140, life: 0.3, size: 2.5 });
          bs.splice(i, 1);
        }
      }
    },

    updateOrbs: function (dt, p) {
      const orbs = this.orbs;
      const pr = AE.Player.pickupRadius(p);
      const magnet = pr * pr;
      for (let i = orbs.length - 1; i >= 0; i--) {
        const o = orbs[i];
        o.t += dt;
        const d2 = U.d2(o.x, o.y, p.x, p.y);
        o.pull = o.pull || d2 < magnet;
        if (o.pull && p.alive) {
          const d = Math.sqrt(d2) || 1;
          const sp = 320 + (1 - Math.min(1, d / pr)) * 520;
          o.x += (p.x - o.x) / d * sp * dt;
          o.y += (p.y - o.y) / d * sp * dt;
        } else {
          o.x += o.vx * dt; o.y += o.vy * dt;
          const drag = Math.pow(0.02, dt);
          o.vx *= drag; o.vy *= drag;
        }
        if (d2 < (p.r + 10) * (p.r + 10)) {
          AE.Game.gainXp(o.val);
          AE.Audio.sfx('pickup', { pitch: 0.9 + Math.min(1.2, (AE.G.combo || 0) * 0.01) });
          AE.FX.spark(o.x, o.y, '#ffd479', 3, { spd: 70, life: 0.25, size: 2 });
          orbs.splice(i, 1);
        }
      }
    },

    updatePickups: function (dt, p) {
      const ps = this.pickups;
      for (let i = ps.length - 1; i >= 0; i--) {
        const o = ps[i];
        o.t += dt; o.life -= dt;
        if (o.life <= 0) { ps.splice(i, 1); continue; }
        if (!p.alive) continue;
        if (U.d2(o.x, o.y, p.x, p.y) < (p.r + 22) * (p.r + 22)) {
          if (o.type === 'heal') {
            AE.Player.heal(p, p.maxHp * 0.24);
            AE.FX.ring(o.x, o.y, '#8affc1', 4, 46, 0.4, 2);
            AE.Audio.sfx('pickup', { pitch: 0.7 });
            AE.Game.announce('回复生命', '#8affc1', 0.8);
          }
          ps.splice(i, 1);
        }
      }
    },

    /* ---------- 绘制 ---------- */
    draw: function (ctx, time) {
      const v = AE.Cam.view();
      // 经验球
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      for (let i = 0; i < this.orbs.length; i++) {
        const o = this.orbs[i];
        if (o.x < v.x0 - 20 || o.x > v.x1 + 20 || o.y < v.y0 - 20 || o.y > v.y1 + 20) continue;
        const bob = 1 + Math.sin(time * 5 + o.x) * 0.12;
        AE.FX.glow(ctx, o.x, o.y, o.r * 4, o.val >= 20 ? '#ffd479' : (o.val >= 6 ? '#9fe8ff' : '#7df9ff'), 0.55);
        ctx.fillStyle = o.val >= 20 ? '#ffe9a8' : '#d8fbff';
        ctx.beginPath();
        ctx.arc(o.x, o.y, o.r * bob, 0, U.TAU);
        ctx.fill();
      }
      ctx.restore();

      // 掉落物
      for (let i = 0; i < this.pickups.length; i++) {
        const o = this.pickups[i];
        const s = 1 + Math.sin(time * 4 + o.t) * 0.1;
        ctx.save();
        ctx.translate(o.x, o.y + Math.sin(time * 3 + o.t) * 4);
        ctx.globalCompositeOperation = 'lighter';
        AE.FX.glow(ctx, 0, 0, 34 * s, '#8affc1', 0.5);
        ctx.globalCompositeOperation = 'source-over';
        ctx.strokeStyle = '#8affc1';
        ctx.lineWidth = 2.4;
        ctx.beginPath(); ctx.arc(0, 0, 11 * s, 0, U.TAU); ctx.stroke();
        ctx.fillStyle = '#c9ffe6';
        ctx.fillRect(-2 * s, -7 * s, 4 * s, 14 * s);
        ctx.fillRect(-7 * s, -2 * s, 14 * s, 4 * s);
        ctx.restore();
      }

      // 玩家子弹
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      for (let i = 0; i < this.bullets.length; i++) {
        const b = this.bullets[i];
        const a = Math.min(1, b.life * 3);
        ctx.globalAlpha = a;
        if (b.kind === 'seeker') {
          const ang = Math.atan2(b.vy, b.vx);
          AE.FX.glow(ctx, b.x, b.y, 18, b.color, 0.8);
          ctx.save();
          ctx.translate(b.x, b.y); ctx.rotate(ang);
          ctx.fillStyle = '#ffe9c9';
          ctx.beginPath();
          ctx.moveTo(8, 0); ctx.lineTo(-5, -4); ctx.lineTo(-2, 0); ctx.lineTo(-5, 4);
          ctx.closePath(); ctx.fill();
          ctx.restore();
        } else if (b.kind === 'shard') {
          const ang = Math.atan2(b.vy, b.vx);
          AE.FX.glow(ctx, b.x, b.y, 14, b.color, 0.7);
          ctx.save();
          ctx.translate(b.x, b.y); ctx.rotate(ang);
          ctx.fillStyle = '#ffe0ee';
          ctx.beginPath();
          ctx.moveTo(7, 0); ctx.lineTo(-4, -3); ctx.lineTo(-4, 3);
          ctx.closePath(); ctx.fill();
          ctx.restore();
        } else {
          const ang = Math.atan2(b.vy, b.vx);
          ctx.strokeStyle = b.color;
          ctx.lineWidth = b.r * 1.5;
          ctx.lineCap = 'round';
          ctx.beginPath();
          ctx.moveTo(b.x - Math.cos(ang) * b.r * 2.2, b.y - Math.sin(ang) * b.r * 2.2);
          ctx.lineTo(b.x + Math.cos(ang) * b.r * 0.8, b.y + Math.sin(ang) * b.r * 0.8);
          ctx.stroke();
          ctx.strokeStyle = '#ffffff';
          ctx.lineWidth = Math.max(1, b.r * 0.45);
          ctx.beginPath();
          ctx.moveTo(b.x - Math.cos(ang) * b.r * 1.4, b.y - Math.sin(ang) * b.r * 1.4);
          ctx.lineTo(b.x + Math.cos(ang) * b.r * 0.6, b.y + Math.sin(ang) * b.r * 0.6);
          ctx.stroke();
          ctx.lineCap = 'butt';
        }
      }
      ctx.restore();

      // 敌方子弹
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      for (let i = 0; i < this.ebullets.length; i++) {
        const b = this.ebullets[i];
        AE.FX.glow(ctx, b.x, b.y, b.r * 4.6, b.color, 0.6);
        ctx.fillStyle = b.color;
        ctx.beginPath();
        ctx.arc(b.x, b.y, b.r, 0, U.TAU);
        ctx.fill();
        ctx.fillStyle = 'rgba(255,255,255,0.85)';
        ctx.beginPath();
        ctx.arc(b.x, b.y, b.r * 0.42, 0, U.TAU);
        ctx.fill();
      }
      ctx.restore();
    }
  };

  World.grid.init();
  AE.World = World;
})(typeof window !== 'undefined' ? window : globalThis);
