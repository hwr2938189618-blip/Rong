/* ============================================================
 * weapons.js — 六种武器的开火逻辑 / 环刃判定 / 绘制
 * ============================================================ */
(function (g) {
  'use strict';
  const AE = (g.AE = g.AE || {});
  const U = AE.U;

  const W = {
    update: function (p, dt) {
      const D = AE.Data;
      for (let i = 0; i < p.weapons.length; i++) {
        const w = p.weapons[i];
        const def = D.WEAPON_MAP[w.id];
        if (!def) continue;
        const s = D.weaponStats(w, w.level);
        if (!s) continue;
        if (w.id === 'orbit') {
          w.spin = (w.spin || 0) + s.rot * dt;
          W.orbitHit(p, w, s);
        } else {
          w.t -= dt;
          if (w.t <= 0) {
            w.t = Math.max(0.08, s.cd / Math.max(0.25, p.atkSpd));
            W.fire(p, w, def, s);
          }
        }
      }
    },

    /* ---------- 通用 ---------- */
    nearestEnemies: function (x, y, n, range, exclude) {
      const list = AE.Enemies.list;
      const out = [];
      const maxD = range * range;
      for (let i = 0; i < list.length; i++) {
        const e = list[i];
        if (!e.alive || e.spawning > 0) continue;
        const dd = U.d2(x, y, e.x, e.y);
        if (dd > maxD) continue;
        if (exclude && exclude.indexOf(e) >= 0) continue;
        // BOSS 优先级更高：更远的 BOSS 也会被优先锁定
        out.push({ e: e, d: dd * (e.boss ? 0.42 : (e.elite ? 0.8 : 1)) });
      }
      out.sort(function (a, b) { return a.d - b.d; });
      const res = [];
      for (let i = 0; i < out.length && i < n; i++) res.push(out[i].e);
      return res;
    },

    rollCrit: function (p, e, base, opts) {
      const crit = Math.random() < p.crit;
      const dmg = base * p.dmgMul * (crit ? p.critDmg : 1);
      return AE.Enemies.damage(e, dmg, {
        crit: crit, x: opts && opts.x, y: opts && opts.y
      });
    },

    /* ---------- 各武器开火 ---------- */
    fire: function (p, w, def, s) {
      const World = AE.World;
      switch (w.id) {
        case 'pulse': {
          const targets = W.nearestEnemies(p.x, p.y, s.count, 720);
          const count = s.count;
          if (!targets.length) {
            // 无目标时朝瞄准方向发射
            for (let i = 0; i < count; i++) {
              const a = p.aimAngle + (i - (count - 1) / 2) * 0.06;
              W.spawnBolt(p, w, s, p.x, p.y, a);
            }
          } else {
            for (let i = 0; i < count; i++) {
              const t = targets[i % targets.length];
              const a = Math.atan2(t.y - p.y, t.x - p.x) + U.rnd(-0.04, 0.04);
              W.spawnBolt(p, w, s, p.x, p.y, a, t);
            }
          }
          AE.Audio.sfx('pulse', { pan: U.clamp((p.x - AE.Cam.x) / 600, -1, 1) });
          break;
        }
        case 'seek': {
          const targets = W.nearestEnemies(p.x, p.y, s.count, 760);
          for (let i = 0; i < s.count; i++) {
            const t = targets[i % Math.max(1, targets.length)] || null;
            const a = t ? Math.atan2(t.y - p.y, t.x - p.x) : p.aimAngle;
            const off = i * 0.9;
            const bx = p.x + Math.cos(a + off) * 14;
            const by = p.y + Math.sin(a + off) * 14;
            World.addBullet({
              x: bx, y: by,
              vx: Math.cos(a) * s.speed, vy: Math.sin(a) * s.speed,
              r: 7, dmg: s.dmg * p.dmgMul, life: 2.6,
              color: def.color, kind: 'seeker', homing: 3.4,
              target: t, blast: s.blast, blastR: s.radius * (0.85 + p.areaMul * 0.15),
              pierce: 0, hitIds: [], critChance: p.crit, critDmg: p.critDmg,
              size: 6, trailT: 0
            });
          }
          AE.Audio.sfx('seek');
          break;
        }
        case 'arc': {
          const first = W.nearestEnemies(p.x, p.y, 1, s.range * (0.7 + p.areaMul * 0.3))[0];
          if (!first) break;
          let cur = first;
          let fromX = p.x, fromY = p.y;
          let dmg = s.dmg;
          const hit = [];
          const jumps = s.chains;
          for (let i = 0; i < jumps; i++) {
            if (!cur) break;
            hit.push(cur);
            AE.FX.line(fromX, fromY, cur.x, cur.y, def.color, 0.18, 3, true);
            AE.FX.spark(cur.x, cur.y, def.color, 4, { spd: 130, life: 0.3, size: 2 });
            W.rollCrit(p, cur, dmg, { x: cur.x, y: cur.y });
            if (s.stun) { cur.stun = Math.max(cur.stun || 0, s.stun); }
            dmg *= s.falloff;
            fromX = cur.x; fromY = cur.y;
            const nexts = W.nearestEnemies(fromX, fromY, 6, 220, hit);
            cur = nexts[0] || null;
          }
          AE.Audio.sfx('arc');
          AE.FX.ring(first.x, first.y, def.color, 4, 26, 0.25, 2);
          break;
        }
        case 'nova': {
          const radius = s.radius * p.areaMul;
          const list = AE.Enemies.list;
          for (let i = 0; i < list.length; i++) {
            const e = list[i];
            if (!e.alive) continue;
            if (U.d2(p.x, p.y, e.x, e.y) > radius * radius) continue;
            W.rollCrit(p, e, s.dmg, { x: e.x, y: e.y });
            const n = U.norm(e.x - p.x, e.y - p.y);
            const kb = (s.kb || 160) * (e.boss ? 0.12 : (e.elite ? 0.4 : 1));
            e.kx = (e.kx || 0) + n.x * kb;
            e.ky = (e.ky || 0) + n.y * kb;
          }
          AE.FX.ring(p.x, p.y, def.color, 8, radius, 0.42, 4);
          AE.FX.ring(p.x, p.y, '#ffffff', 4, radius * 0.7, 0.28, 1.6);
          AE.FX.spark(p.x, p.y, def.color, 22, { spd: 320, life: 0.5, size: 3 });
          AE.Audio.sfx('nova');
          AE.FX.shake(0.22);
          if (s.pull) {
            // 进化：先吸引
            for (let i = 0; i < list.length; i++) {
              const e = list[i];
              if (!e.alive || e.boss) continue;
              if (U.d2(p.x, p.y, e.x, e.y) > (radius * 1.5) * (radius * 1.5)) continue;
              const n = U.norm(p.x - e.x, p.y - e.y);
              e.kx = (e.kx || 0) + n.x * s.pull;
              e.ky = (e.ky || 0) + n.y * s.pull;
            }
            AE.Game.delay(0.28, function () {
              AE.FX.ring(p.x, p.y, '#ffe9a8', 12, radius * 0.85, 0.4, 6);
              const l2 = AE.Enemies.list;
              for (let i = 0; i < l2.length; i++) {
                const e = l2[i];
                if (!e.alive) continue;
                if (U.d2(p.x, p.y, e.x, e.y) > (radius * 0.85) * (radius * 0.85)) continue;
                W.rollCrit(p, e, s.second || 60, { x: e.x, y: e.y });
              }
              AE.FX.shake(0.3);
            });
          }
          break;
        }
        case 'prism': {
          const base = p.aimAngle;
          for (let i = 0; i < s.count; i++) {
            const k = s.count === 1 ? 0 : (i / (s.count - 1) - 0.5);
            const a = base + k * s.spread + U.rnd(-0.05, 0.05);
            AE.World.addBullet({
              x: p.x + Math.cos(a) * 10, y: p.y + Math.sin(a) * 10,
              vx: Math.cos(a) * s.speed, vy: Math.sin(a) * s.speed,
              r: 5, dmg: s.dmg * p.dmgMul, life: s.life,
              color: def.color, kind: 'shard', pierce: s.pierce, hitIds: [],
              critChance: p.crit, critDmg: p.critDmg, size: 5.5,
              ricochet: s.ricochet || 0, trailT: 0
            });
          }
          AE.Audio.sfx('prism');
          break;
        }
      }
    },

    spawnBolt: function (p, w, s, x, y, a, target) {
      AE.World.addBullet({
        x: x + Math.cos(a) * 12, y: y + Math.sin(a) * 12,
        vx: Math.cos(a) * s.speed, vy: Math.sin(a) * s.speed,
        r: s.size || 4.5, dmg: s.dmg * p.dmgMul, life: 1.2,
        color: '#7df9ff', kind: 'bolt', pierce: s.pierce || 0, hitIds: [],
        critChance: p.crit, critDmg: p.critDmg, size: s.size || 4.5,
        homing: s.homing || 0, target: target || null, trailT: 0
      });
    },

    /* ---------- 环刃 ---------- */
    orbitHit: function (p, w, s) {
      const baseR = s.radius * (0.7 + p.areaMul * 0.3);
      const list = AE.Enemies.list;
      const bladeR = 13;
      for (let b = 0; b < s.count; b++) {
        const a = w.spin + b * U.TAU / s.count;
        const bx = p.x + Math.cos(a) * baseR;
        const by = p.y + Math.sin(a) * baseR;
        for (let i = 0; i < list.length; i++) {
          const e = list[i];
          if (!e.alive || e.spawning > 0) continue;
          if ((e.orbCd || 0) > 0) continue;
          const rr = e.r + bladeR;
          if (U.d2(bx, by, e.x, e.y) > rr * rr) continue;
          e.orbCd = s.hitCd;
          W.rollCrit(p, e, s.dmg, { x: bx, y: by });
          e.kx = (e.kx || 0) + Math.cos(a) * 22;
          e.ky = (e.ky || 0) + Math.sin(a) * 22;
          AE.FX.spark(bx, by, '#b388ff', 6, { spd: 180, life: 0.3, size: 2.6 });
          AE.Audio.sfx('orbit');
        }
      }
    },

    draw: function (ctx, p) {
      const D = AE.Data;
      for (let i = 0; i < p.weapons.length; i++) {
        const w = p.weapons[i];
        const def = D.WEAPON_MAP[w.id];
        if (!def) continue;
        const s = D.weaponStats(w, w.level);
        if (w.id === 'orbit' && s) {
          const baseR = s.radius * (0.7 + p.areaMul * 0.3);
          ctx.save();
          ctx.globalCompositeOperation = 'lighter';
          ctx.strokeStyle = AE.FX.alpha(def.color, 0.08);
          ctx.lineWidth = 1;
          ctx.beginPath();
          ctx.arc(p.x, p.y, baseR, 0, U.TAU);
          ctx.stroke();
          ctx.restore();
          for (let b = 0; b < s.count; b++) {
            const a = w.spin + b * U.TAU / s.count;
            const bx = p.x + Math.cos(a) * baseR;
            const by = p.y + Math.sin(a) * baseR;
            ctx.save();
            ctx.translate(bx, by);
            ctx.rotate(a + Math.PI / 2);
            ctx.globalCompositeOperation = 'lighter';
            AE.FX.glow(ctx, 0, 0, 26, def.color, 0.55);
            ctx.globalCompositeOperation = 'source-over';
            ctx.fillStyle = '#1a1030';
            ctx.strokeStyle = def.color;
            ctx.lineWidth = 2;
            ctx.beginPath();
            ctx.moveTo(0, -16);
            ctx.lineTo(7, 0);
            ctx.lineTo(0, 16);
            ctx.lineTo(-7, 0);
            ctx.closePath();
            ctx.fill();
            ctx.stroke();
            ctx.fillStyle = '#ffffff';
            ctx.beginPath();
            ctx.arc(0, 0, 2, 0, U.TAU);
            ctx.fill();
            ctx.restore();
          }
        }
      }
    }
  };

  AE.Weapons = W;
})(typeof window !== 'undefined' ? window : globalThis);
