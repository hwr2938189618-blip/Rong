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
      p.channeling = false;
      for (let i = 0; i < p.weapons.length; i++) {
        const w = p.weapons[i];
        const def = D.WEAPON_MAP[w.id];
        if (!def) continue;
        const s = D.weaponStats(w, w.level);
        if (!s) continue;
        if (w.id === 'orbit') {
          w.spin = (w.spin || 0) + s.rot * dt;
          W.orbitHit(p, w, s);
          // 环刃不再只能近身：定期向附近敌人甩出刃片
          w.launchT = (w.launchT === undefined ? 0.9 : w.launchT) - dt;
          if (w.launchT <= 0) {
            w.launchT = 1.25;
            const ts = W.nearestEnemies(p.x, p.y, 2, 430);
            for (let ti = 0; ti < ts.length; ti++) {
              const t = ts[ti];
              const a = Math.atan2(t.y - p.y, t.x - p.x);
              AE.World.addBullet({
                x: p.x + Math.cos(a) * 16, y: p.y + Math.sin(a) * 16,
                vx: Math.cos(a) * 430, vy: Math.sin(a) * 430,
                r: 5, dmg: s.dmg * 0.9 * p.dmgMul, life: 1.3,
                color: '#b388ff', kind: 'shard', pierce: 1, hitIds: [],
                critChance: p.crit, critDmg: p.critDmg, size: 5, homing: 0, trailT: 0
              });
            }
            if (ts.length) AE.Audio.sfx('orbit');
          }
        } else if (w.id === 'beam') {
          W.updateBeam(p, w, s, def, dt);
        } else {
          w.t -= dt;
          if (w.t <= 0) {
            const surge = (AE.G.event && AE.G.event.id === 'surge') ? 1.35 : 1;
            w.t = Math.max(0.08, s.cd / Math.max(0.25, p.atkSpd * surge));
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
        case 'well': {
          const target = W.nearestEnemies(p.x, p.y, 1, 760)[0];
          let cx, cy;
          if (target) { cx = target.x; cy = target.y; }
          else { cx = p.x + Math.cos(p.aimAngle) * 260; cy = p.y + Math.sin(p.aimAngle) * 260; }
          const C = AE.Data.CONST;
          cx = U.clamp(cx, 40, C.WORLD_W - 40);
          cy = U.clamp(cy, 40, C.WORLD_H - 40);
          AE.World.addZone({
            kind: 'well', x: cx, y: cy, r: s.radius * (0.8 + p.areaMul * 0.2),
            life: s.duration, max: s.duration, dmg: s.dmg, tick: s.tick,
            tickT: 0.12, pull: s.pull || 0, color: def.color,
            implode: s.implode || 0, dmgMul: p.dmgMul,
            critChance: p.crit, critDmg: p.critDmg
          });
          AE.Audio.sfx('well');
          AE.FX.ring(cx, cy, def.color, 12, s.radius, 0.5, 3);
          break;
        }
        case 'lance': {
          const boss = AE.Enemies.list.filter(function (e) { return e.boss && e.alive; })[0];
          const target = boss || W.nearestEnemies(p.x, p.y, 1, s.range)[0];
          const base = target ? Math.atan2(target.y - p.y, target.x - p.x) : p.aimAngle;
          const beams = s.beams || 1;
          for (let i = 0; i < beams; i++) {
            const k = beams === 1 ? 0 : (i - (beams - 1) / 2);
            W.fireLance(p, s, base + k * (s.spread || 0), def);
          }
          AE.Audio.sfx('lance');
          AE.FX.shake(0.12);
          break;
        }
        case 'scythe': {
          const n = s.count || 2;
          for (let i = 0; i < n; i++) {
            const a = p.aimAngle + (i - (n - 1) / 2) * (s.spread || 0.55);
            AE.World.addBullet({
              x: p.x + Math.cos(a) * 14, y: p.y + Math.sin(a) * 14,
              vx: Math.cos(a) * s.speed, vy: Math.sin(a) * s.speed,
              r: 8, dmg: s.dmg * p.dmgMul, life: s.life || 1.5,
              color: def.color, kind: 'shard', pierce: 3, hitIds: [],
              critChance: p.crit, critDmg: p.critDmg, size: s.size || 8,
              homing: 0, trailT: 0, boomerang: true, bt: 0
            });
          }
          AE.Audio.sfx('orbit');
          break;
        }
        case 'bloom': {
          const n = s.count || 8;
          const off = Math.random() * U.TAU;
          for (let i = 0; i < n; i++) {
            const a = off + i / n * U.TAU;
            AE.World.addBullet({
              x: p.x + Math.cos(a) * 12, y: p.y + Math.sin(a) * 12,
              vx: Math.cos(a) * s.speed, vy: Math.sin(a) * s.speed,
              r: 5, dmg: s.dmg * p.dmgMul, life: s.life || 1.1,
              color: i % 3 === 0 ? '#ffd479' : def.color, kind: 'shard',
              pierce: s.pierce || 1, hitIds: [],
              critChance: p.crit, critDmg: p.critDmg, size: s.size || 5,
              homing: 0, trailT: 0
            });
          }
          AE.Audio.sfx('pulse');
          break;
        }
      }
    },

    /* ---------- 湮灭光束（持续引导） ---------- */
    updateBeam: function (p, w, s, def, dt) {
      w.t -= dt;
      if (w.beamT > 0) {
        p.channeling = true;
        w.beamT -= dt;
        w.beamTick = (w.beamTick || 0) - dt;
        if (w.beamTick <= 0) {
          w.beamTick = 0.1;
          W.beamTick(p, w, s, def);
        }
        if (w.beamT <= 0) w.beamT = 0;
        return;
      }
      if (w.t <= 0) {
        w.t = Math.max(0.08, s.cd / Math.max(0.25, p.atkSpd));
        W.startBeam(p, w, s, def);
      }
    },

    startBeam: function (p, w, s, def) {
      const boss = AE.Enemies.list.filter(function (e) { return e.boss && e.alive; })[0];
      const target = boss || W.nearestEnemies(p.x, p.y, 1, s.range)[0];
      w.beamAngle = target ? Math.atan2(target.y - p.y, target.x - p.x) : p.aimAngle;
      w.beamT = s.duration || 0.6;
      w.beamTick = 0;
      AE.FX.ring(p.x, p.y, def.color, 8, 38, 0.28, 2);
      AE.FX.spark(p.x + Math.cos(w.beamAngle) * 18, p.y + Math.sin(w.beamAngle) * 18,
        def.color, 6, { spd: 160, life: 0.3, size: 2.8 });
      AE.Audio.sfx('lance', { pitch: 1.15 });
    },

    beamTick: function (p, w, s, def) {
      const width = s.width * (p.beamWidth || 1) * (0.85 + p.areaMul * 0.15);
      const x1 = p.x, y1 = p.y;
      const x2 = x1 + Math.cos(w.beamAngle) * s.range;
      const y2 = y1 + Math.sin(w.beamAngle) * s.range;
      AE.FX.line(x1, y1, x2, y2, def.color, 0.12, width, false);
      AE.FX.line(x1, y1, x2, y2, '#ffffff', 0.08, Math.max(2, width * 0.3), false);
      const list = AE.Enemies.list;
      const cos = Math.cos(w.beamAngle), sin = Math.sin(w.beamAngle);
      for (let i = 0; i < list.length; i++) {
        const e = list[i];
        if (!e.alive || e.spawning > 0) continue;
        const dist = AE.Enemies.pointLineDist(e.x, e.y, x1, y1, x2, y2);
        if (dist > e.r + width * 0.5) continue;
        const dot = (e.x - x1) * cos + (e.y - y1) * sin;
        if (dot < -20) continue;
        W.rollCrit(p, e, s.dmg, { x: e.x, y: e.y });
      }
    },

    fireLance: function (p, s, angle, def) {
      const width = s.width * (0.85 + p.areaMul * 0.15);
      const len = s.range;
      const x1 = p.x, y1 = p.y;
      const x2 = p.x + Math.cos(angle) * len;
      const y2 = p.y + Math.sin(angle) * len;
      AE.FX.line(x1, y1, x2, y2, def.color, 0.22, width, false);
      AE.FX.line(x1, y1, x2, y2, '#ffffff', 0.16, Math.max(2, width * 0.3), false);
      AE.FX.spark(x1 + Math.cos(angle) * 18, y1 + Math.sin(angle) * 18, def.color, 8,
        { angle: angle, spread: 0.5, spd: 260, life: 0.3, size: 3 });
      const list = AE.Enemies.list;
      for (let i = 0; i < list.length; i++) {
        const e = list[i];
        if (!e.alive || e.spawning > 0) continue;
        const dist = AE.Enemies.pointLineDist(e.x, e.y, x1, y1, x2, y2);
        if (dist > e.r + width * 0.5) continue;
        const dot = (e.x - x1) * Math.cos(angle) + (e.y - y1) * Math.sin(angle);
        if (dot < -20) continue;
        W.rollCrit(p, e, s.dmg, { x: e.x, y: e.y });
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
      const now = AE.G.time;
      w.orbT = w.orbT || [];
      for (let b = 0; b < s.count; b++) {
        if (now - (w.orbT[b] || -9) < s.hitCd) continue;
        const a = w.spin + b * U.TAU / s.count;
        const bx = p.x + Math.cos(a) * baseR;
        const by = p.y + Math.sin(a) * baseR;
        for (let i = 0; i < list.length; i++) {
          const e = list[i];
          if (!e.alive || e.spawning > 0) continue;
          const rr = e.r + bladeR;
          if (U.d2(bx, by, e.x, e.y) > rr * rr) continue;
          w.orbT[b] = now;
          W.rollCrit(p, e, s.dmg, { x: bx, y: by });
          e.kx = (e.kx || 0) + Math.cos(a) * 22;
          e.ky = (e.ky || 0) + Math.sin(a) * 22;
          AE.FX.spark(bx, by, '#b388ff', 6, { spd: 180, life: 0.3, size: 2.6 });
          AE.Audio.sfx('orbit');
          break;
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
