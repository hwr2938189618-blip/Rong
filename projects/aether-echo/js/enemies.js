/* ============================================================
 * enemies.js — 敌群 AI / 七个种族 / 四场 BOSS 战 / 绘制
 * ============================================================ */
(function (g) {
  'use strict';
  const AE = (g.AE = g.AE || {});
  const U = AE.U;
  let UID = 1;

  const En = {
    list: [],
    reset: function () { this.list.length = 0; },

    /* ---------- 生成 ---------- */
    spawn: function (typeId, x, y, opts) {
      const D = AE.Data, G = AE.G;
      const def = D.ENEMIES[typeId];
      if (!def) return null;
      if (this.list.length >= D.CONST.MAX_ENEMIES) return null;
      opts = opts || {};
      const hpScale = D.hpScale(G.time, G.loop);
      const dmgScale = D.dmgScale(G.time, G.loop);
      const mod = G.mod || {};
      const elite = !!opts.elite;
      const e = {
        id: UID++, type: typeId, def: def,
        x: x, y: y, r: def.r * (elite ? 1.45 : 1),
        maxHp: def.hp * hpScale * (elite ? 6 : 1) * (opts.hpMul || 1) * (mod.enemyHp || 1),
        hp: 0,
        speed: def.speed * (elite ? 0.92 : 1) * (mod.enemySpeed || 1),
        dmg: def.dmg * dmgScale * (elite ? 1.4 : 1) * (mod.enemyDmg || 1),
        armor: (def.armor || 0) + (elite ? 3 : 0),
        xp: def.xp * (elite ? 8 : 1),
        color: elite ? '#ffd479' : def.color,
        shape: def.shape, behavior: def.behavior,
        elite: elite, boss: false,
        alive: true, t: 0, phase: U.rnd(0, 100),
        flash: 0, orbCd: 0, stun: 0, kx: 0, ky: 0,
        spawning: 0.42, rot: U.rnd(0, U.TAU), spin: U.rnd(-2, 2),
        mode: 'chase', modeT: 0, shootT: U.rnd(0.6, 2.0), healT: U.rnd(1, 3),
        chargeDir: { x: 1, y: 0 }, fuse: 0, scale: elite ? 1.45 : 1
      };
      e.hp = e.maxHp;
      if (e.behavior === 'wisp') { e.mode = 'orbit'; e.modeT = U.rnd(1.2, 2.4); }
      if (e.behavior === 'charger') { e.mode = 'idle'; e.modeT = U.rnd(1.2, 2.2); }
      this.list.push(e);
      if (!opts.silent) {
        AE.FX.ring(x, y, e.color, 2, e.r * 2.4, 0.35, 1.5);
        AE.FX.spark(x, y, e.color, elite ? 18 : 5, { spd: 120, life: 0.35, size: 2 });
      }
      return e;
    },

    spawnBoss: function (def, x, y) {
      const D = AE.Data, G = AE.G;
      const e = {
        id: UID++, type: 'boss_' + def.id, def: def,
        x: x, y: y, r: def.r, maxHp: 0, hp: 0,
        speed: def.speed * ((G.mod && G.mod.enemySpeed) || 1),
        dmg: def.dmg * D.dmgScale(G.time, G.loop) * ((G.mod && G.mod.enemyDmg) || 1),
        armor: 6, xp: def.xp, color: def.color, shape: 'boss',
        behavior: 'boss', elite: false, boss: true,
        bossName: def.name, bossTitle: def.title, ai: def.ai,
        alive: true, t: 0, phase: U.rnd(0, 100),
        flash: 0, orbCd: 0, stun: 0, kx: 0, ky: 0,
        spawning: 1.5, rot: 0, spin: 1,
        mode: 'idle', modeT: 0, t1: 1.2, t2: 3.0, t3: 5.0, t4: 7.0,
        chargeDir: { x: 1, y: 0 }, beams: [], spiral: 0, chaseT: 2.5,
        orbits: [0, 2.09, 4.19], orbitR: 118, pullT: 0,
        sweepCd: 8.5, sweepTele: 0, sweepActive: 0, sweepAng: 0, sweepSeen: false,
        phase2: false, enraged: false, scale: 1
      };
      e.maxHp = G.rush
        ? def.hp * (1 + (G.rushIndex || 0) * 0.55)
        : def.hp * (1 + (G.time / 60) * 0.42) * (1 + (G.loop || 0) * 0.8);
      e.affix = null;
      if (!G.rush && (G.loop || 0) > 0 && AE.Data.BOSS_AFFIXES) {
        const pool = AE.Data.BOSS_AFFIXES;
        e.affix = pool[Math.floor(Math.random() * pool.length)];
        if (e.affix.id === 'frenzy') { e.speed *= 1.25; e.dmg *= 1.25; }
        else if (e.affix.id === 'aegis') { e.maxHp = Math.round(e.maxHp * 1.25); e.armor += 8; }
        else if (e.affix.id === 'summoner') { e.summonT = 5; }
      }
      e.hp = e.maxHp;
      e.baseSpeed = e.speed;
      this.list.push(e);
      AE.FX.ring(x, y, def.color, 10, 140, 0.9, 4);
      AE.FX.ring(x, y, '#ffffff', 4, 90, 0.6, 2);
      AE.FX.spark(x, y, def.color, 46, { spd: 420, life: 1.0, size: 4 });
      AE.Audio.sfx('roar');
      AE.FX.shake(0.7);
      return e;
    },

    /* ---------- 主更新 ---------- */
    update: function (dt) {
      const D = AE.Data, G = AE.G, p = G.player;
      const list = this.list;
      const maxSep = 6;
      for (let i = list.length - 1; i >= 0; i--) {
        const e = list[i];
        if (!e.alive) { list.splice(i, 1); continue; }
        e.t += dt;
        e.flash = Math.max(0, e.flash - dt);
        // 灼烧：每秒 4 + 1.1×等级，持续 3 秒
        if (e.burnT > 0) {
          e.burnT -= dt;
          e.burnAcc = (e.burnAcc || 0) + dt;
          if (e.burnAcc >= 0.4) {
            e.burnAcc = 0;
            this.damage(e, (e.burnDps || 0) * 0.4, { noBurn: true, noSplash: true, noFrost: true, burnKill: true });
            if (!e.alive) continue;
          }
          if (e.t % 0.18 < dt) {
            AE.FX.spark(e.x + U.rnd(-e.r, e.r) * 0.6, e.y - e.r * 0.4,
              '#ff9f68', 1, { spd: 40, life: 0.4, size: 2.4, add: true });
          }
        }
        e.orbCd = Math.max(0, e.orbCd - dt);
        e.stun = Math.max(0, e.stun - dt);
        if (e.spawning > 0) {
          e.spawning -= dt;
          e.rot += dt * 2;
          continue;
        }

        // 击退
        if (e.kx || e.ky) {
          e.x += e.kx * dt; e.y += e.ky * dt;
          const decay = Math.pow(0.002, dt);
          e.kx *= decay; e.ky *= decay;
          if (Math.abs(e.kx) < 1) e.kx = 0;
          if (Math.abs(e.ky) < 1) e.ky = 0;
        }

        if (e.stun <= 0) {
          if (e.boss) this.updateBoss(e, dt, p);
          else this.updateMob(e, dt, p);
        }

        // 边界
        e.x = U.clamp(e.x, 12, D.CONST.WORLD_W - 12);
        e.y = U.clamp(e.y, 12, D.CONST.WORLD_H - 12);

        // 接触伤害
        if (!p.alive || p.invuln > 0) continue;
        const rr = e.r + p.r - 2;
        if (U.d2(e.x, e.y, p.x, p.y) <= rr * rr) {
          const mult = (e.boss && e.mode === 'charge') ? 1.5 :
            ((e.behavior === 'charger' && e.mode === 'dash') ? 1.6 : 1);
          AE.Player.hurt(p, e.dmg * mult, e.x, e.y);
        }
      }
    },

    updateMob: function (e, dt, p) {
      const dx = p.x - e.x, dy = p.y - e.y;
      const d = Math.hypot(dx, dy) || 1;
      const nx = dx / d, ny = dy / d;
      let sp = e.speed;
      let mx = nx, my = ny;
      const G = AE.G;

      if (e.behavior === 'stalker') {
        const wob = Math.sin(e.t * 5.5 + e.phase) * 0.75;
        mx = nx * Math.cos(wob) - ny * Math.sin(wob);
        my = nx * Math.sin(wob) + ny * Math.cos(wob);
      } else if (e.behavior === 'ranged') {
        if (d > 310) { mx = nx; my = ny; }
        else if (d < 210) { mx = -nx; my = -ny; }
        else {
          mx = -ny * Math.sin(e.phase) * 1.2;
          my = nx * Math.sin(e.phase) * 1.2;
        }
        e.shootT -= dt;
        if (e.shootT <= 0 && d < 620) {
          e.shootT = 2.3 + Math.random() * 0.8;
          const base = Math.atan2(dy, dx);
          for (let k = -1; k <= 1; k++) {
            const a = base + k * 0.17;
            AE.World.addEBullet({
              x: e.x + Math.cos(a) * (e.r + 4), y: e.y + Math.sin(a) * (e.r + 4),
              vx: Math.cos(a) * 172, vy: Math.sin(a) * 172,
              r: 6, dmg: e.dmg * 0.75, life: 5, color: '#8affc1', kind: 'orb'
            });
          }
          AE.FX.spark(e.x, e.y, '#8affc1', 4, { spd: 90, life: 0.25, size: 2 });
        }
      } else if (e.behavior === 'wisp') {
        e.modeT -= dt;
        if (e.mode === 'orbit') {
          const ang = Math.atan2(e.y - p.y, e.x - p.x) + dt * 1.5;
          const targetR = 180;
          const tx = p.x + Math.cos(ang) * targetR;
          const ty = p.y + Math.sin(ang) * targetR;
          mx = (tx - e.x); my = (ty - e.y);
          const ml = Math.hypot(mx, my) || 1;
          mx /= ml; my /= ml;
          sp *= 0.9;
          if (e.modeT <= 0) { e.mode = 'dive'; e.modeT = 1.1; }
        } else {
          mx = nx; my = ny;
          sp = e.speed * 2.9;
          if (e.modeT <= 0) { e.mode = 'orbit'; e.modeT = 2.2 + Math.random(); }
        }
      } else if (e.behavior === 'healer') {
        if (d > 330) { mx = nx; my = ny; }
        else if (d < 225) { mx = -nx; my = -ny; }
        else { mx = -ny * 0.9; my = nx * 0.9; }
        e.healT -= dt;
        if (e.healT <= 0) {
          e.healT = 4.2;
          const all = AE.Enemies.list;
          let healed = 0;
          for (let k = 0; k < all.length; k++) {
            const o = all[k];
            if (o === e || !o.alive || o.boss || o.hp >= o.maxHp) continue;
            if (U.d2(e.x, e.y, o.x, o.y) > 210 * 210) continue;
            o.hp = Math.min(o.maxHp, o.hp + o.maxHp * 0.045);
            healed++;
            if (healed <= 6) AE.FX.line(e.x, e.y, o.x, o.y, '#8affc1', 0.3, 1.6, false);
          }
          if (healed) {
            AE.FX.ring(e.x, e.y, '#8affc1', 8, 210, 0.45, 2);
            AE.Audio.sfx('heal');
          }
        }
      } else if (e.behavior === 'charger') {
        e.modeT -= dt;
        if (e.mode === 'idle') {
          mx = nx; my = ny;
          if (d < 470 && e.modeT <= 0) {
            e.mode = 'tele'; e.modeT = 0.6;
            e.chargeDir = { x: nx, y: ny };
            AE.Audio.sfx('warn');
          }
        } else if (e.mode === 'tele') {
          sp = 0;
          e.chargeDir = {
            x: U.lerp(e.chargeDir.x, nx, dt * 2.5),
            y: U.lerp(e.chargeDir.y, ny, dt * 2.5)
          };
          if (e.modeT <= 0) { e.mode = 'dash'; e.modeT = 0.38; AE.Audio.sfx('dash'); }
        } else if (e.mode === 'dash') {
          mx = e.chargeDir.x; my = e.chargeDir.y;
          sp = 560;
          AE.FX.spark(e.x, e.y, '#ff9f68', 1, { spd: 60, life: 0.25, size: 2.5 });
          if (e.modeT <= 0) { e.mode = 'recover'; e.modeT = 0.55; }
        } else {
          sp = 0;
          if (e.modeT <= 0) { e.mode = 'idle'; e.modeT = U.rnd(1.4, 2.4); }
        }
      } else if (e.behavior === 'priest') {
        // 保持中远距离，读条后发射追踪法球
        if (d > 420) { mx = nx; my = ny; }
        else if (d < 250) { mx = -nx; my = -ny; }
        else { mx = -ny * 0.7; my = nx * 0.7; }
        e.castT = (e.castT === undefined ? 2.2 : e.castT) - dt;
        if (e.castT <= 0 && d < 640) {
          e.castT = 3.2;
          const a = Math.atan2(dy, dx);
          AE.World.addEBullet({
            x: e.x, y: e.y,
            vx: Math.cos(a) * 125, vy: Math.sin(a) * 125,
            r: 7, dmg: e.dmg * 0.8, life: 4.8, color: e.color,
            kind: 'orb', homing: 1.35
          });
          AE.FX.ring(e.x, e.y, e.color, 5, 34, 0.3, 2);
          AE.FX.spark(e.x, e.y, e.color, 5, { spd: 90, life: 0.3, size: 2.4, add: true });
          AE.Audio.sfx('arc');
        }
        e.blinkT = (e.blinkT === undefined ? 6.5 : e.blinkT) - dt;
        if (e.blinkT <= 0) {
          e.blinkT = 7.5;
          const CW = AE.Data.CONST.WORLD_W, CH = AE.Data.CONST.WORLD_H;
          AE.FX.ring(e.x, e.y, e.color, 6, 60, 0.35, 2);
          const ba = Math.random() * U.TAU;
          e.x = U.clamp(p.x + Math.cos(ba) * 330, 60, CW - 60);
          e.y = U.clamp(p.y + Math.sin(ba) * 330, 60, CH - 60);
          AE.FX.ring(e.x, e.y, e.color, 6, 60, 0.35, 2);
          AE.FX.spark(e.x, e.y, e.color, 8, { spd: 120, life: 0.35, size: 2.6 });
        }
      } else if (e.behavior === 'chase') {
        // 爆裂囊靠近后启动引信
        if (e.def.explode && d < 58 && e.fuse <= 0) {
          e.fuse = 0.55;
          AE.FX.ring(e.x, e.y, '#ffd479', 4, 40, 0.4, 2);
        }
        if (e.fuse > 0) {
          e.fuse -= dt;
          sp *= 0.25;
          if (e.fuse <= 0) { this.explode(e); return; }
        }
      }

      e.x += mx * sp * dt;
      e.y += my * sp * dt;

      // 简易分离，避免完全重叠
      if (!e.elite && G.frame % 2 === 0) {
        const near = AE.World.gridNeighbors(e.x, e.y, e.r * 2.2);
        let cnt = 0;
        for (let i = 0; i < near.length && cnt < 4; i++) {
          const o = near[i];
          if (o === e || !o.alive) continue;
          const ox = e.x - o.x, oy = e.y - o.y;
          const dd = ox * ox + oy * oy;
          const rsum = e.r + o.r;
          if (dd > 0.01 && dd < rsum * rsum) {
            const dl = Math.sqrt(dd);
            const push = (rsum - dl) * 0.5;
            e.x += ox / dl * push;
            e.y += oy / dl * push;
            cnt++;
          }
        }
      }
    },

    explode: function (e) {
      const p = AE.G.player;
      const def = e.def;
      const radius = (def.explode || 90);
      AE.FX.ring(e.x, e.y, '#ffd479', 6, radius, 0.4, 3);
      AE.FX.spark(e.x, e.y, '#ffd479', 26, { spd: 300, life: 0.55, size: 3.4 });
      AE.FX.flash(0.08, '#ffd479');
      AE.FX.shake(0.18);
      AE.Audio.sfx('explosion');
      if (p.alive && U.d2(e.x, e.y, p.x, p.y) < radius * radius) {
        AE.Player.hurt(p, (def.explodeDmg || 20) * AE.Data.dmgScale(AE.G.time, AE.G.loop), e.x, e.y);
      }
      e.hp = 0;
      this.kill(e, { noExplode: true });
    },

    /* ---------- BOSS ---------- */
    updateBoss: function (e, dt, p) {
      const dx = p.x - e.x, dy = p.y - e.y;
      const d = Math.hypot(dx, dy) || 1;
      const nx = dx / d, ny = dy / d;
      e.rot += dt * 0.8;
      e.t1 -= dt; e.t2 -= dt; e.t3 -= dt; e.t4 -= dt;
      if (!e.enraged && e.hp / e.maxHp < 0.45) {
        e.enraged = true;
        AE.Audio.sfx('roar');
        AE.FX.ring(e.x, e.y, e.color, 20, 220, 0.8, 4);
        AE.FX.ring(e.x, e.y, '#ff3355', 10, 320, 1.0, 3);
        AE.FX.spark(e.x, e.y, '#ff5c7a', 40, { spd: 420, life: 0.9, size: 4 });
        AE.FX.flash(0.18, '#ff3355');
        AE.FX.shake(0.6);
        AE.Game.announce(e.bossName + ' · 暴走', e.color, 2.2);
      }
      const rage = e.enraged ? 1.25 : 1;

      // 防止玩家无限风筝：距离过远时撕裂空间逼近（带前兆特效）
      e.chaseT -= dt;
      if (e.chaseT <= 0) {
        e.chaseT = 4.2;
        if (p.alive) {
          const dd = Math.hypot(p.x - e.x, p.y - e.y);
          if (dd > 640) {
            const a = Math.random() * U.TAU;
            const CW = AE.Data.CONST.WORLD_W, CH = AE.Data.CONST.WORLD_H;
            AE.FX.ring(e.x, e.y, e.color, 10, 100, 0.5, 3);
            AE.FX.spark(e.x, e.y, e.color, 16, { spd: 220, life: 0.5, size: 3 });
            e.x = U.clamp(p.x + Math.cos(a) * 340, 80, CW - 80);
            e.y = U.clamp(p.y + Math.sin(a) * 340, 80, CH - 80);
            AE.FX.ring(e.x, e.y, e.color, 10, 140, 0.6, 3);
            AE.FX.spark(e.x, e.y, e.color, 16, { spd: 220, life: 0.5, size: 3 });
            AE.Audio.sfx('dash');
          }
        }
      }

      switch (e.ai) {
        case 'weaver': {
          if (e.spawning > 0) break;
          e.x += nx * e.speed * (p.x ? 1 : 1) * dt;
          e.y += ny * e.speed * dt;
          if (e.t1 <= 0) {
            e.t1 = 2.7 / rage;
            this.bossRadial(e, 10, 165 * rage, 0.55);
            AE.FX.ring(e.x, e.y, e.color, 20, 60, 0.3, 3);
          }
          if (e.t2 <= 0) {
            e.t2 = 6.2 / rage;
            this.summon(e, 'crawler', 4, 240);
          }
          if (e.spiral > 0) {
            e.spiral -= dt;
            e.t3 -= dt;
            if (e.t3 <= 0) {
              e.t3 = 0.09;
              const a0 = e.t * 4.5;
              for (let k = 0; k < 3; k++) {
                const a = a0 + k * U.TAU / 3;
                AE.World.addEBullet({
                  x: e.x, y: e.y, vx: Math.cos(a) * 150, vy: Math.sin(a) * 150,
                  r: 7, dmg: e.dmg * 0.5, life: 5.5, color: e.color, kind: 'orb'
                });
              }
            }
          } else if (e.enraged && e.t2 < 1) {
            e.spiral = 2.4;
            AE.Game.announce('织巢者开始编织', e.color, 1.6);
          }
          break;
        }
        case 'breaker': {
          e.modeT -= dt;
          if (e.mode === 'idle') {
            e.x += nx * e.speed * dt;
            e.y += ny * e.speed * dt;
            if (e.modeT <= 0) {
              e.mode = 'tele'; e.modeT = 0.85;
              e.chargeDir = { x: nx, y: ny };
              AE.Audio.sfx('warn');
            }
          } else if (e.mode === 'tele') {
            e.chargeDir = { x: U.lerp(e.chargeDir.x, nx, dt * 3.5), y: U.lerp(e.chargeDir.y, ny, dt * 3.5) };
            if (e.modeT <= 0) {
              e.mode = 'charge'; e.modeT = 0.55;
              AE.Audio.sfx('dash');
            }
          } else if (e.mode === 'charge') {
            const sp = 760 * rage;
            e.x += e.chargeDir.x * sp * dt;
            e.y += e.chargeDir.y * sp * dt;
            e.x = U.clamp(e.x, 40, AE.Data.CONST.WORLD_W - 40);
            e.y = U.clamp(e.y, 40, AE.Data.CONST.WORLD_H - 40);
            AE.FX.spark(e.x, e.y, e.color, 2, { spd: 100, life: 0.3, size: 3 });
            if (e.modeT <= 0) {
              e.mode = 'recover'; e.modeT = 0.8;
              this.shockwave(e, 18, 210);
              AE.FX.shake(0.4);
            }
          } else {
            if (e.modeT <= 0) { e.mode = 'idle'; e.modeT = 1.5; }
          }
          if (e.t1 <= 0) {
            e.t1 = 4.4 / rage;
            this.shockwave(e, 14, 190);
          }
          if (e.t2 <= 0) {
            e.t2 = 8 / rage;
            this.summon(e, 'stalker', 4, 260);
          }
          break;
        }
        case 'manyeye': {
          // 保持中距离
          if (d > 380) { e.x += nx * e.speed * dt * 1.6; e.y += ny * e.speed * dt * 1.6; }
          else if (d < 260) { e.x -= nx * e.speed * dt * 1.2; e.y -= ny * e.speed * dt * 1.2; }
          e.x += -ny * Math.sin(e.t * 0.6) * 34 * dt;
          e.y += nx * Math.sin(e.t * 0.6) * 34 * dt;

          if (e.mode === 'beamIdle') {
            e.modeT -= dt;
            if (e.modeT <= 0) {
              e.mode = 'beamTele'; e.modeT = 0.9;
              e.beamBase = Math.atan2(dy, dx);
              AE.Audio.sfx('warn');
              AE.FX.ring(e.x, e.y, e.color, 20, 130, 0.6, 3);
            }
          } else if (e.mode === 'beamTele') {
            if (e.modeT <= 0) {
              e.mode = 'beam'; e.modeT = 1.5;
              AE.Audio.sfx('arc');
            }
          } else if (e.mode === 'beam') {
            e.beamBase += dt * 0.7 * (e.enraged ? 1.4 : 1);
            if (e.modeT <= 0) { e.mode = 'beamIdle'; e.modeT = 2.4 / rage; e.beams = []; }
          } else {
            e.mode = 'beamIdle'; e.modeT = 2.6;
            e.beamBase = Math.atan2(dy, dx);
          }
          // 光束伤害
          if (e.mode === 'beam') {
            e.beams = [-0.24, 0.24];
            for (let i = 0; i < e.beams.length; i++) {
              const a = e.beamBase + e.beams[i];
              const ex = e.x + Math.cos(a) * 1100, ey = e.y + Math.sin(a) * 1100;
              const dist = this.pointLineDist(p.x, p.y, e.x, e.y, ex, ey);
              if (dist < 16 && p.invuln <= 0) {
                AE.Player.hurt(p, e.dmg * 0.55, e.x, e.y);
              }
            }
          } else if (e.mode !== 'beamTele') {
            e.beams = [];
          }
          if (e.t1 <= 0) {
            e.t1 = 3.3 / rage;
            this.bossRadial(e, 10, 175, 0.5);
          }
          if (e.t2 <= 0) {
            e.t2 = 7.5 / rage;
            this.summon(e, 'spitter', 3, 300);
          }
          break;
        }
        case 'eclipse': {
          // 环绕黑星：三颗绕本体旋转，碰到玩家造成伤害
          e.orbitR = 118 + Math.sin(e.t * 1.3) * 14;
          for (let i = 0; i < e.orbits.length; i++) {
            e.orbits[i] += dt * (1.15 + i * 0.14);
            const oa = e.orbits[i];
            const ox = e.x + Math.cos(oa) * e.orbitR;
            const oy = e.y + Math.sin(oa) * e.orbitR;
            if (p.alive && p.invuln <= 0 && U.d2(ox, oy, p.x, p.y) < (17 + p.r) * (17 + p.r)) {
              AE.Player.hurt(p, e.dmg * 0.8, ox, oy);
              AE.FX.spark(ox, oy, e.color, 8, { spd: 180, life: 0.35, size: 2.6 });
            }
          }
          // 中距离游走
          if (d > 380) { e.x += nx * e.speed * dt; e.y += ny * e.speed * dt; }
          else if (d < 230) { e.x -= nx * e.speed * dt * 0.8; e.y -= ny * e.speed * dt * 0.8; }

          // 引力牵引
          if (e.pullT > 0) {
            e.pullT -= dt;
            if (p.alive) {
              const pn = U.norm(e.x - p.x, e.y - p.y);
              p.x += pn.x * 135 * dt;
              p.y += pn.y * 135 * dt;
              if (Math.random() < 0.35) {
                AE.FX.spark(p.x + U.rnd(-12, 12), p.y + U.rnd(-12, 12), e.color, 1, { spd: 30, life: 0.3, size: 2 });
              }
            }
            if (e.t % 0.4 < dt) AE.FX.ring(e.x, e.y, e.color, e.r * 1.4, e.r * 3.0, 0.45, 1.6);
          } else if (e.t1 <= 0) {
            e.t1 = 9.5 / rage;
            e.pullT = 1.6;
            AE.Game.announce('星蚀 · 引力牵引', e.color, 1.6);
            AE.Audio.sfx('warn');
          }

          // 三道旋转激光
          if (e.mode === 'beamIdle') {
            e.modeT -= dt;
            if (e.modeT <= 0) {
              e.mode = 'beamTele'; e.modeT = 0.85;
              e.beamBase = Math.atan2(dy, dx);
              AE.Audio.sfx('warn');
            }
          } else if (e.mode === 'beamTele') {
            if (e.modeT <= 0) { e.mode = 'beam'; e.modeT = 1.4; AE.Audio.sfx('arc'); }
          } else if (e.mode === 'beam') {
            e.beamBase += dt * 1.05 * (e.enraged ? 1.35 : 1);
            e.beams = [-0.36, 0, 0.36];
            for (let i = 0; i < e.beams.length; i++) {
              const a = e.beamBase + e.beams[i];
              const ex = e.x + Math.cos(a) * 1100, ey = e.y + Math.sin(a) * 1100;
              if (this.pointLineDist(p.x, p.y, e.x, e.y, ex, ey) < 16 && p.invuln <= 0) {
                AE.Player.hurt(p, e.dmg * 0.5, e.x, e.y);
              }
            }
            if (e.modeT <= 0) { e.mode = 'beamIdle'; e.modeT = 2.4 / rage; e.beams = []; }
          } else {
            e.mode = 'beamIdle'; e.modeT = 2.2;
            e.beamBase = Math.atan2(dy, dx);
          }

          if (e.t2 <= 0) {
            e.t2 = 3.1 / rage;
            this.bossRadial(e, 12, 185, 0.5);
          }
          if (e.t3 <= 0) {
            e.t3 = 7.8 / rage;
            this.summon(e, 'wisp', 4, 260);
          }
          break;
        }
        case 'abyss': {
          // 触须横扫：三条由眼体向外扫出的触须，先虚线预警再实体化
          e.sweepCd -= dt;
          if (e.sweepTele > 0) {
            e.sweepTele -= dt;
            if (e.sweepTele <= 0) {
              e.sweepActive = 0.42;
              AE.Audio.sfx('arc', { pitch: 0.72 });
              AE.FX.shake(0.16);
            }
          } else if (e.sweepActive > 0) {
            e.sweepActive -= dt;
            const lanes = [-0.5, 0, 0.5];
            for (let i = 0; i < lanes.length; i++) {
              const a = e.sweepAng + lanes[i];
              const ex = e.x + Math.cos(a) * 520, ey = e.y + Math.sin(a) * 520;
              if (this.pointLineDist(p.x, p.y, e.x, e.y, ex, ey) > 27) continue;
              const dot = (p.x - e.x) * Math.cos(a) + (p.y - e.y) * Math.sin(a);
              if (dot < 0 || dot > 520) continue;
              if (p.alive && p.invuln <= 0) {
                AE.Player.hurt(p, e.dmg * 0.5, e.x, e.y);
                AE.FX.spark(p.x, p.y, e.color, 10, { spd: 210, life: 0.4, size: 3 });
              }
              break;
            }
            if (e.sweepActive <= 0) e.sweepCd = e.enraged ? 6.8 : 9.2;
          } else if (e.sweepCd <= 0) {
            e.sweepCd = 99;
            e.sweepTele = 0.95;
            e.sweepAng = Math.atan2(dy, dx);
            e.mode = 'idle';
            e.modeT = Math.max(e.modeT, 1.6);
            AE.Audio.sfx('warn', { pitch: 0.66 });
            if (!e.sweepSeen) {
              e.sweepSeen = true;
              AE.Game.announce('深渊之眼 · 触须横扫', e.color, 2.0);
            }
          }
          // 保持中远距离凝视
          if (d > 360) { e.x += nx * e.speed * dt; e.y += ny * e.speed * dt; }
          else if (d < 240) { e.x -= nx * e.speed * 0.8 * dt; e.y -= ny * e.speed * 0.8 * dt; }
          // 环绕碎片碰撞
          for (let k = 0; k < 3; k++) {
            const oa = e.t * 1.15 + k * U.TAU / 3;
            const sx = e.x + Math.cos(oa) * 136, sy = e.y + Math.sin(oa) * 136;
            if (p.invuln <= 0 && U.d2(sx, sy, p.x, p.y) < 40 * 40) {
              AE.Player.hurt(p, e.dmg * 0.35, sx, sy);
            }
          }
          // 眼睑开合 → 三束凝视激光
          if (e.mode === 'idle') {
            e.modeT -= dt;
            if (e.modeT <= 0) {
              e.mode = 'tele'; e.modeT = 1.1;
              e.beamBase = Math.atan2(dy, dx);
              AE.Audio.sfx('warn');
            }
          } else if (e.mode === 'tele') {
            if (e.modeT <= 0) { e.mode = 'beam'; e.modeT = 1.6; AE.Audio.sfx('arc'); }
          } else if (e.mode === 'beam') {
            e.modeT -= dt;
            e.beamBase += dt * 0.52 * (e.enraged ? 1.3 : 1);
            e.beams = [-0.17, 0, 0.17];
            for (let i = 0; i < e.beams.length; i++) {
              const a = e.beamBase + e.beams[i];
              const ex = e.x + Math.cos(a) * 1100, ey = e.y + Math.sin(a) * 1100;
              if (p.invuln <= 0 && this.pointLineDist(p.x, p.y, e.x, e.y, ex, ey) < 18) {
                AE.Player.hurt(p, e.dmg * 0.55, e.x, e.y);
              }
            }
            if (e.modeT <= 0) { e.mode = 'idle'; e.modeT = 2.6 / rage; e.beams = []; }
          } else {
            e.mode = 'idle'; e.modeT = 2.2;
          }
          if (e.t1 <= 0) {
            e.t1 = 3.4 / rage;
            this.bossRadial(e, 14, 175 * rage, 0.5);
          }
          if (e.t2 <= 0) {
            e.t2 = 9 / rage;
            this.summon(e, 'wisp', 3, 250);
          }
          break;
        }
        case 'final': {
          const k = e.hp / e.maxHp;
          const stage = k > 0.66 ? 1 : (k > 0.33 ? 2 : 3);
          if (stage !== e.stage) {
            e.stage = stage;
            AE.Audio.sfx('roar');
            AE.FX.flash(0.18, e.color);
            AE.FX.shake(0.6);
            AE.Game.announce(stage === 3 ? '终焉回响 · 最终形态' : (stage === 2 ? '终焉回响 · 第二阶段' : '终焉回响'), e.color, 2.4);
          }
          if (e.mode === 'charge') {
            e.modeT -= dt;
            e.x += e.chargeDir.x * 700 * dt;
            e.y += e.chargeDir.y * 700 * dt;
            e.x = U.clamp(e.x, 60, AE.Data.CONST.WORLD_W - 60);
            e.y = U.clamp(e.y, 60, AE.Data.CONST.WORLD_H - 60);
            if (e.modeT <= 0) {
              e.mode = 'idle';
              this.shockwave(e, 20, 230);
            }
          } else {
            e.x += nx * e.speed * 0.7 * dt;
            e.y += ny * e.speed * 0.7 * dt;
            if (e.t1 <= 0) {
              e.mode = 'charge'; e.modeT = 0.42;
              e.chargeDir = { x: nx, y: ny };
              AE.Audio.sfx('warn');
            }
          }
          if (e.t2 <= 0) {
            e.t2 = (stage >= 2 ? 2.4 : 3.2);
            this.bossRadial(e, stage >= 3 ? 18 : 12, 170 * (stage >= 3 ? 1.25 : 1), 0.6);
          }
          if (e.t3 <= 0) {
            e.t3 = (stage >= 2 ? 5.5 : 7.5);
            const add = stage >= 3 ? 'bulwark' : (stage >= 2 ? 'stalker' : 'crawler');
            this.summon(e, add, stage >= 3 ? 5 : 4, 260);
          }
          if (e.spiral > 0) {
            e.spiral -= dt;
            e.spiralT = (e.spiralT || 0) - dt;
            if (e.spiralT <= 0) {
              e.spiralT = 0.1;
              const a0 = e.t * 5;
              for (let s = 0; s < 4; s++) {
                const a = a0 + s * U.TAU / 4;
                AE.World.addEBullet({
                  x: e.x, y: e.y, vx: Math.cos(a) * 160, vy: Math.sin(a) * 160,
                  r: 7, dmg: e.dmg * 0.45, life: 5, color: e.color, kind: 'orb'
                });
              }
            }
          } else if (stage >= 2 && e.t3 < 2) {
            e.spiral = 3.2;
          }
          // 回响裂痕：脚下预警圈，延迟爆炸
          if (stage >= 2 && e.t4 <= 0) {
            e.t4 = stage >= 3 ? 4.8 : 6.6;
            const n = stage >= 3 ? 3 : 2;
            if (!e.riftSeen) {
              e.riftSeen = true;
              AE.Game.announce('终焉回响 · 回响裂痕', '#ff5c7a', 2.0);
            }
            AE.Audio.sfx('warn', { pitch: 0.82 });
            for (let m = 0; m < n; m++) {
              let tx = p.x, ty = p.y;
              if (m > 0) {
                const a = Math.random() * U.TAU;
                tx += Math.cos(a) * (m === 1 ? 125 : 210);
                ty += Math.sin(a) * (m === 1 ? 125 : 210);
              }
              this.finalRift(e, tx, ty, stage >= 3 ? 96 : 104);
            }
          }
          break;
        }
      }
      if (e.affix && e.affix.id === 'summoner') {
        e.summonT = (e.summonT === undefined ? 6 : e.summonT) - dt;
        if (e.summonT <= 0) {
          e.summonT = 6 / rage;
          this.summon(e, 'wisp', 2, 240);
          AE.FX.ring(e.x, e.y, e.affix.color, 8, 120, 0.5, 2);
        }
      }
      if (e.enraged) {
        e.speed = (e.baseSpeed || e.def.speed) * 1.25;
      } else if (e.affix && e.affix.id === 'frenzy') {
        e.speed = (e.baseSpeed || e.def.speed);
      }
    },

    finalRift: function (e, tx, ty, radius) {
      const CW = AE.Data.CONST.WORLD_W, CH = AE.Data.CONST.WORLD_H;
      tx = U.clamp(tx, 40, CW - 40);
      ty = U.clamp(ty, 40, CH - 40);
      radius = radius || 100;
      AE.FX.ring(tx, ty, '#ff5c7a', radius, radius, 0.85, 3);
      AE.FX.ring(tx, ty, '#ff9f68', 12, radius * 0.42, 0.85, 1.5);
      AE.FX.text(tx, ty - radius - 6, '!', '#ff5c7a', 18);
      AE.Game.delay(0.85, function () {
        if (!e.alive) return;
        AE.FX.ring(tx, ty, '#ff5c7a', radius * 0.18, radius, 0.36, 5);
        AE.FX.ring(tx, ty, '#ffffff', 8, radius * 0.5, 0.24, 2);
        AE.FX.spark(tx, ty, '#ff5c7a', 22, { spd: 330, life: 0.55, size: 3.4 });
        AE.FX.shake(0.18);
        AE.Audio.sfx('explosion', { pitch: 0.92 });
        const p = AE.G.player;
        if (p && p.alive && p.invuln <= 0 && U.d2(tx, ty, p.x, p.y) < radius * radius) {
          AE.Player.hurt(p, e.dmg * 0.8, tx, ty);
        }
      });
    },

    bossRadial: function (e, n, speed, dmgMul) {
      for (let i = 0; i < n; i++) {
        const a = i * U.TAU / n + e.t * 0.5;
        AE.World.addEBullet({
          x: e.x + Math.cos(a) * (e.r * 0.6), y: e.y + Math.sin(a) * (e.r * 0.6),
          vx: Math.cos(a) * speed, vy: Math.sin(a) * speed,
          r: 7, dmg: e.dmg * (dmgMul || 0.6), life: 6, color: e.color, kind: 'orb'
        });
      }
      AE.FX.spark(e.x, e.y, e.color, 10, { spd: 160, life: 0.4, size: 3 });
      AE.Audio.sfx('blast');
    },

    shockwave: function (e, n, speed) {
      for (let i = 0; i < n; i++) {
        const a = i * U.TAU / n + 0.2;
        AE.World.addEBullet({
          x: e.x + Math.cos(a) * e.r, y: e.y + Math.sin(a) * e.r,
          vx: Math.cos(a) * speed, vy: Math.sin(a) * speed,
          r: 9, dmg: e.dmg * 0.5, life: 4, color: '#ffd479', kind: 'ring'
        });
      }
      AE.FX.ring(e.x, e.y, '#ffd479', e.r, e.r + 80, 0.4, 4);
      AE.Audio.sfx('nova');
    },

    summon: function (e, type, n, radius) {
      if (AE.G.enemies.length > AE.Data.CONST.MAX_ENEMIES - 12) return;
      for (let i = 0; i < n; i++) {
        const a = Math.random() * U.TAU;
        const r = U.rnd(radius * 0.6, radius);
        this.spawn(type, e.x + Math.cos(a) * r, e.y + Math.sin(a) * r, { silent: true });
      }
      AE.FX.ring(e.x, e.y, e.color, 10, radius * 0.6, 0.45, 2);
    },

    pointLineDist: function (px, py, x1, y1, x2, y2) {
      const dx = x2 - x1, dy = y2 - y1;
      const len2 = dx * dx + dy * dy || 1;
      let t = ((px - x1) * dx + (py - y1) * dy) / len2;
      t = U.clamp(t, 0, 1);
      const cx = x1 + dx * t, cy = y1 + dy * t;
      return Math.hypot(px - cx, py - cy);
    },

    /* ---------- 伤害与死亡 ---------- */
    damage: function (e, amount, opts) {
      if (!e || !e.alive) return 0;
      if (e.spawning > 0) return 0;
      let dmg = amount;
      const G0 = AE.G;
      const pl0 = G0.player;
      // 连杀增伤：最高 +35%（溅射递归不重复计算）
      if (G0.combo > 0 && !(opts && opts.noCombo)) dmg *= 1 + Math.min(0.35, G0.combo * 0.006);
      // 遗物：处决之刃 —— 对残血目标增伤
      if (pl0 && pl0.relics && pl0.relics.indexOf('executioner') >= 0 &&
          e.maxHp > 0 && e.hp / e.maxHp <= 0.3) {
        dmg *= 1.45;
      }
      if (e.armor) dmg = Math.max(1, dmg - e.armor);
      e.hp -= dmg;
      e.flash = 0.09;
      const G = AE.G;
      const pl = G.player;
      G.stats.damage += dmg;
      // 灼星者：命中点燃目标；引燃被动：任意角色有概率点燃
      if (pl && !(opts && opts.noBurn) && dmg > 0) {
        if (pl.burn) {
          e.burnT = Math.max(e.burnT || 0, 3);
          e.burnDps = Math.max(e.burnDps || 0, (6 + pl.level * 1.6) * (pl.burnMul || 1));
        } else if (pl.igniteChance > 0 && Math.random() < pl.igniteChance) {
          e.burnT = Math.max(e.burnT || 0, 2.5);
          e.burnDps = Math.max(e.burnDps || 0, (4 + pl.level * 1.2) * (pl.burnMul || 1));
          AE.FX.spark(e.x, e.y, '#ff9f68', 3, { spd: 90, life: 0.3, size: 2.2, add: true });
        }
      }
      // 遗物：霜冻之触
      if (pl && pl.relics && pl.relics.indexOf('frost') >= 0 && Math.random() < 0.12) {
        e.stun = Math.max(e.stun || 0, 0.25);
        AE.FX.spark(e.x, e.y, '#9fe8ff', 3, { spd: 90, life: 0.3, size: 2.2 });
      }
      // 遗物：连锁暴击（暴击时溅射）
      if (opts && opts.crit && !opts.noSplash && pl && pl.relics && pl.relics.indexOf('critchain') >= 0) {
        const near = AE.World.grid.query(e.x, e.y, 90);
        for (let k = 0; k < near.length; k++) {
          const o = near[k];
          if (o === e || !o.alive || o.spawning > 0) continue;
          if (U.d2(e.x, e.y, o.x, o.y) > 90 * 90) continue;
          this.damage(o, dmg * 0.35, { crit: false, noSplash: true, noFrost: true, noCombo: true });
        }
        AE.FX.ring(e.x, e.y, '#ffd479', 4, 60, 0.25, 1.6);
      }
      if (AE.FX.dmgText) {
        AE.FX.text(e.x + U.rnd(-4, 4), e.y - e.r - 6, String(Math.round(dmg)),
          opts && opts.crit ? '#ffd479' : '#eaf2ff', opts && opts.crit ? 19 : 13.5, opts && opts.crit);
      }
      if (opts && opts.crit) AE.FX.spark(e.x, e.y, '#ffd479', 3, { spd: 120, life: 0.25, size: 2.2 });
      AE.Audio.sfx('hit');
      if (e.hp <= 0) this.kill(e, opts);
      return dmg;
    },

    kill: function (e, opts) {
      if (!e.alive) return;
      e.alive = false;
      const G = AE.G;
      opts = opts || {};
      if (e.boss) {
        this.bossDeath(e);
        return;
      }
      G.kills++;
      AE.Game.addCombo(1, 2.6);
      // 遗物：吸血符文 / 爆裂回响
      const pl = G.player;
      if (pl && pl.relics) {
        if (pl.relics.indexOf('leech') >= 0) {
          const before = pl.hp;
          pl.hp = Math.min(pl.maxHp, pl.hp + 1.5);
          pl.healed += pl.hp - before;
        }
        if (pl.relics.indexOf('boom') >= 0 && Math.random() < 0.18 && G.lastBoomFrame !== G.frame) {
          G.lastBoomFrame = G.frame;
          AE.FX.ring(e.x, e.y, '#ff9f68', 4, 72, 0.35, 2.4);
          AE.FX.spark(e.x, e.y, '#ff9f68', 8, { spd: 160, life: 0.35, size: 2.6 });
          const near = AE.World.grid.query(e.x, e.y, 72);
          const boomDmg = (30 + G.level * 2) * (pl.dmgMul || 1);
          for (let k = 0; k < near.length; k++) {
            const o = near[k];
            if (o === e || !o.alive || o.spawning > 0) continue;
            if (U.d2(e.x, e.y, o.x, o.y) > 72 * 72) continue;
            this.damage(o, boomDmg, { crit: false, noSplash: true, noFrost: true, noCombo: true });
          }
        }
      }
      // 噬星者：击杀永久叠伤（上限 +100%）
      if (pl && pl.killStack) {
        pl.killStacks = (pl.killStacks || 0) + 1;
        if (pl.stackBonus < 1) {
          const add = Math.min(0.005, 1 - pl.stackBonus);
          pl.stackBonus += add;
          pl.dmgMul += add;
        }
      }
      // 遗物：收割之环 —— 每 20 杀释放一次新星
      if (pl && pl.relics && pl.relics.indexOf('reaper') >= 0) {
        pl.reaperKills = (pl.reaperKills || 0) + 1;
        if (pl.reaperKills >= 20 && !pl.reaperBurst) {
          pl.reaperKills = 0;
          pl.reaperBurst = true;
          AE.FX.ring(pl.x, pl.y, '#b388ff', 12, 180, 0.5, 3);
          AE.FX.flash(0.05, '#b388ff');
          AE.FX.shake(0.1);
          AE.Audio.sfx('nova');
          const near = AE.World.grid.query(pl.x, pl.y, 180);
          const nd = (60 + G.level * 4) * (pl.dmgMul || 1);
          for (let k = 0; k < near.length; k++) {
            const o = near[k];
            if (!o.alive || o.spawning > 0) continue;
            if (U.d2(pl.x, pl.y, o.x, o.y) > 180 * 180) continue;
            this.damage(o, nd, { noSplash: true, noFrost: true, noCombo: true });
          }
          pl.reaperBurst = false;
        }
      }
      // 词缀首领击杀统计
      if (e.boss && e.affix) G.affixKills = (G.affixKills || 0) + 1;
      // 星核能量：击杀积攒爆发
      if (pl && pl.ult < pl.ultMax) {        const wasFull = pl.ult >= pl.ultMax;
        const gain = (e.boss ? 40 : (e.elite ? 10 : 1.2)) * (1 + (pl.ultGain || 0)) *
          (G.event && G.event.id === 'surge' ? 2 : 1);
        pl.ult = Math.min(pl.ultMax, pl.ult + gain);
        if (!wasFull && pl.ult >= pl.ultMax && AE.UI && AE.UI.syncDash) AE.UI.syncDash();
      }
      // 灼星者 / 引燃：燃烧的敌人死亡时引燃周围；只有灼烧 tick 击杀才计入燎原
      if (e.burnT > 0 && pl && (pl.burn || pl.igniteChance > 0)) {
        if (opts.burnKill) G.burnKills = (G.burnKills || 0) + 1;
        e.burnT = 0;
        const near = AE.World.grid.query(e.x, e.y, 140);
        for (let k = 0; k < near.length; k++) {
          const o = near[k];
          if (o === e || !o.alive || o.spawning > 0) continue;
          if (U.d2(e.x, e.y, o.x, o.y) > 140 * 140) continue;
          o.burnT = Math.max(o.burnT || 0, 2.4);
          o.burnDps = Math.max(o.burnDps || 0, (e.burnDps || 0) * 0.85);
        }
        AE.FX.ring(e.x, e.y, '#ff9f68', 8, 140, 0.4, 2.4);
      }
      const val = Math.max(1, Math.round(e.xp * (1 + (G.loop || 0) * 0.2)));
      AE.World.dropOrbs(e.x, e.y, val, e.elite);
      if (e.elite) {
        AE.FX.ring(e.x, e.y, '#ffd479', 6, 90, 0.5, 3);
        AE.FX.flash(0.06, '#ffd479');
        AE.FX.shake(0.15);
        AE.World.addPickup('heal', e.x, e.y);
      } else if (Math.random() < 0.028) {
        AE.World.addPickup('heal', e.x, e.y);
      }
      const n = e.elite ? 26 : 9;
      AE.FX.spark(e.x, e.y, e.color, n, { spd: e.elite ? 320 : 190, life: 0.5, size: 3, kind: 'shard' });
      AE.FX.ring(e.x, e.y, e.color, e.r * 0.4, e.r * 2.2, 0.3, 2);
      AE.Audio.sfx('kill', { pitch: 0.85 + Math.random() * 0.4 });
      if (e.def && e.def.explode && !opts.noExplode) {
        this.explode(e);
        return;
      }
      if (e.def && e.def.split && !opts.noSplit && AE.G.enemies.length < AE.Data.CONST.MAX_ENEMIES - 4) {
        for (let i = 0; i < e.def.split; i++) {
          const a = Math.random() * U.TAU;
          const c = this.spawn('crawler', e.x + Math.cos(a) * 18, e.y + Math.sin(a) * 18, { silent: true });
          if (c) { c.hp = c.maxHp * 0.55; c.scale = 0.8; }
        }
      }
      G.comboLimit = G.combo;
    },

    bossDeath: function (e) {
      const G = AE.G;
      G.kills++;
      G.bossKills++;
      G.stats.damage += 0;
      AE.FX.flash(0.5, e.color);
      AE.FX.shake(1.1);
      AE.FX.hitStop(0.12);
      AE.FX.ring(e.x, e.y, e.color, 10, 320, 1.1, 8);
      AE.FX.ring(e.x, e.y, '#ffffff', 6, 240, 0.8, 3);
      AE.FX.spark(e.x, e.y, e.color, 80, { spd: 620, life: 1.5, size: 5, kind: 'shard' });
      AE.FX.spark(e.x, e.y, '#ffffff', 40, { spd: 300, life: 1.0, size: 4 });
      AE.Audio.sfx('bossdie');
      AE.Audio.sfx('explosion');
      AE.World.dropOrbs(e.x, e.y, e.xp, false, true);
      AE.World.addPickup('heal', e.x, e.y, 2);
      AE.FX.text(e.x, e.y - e.r, '已击破', '#ffd479', 26);
      G.boss = null;
      if (AE.Game) AE.Game.onBossKilled(e);
    },

    /* ---------- 绘制 ---------- */
    draw: function (ctx, time) {
      const list = this.list;
      const v = AE.Cam.view();
      for (let i = 0; i < list.length; i++) {
        const e = list[i];
        if (!e.alive) continue;
        if (e.x < v.x0 - 90 || e.x > v.x1 + 90 || e.y < v.y0 - 90 || e.y > v.y1 + 90) continue;
        if (e.boss) this.drawBoss(ctx, e, time);
        else this.drawMob(ctx, e, time);
      }
    },

    drawMob: function (ctx, e, time) {
      let alpha = 1, sc = 1;
      if (e.spawning > 0) {
        const k = 1 - Math.max(0, e.spawning) / 0.42;
        sc = 0.3 + k * 0.7;
        alpha = 0.4 + k * 0.6;
      }
      const flash = e.flash > 0;
      const col = e.color;
      const ang = Math.atan2(AE.G.player.y - e.y, AE.G.player.x - e.x);
      ctx.save();
      ctx.globalAlpha = alpha;
      ctx.translate(e.x, e.y);

      // 地面阴影
      ctx.globalAlpha = alpha * 0.3;
      ctx.fillStyle = '#000000';
      ctx.beginPath();
      ctx.ellipse(0, e.r * 0.85, e.r * 1.05, e.r * 0.42, 0, 0, U.TAU);
      ctx.fill();
      ctx.globalAlpha = alpha;

      ctx.globalCompositeOperation = 'lighter';
      AE.FX.glow(ctx, 0, 0, e.r * 2.1, col, 0.34);
      if (e.burnT > 0) {
        AE.FX.glow(ctx, 0, -e.r * 0.1, e.r * (2.4 + Math.sin(time * 14) * 0.3), '#ff9f68', 0.5);
        ctx.globalAlpha = alpha * 0.8;
        ctx.fillStyle = '#ffcf8f';
        for (let bi = 0; bi < 3; bi++) {
          const fa = time * 5 + bi * 2.1;
          ctx.beginPath();
          ctx.arc(Math.cos(fa) * e.r * 0.5, -e.r * 0.5 - (time * 26 % (e.r * 1.4)) * 0.4,
            2.4 + Math.sin(fa) * 0.8, 0, U.TAU);
          ctx.fill();
        }
        ctx.globalAlpha = alpha;
      }
      ctx.globalCompositeOperation = 'source-over';

      // 冲角兽的冲锋预警线
      if (e.shape === 'charger' && e.mode === 'tele') {
        const ca = Math.atan2(e.chargeDir.y, e.chargeDir.x);
        ctx.save();
        ctx.rotate(ca);
        ctx.globalAlpha = 0.35 + Math.sin(time * 30) * 0.15;
        ctx.strokeStyle = '#ff9f68';
        ctx.lineWidth = 3;
        ctx.setLineDash([12, 10]);
        ctx.beginPath();
        ctx.moveTo(e.r * 0.8, 0);
        ctx.lineTo(300, 0);
        ctx.stroke();
        ctx.setLineDash([]);
        ctx.restore();
      }

      ctx.scale(sc, sc);
      ctx.rotate(e.rot + (e.elite ? time * 0.4 : 0));

      const s = e.shape;
      if (s === 'crawler') {
        ctx.fillStyle = flash ? 'rgba(255,236,246,0.72)' : '#2a1230';
        ctx.strokeStyle = col;
        ctx.lineWidth = 2;
        ctx.beginPath();
        for (let k = 0; k < 3; k++) {
          const a = k * U.TAU / 3 - Math.PI / 2;
          const x = Math.cos(a) * e.r, y = Math.sin(a) * e.r;
          if (k === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
        }
        ctx.closePath();
        ctx.fill(); ctx.stroke();
        ctx.fillStyle = e.color;
        ctx.beginPath(); ctx.arc(0, 0, e.r * 0.34, 0, U.TAU); ctx.fill();
        ctx.fillStyle = '#ffffff';
        ctx.beginPath(); ctx.arc(-e.r * 0.22, -e.r * 0.1, 1.6, 0, U.TAU); ctx.fill();
        ctx.beginPath(); ctx.arc(e.r * 0.22, -e.r * 0.1, 1.6, 0, U.TAU); ctx.fill();
      } else if (s === 'stalker') {
        ctx.fillStyle = flash ? 'rgba(255,236,246,0.72)' : '#0d2438';
        ctx.strokeStyle = col; ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(e.r * 1.35, 0);
        ctx.lineTo(0, -e.r * 0.72);
        ctx.lineTo(-e.r * 0.9, 0);
        ctx.lineTo(0, e.r * 0.72);
        ctx.closePath();
        ctx.fill(); ctx.stroke();
        ctx.fillStyle = col;
        ctx.beginPath(); ctx.arc(0, 0, e.r * 0.3, 0, U.TAU); ctx.fill();
        // 拖尾
        ctx.globalAlpha = alpha * 0.4;
        ctx.strokeStyle = col;
        ctx.beginPath();
        ctx.moveTo(-e.r * 1.2, 0);
        ctx.lineTo(-e.r * 2.4, 0);
        ctx.stroke();
      } else if (s === 'spitter') {
        ctx.fillStyle = flash ? 'rgba(255,236,246,0.72)' : '#0c2a22';
        ctx.strokeStyle = col; ctx.lineWidth = 2;
        ctx.beginPath();
        for (let k = 0; k < 6; k++) {
          const a = k * U.TAU / 6;
          const r1 = e.r, r2 = e.r * 0.72;
          ctx.lineTo(Math.cos(a) * r1, Math.sin(a) * r1);
          ctx.lineTo(Math.cos(a + 0.26) * r2, Math.sin(a + 0.26) * r2);
        }
        ctx.closePath(); ctx.fill(); ctx.stroke();
        ctx.fillStyle = col;
        ctx.beginPath(); ctx.arc(0, 0, e.r * 0.42, 0, U.TAU); ctx.fill();
        ctx.fillStyle = '#04120e';
        ctx.beginPath(); ctx.arc(0, 0, e.r * 0.2, 0, U.TAU); ctx.fill();
      } else if (s === 'bloater') {
        const pulse = 1 + Math.sin(time * 7 + e.phase) * 0.07 + (e.fuse > 0 ? 0.2 : 0);
        ctx.scale(pulse, pulse);
        ctx.fillStyle = flash ? 'rgba(255,236,246,0.72)' : (e.fuse > 0 ? '#4a2a08' : '#33220c');
        ctx.strokeStyle = e.fuse > 0 ? '#ffe9a8' : col;
        ctx.lineWidth = 2;
        ctx.beginPath(); ctx.arc(0, 0, e.r, 0, U.TAU); ctx.fill(); ctx.stroke();
        ctx.fillStyle = flash ? 'rgba(255,236,246,0.72)' : '#5c3a12';
        for (let k = 0; k < 4; k++) {
          const a = k * 1.7 + e.phase;
          ctx.beginPath();
          ctx.arc(Math.cos(a) * e.r * 0.45, Math.sin(a) * e.r * 0.45, e.r * 0.17, 0, U.TAU);
          ctx.fill();
        }
        ctx.fillStyle = col;
        ctx.beginPath(); ctx.arc(0, 0, e.r * 0.22, 0, U.TAU); ctx.fill();
      } else if (s === 'bulwark') {
        ctx.fillStyle = flash ? 'rgba(255,236,246,0.72)' : '#1b1030';
        ctx.strokeStyle = col; ctx.lineWidth = 2.4;
        ctx.beginPath();
        for (let k = 0; k < 6; k++) {
          const a = k * U.TAU / 6;
          const x = Math.cos(a) * e.r, y = Math.sin(a) * e.r;
          if (k === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
        }
        ctx.closePath(); ctx.fill(); ctx.stroke();
        ctx.strokeStyle = AE.FX.alpha(col, 0.55);
        ctx.lineWidth = 1.4;
        ctx.beginPath();
        for (let k = 0; k < 6; k++) {
          const a = k * U.TAU / 6 + U.TAU / 12;
          const x = Math.cos(a) * e.r * 0.58, y = Math.sin(a) * e.r * 0.58;
          if (k === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
        }
        ctx.closePath(); ctx.stroke();
        ctx.fillStyle = col;
        ctx.beginPath(); ctx.arc(0, 0, e.r * 0.2, 0, U.TAU); ctx.fill();
      } else if (s === 'splitter') {
        ctx.fillStyle = flash ? 'rgba(255,236,246,0.72)' : '#33200e';
        ctx.strokeStyle = col; ctx.lineWidth = 2;
        ctx.beginPath(); ctx.arc(-e.r * 0.42, 0, e.r * 0.66, 0, U.TAU); ctx.fill(); ctx.stroke();
        ctx.beginPath(); ctx.arc(e.r * 0.42, 0, e.r * 0.66, 0, U.TAU); ctx.fill(); ctx.stroke();
        ctx.fillStyle = col;
        ctx.beginPath(); ctx.arc(-e.r * 0.35, 0, e.r * 0.18, 0, U.TAU); ctx.fill();
        ctx.beginPath(); ctx.arc(e.r * 0.35, 0, e.r * 0.18, 0, U.TAU); ctx.fill();
      } else if (s === 'wisp') {
        ctx.globalCompositeOperation = 'lighter';
        ctx.strokeStyle = col; ctx.lineWidth = 2.4;
        ctx.beginPath(); ctx.arc(0, 0, e.r, 0, U.TAU); ctx.stroke();
        ctx.globalAlpha = alpha * 0.5;
        ctx.beginPath(); ctx.arc(0, 0, e.r * 0.6, 0, U.TAU); ctx.stroke();
        ctx.globalAlpha = alpha;
        ctx.fillStyle = '#ffffff';
        ctx.beginPath(); ctx.arc(0, 0, e.r * 0.34, 0, U.TAU); ctx.fill();
      } else if (s === 'mender') {
        ctx.globalCompositeOperation = 'lighter';
        ctx.strokeStyle = col; ctx.lineWidth = 2;
        ctx.beginPath(); ctx.arc(0, 0, e.r, 0, U.TAU); ctx.stroke();
        ctx.fillStyle = AE.FX.alpha(col, 0.16);
        ctx.beginPath(); ctx.arc(0, 0, e.r * 0.72, 0, U.TAU); ctx.fill();
        ctx.strokeStyle = '#d8ffe9'; ctx.lineWidth = 2.6;
        ctx.beginPath();
        ctx.moveTo(-e.r * 0.45, 0); ctx.lineTo(e.r * 0.45, 0);
        ctx.moveTo(0, -e.r * 0.45); ctx.lineTo(0, e.r * 0.45);
        ctx.stroke();
        for (let k = 0; k < 4; k++) {
          const a = time * 1.2 + k * U.TAU / 4;
          ctx.fillStyle = col;
          ctx.beginPath();
          ctx.arc(Math.cos(a) * e.r * 1.18, Math.sin(a) * e.r * 1.18, 2.2, 0, U.TAU);
          ctx.fill();
        }
        ctx.globalCompositeOperation = 'source-over';
      } else if (s === 'priest') {
        // 虚空祭司：兜帽长袍 + 悬浮符文
        ctx.fillStyle = flash ? 'rgba(255,240,255,0.72)' : '#22102e';
        ctx.strokeStyle = col; ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(0, -e.r * 1.05);
        ctx.lineTo(e.r * 0.92, e.r * 0.82);
        ctx.quadraticCurveTo(0, e.r * 1.1, -e.r * 0.92, e.r * 0.82);
        ctx.closePath(); ctx.fill(); ctx.stroke();
        ctx.fillStyle = '#150a1e';
        ctx.beginPath(); ctx.arc(0, -e.r * 0.42, e.r * 0.52, 0, U.TAU); ctx.fill();
        ctx.strokeStyle = AE.FX.alpha(col, 0.8); ctx.lineWidth = 1.4;
        ctx.beginPath(); ctx.arc(0, -e.r * 0.42, e.r * 0.52, 0, U.TAU); ctx.stroke();
        ctx.fillStyle = '#ffe6ff';
        ctx.beginPath(); ctx.arc(-e.r * 0.18, -e.r * 0.45, 1.9, 0, U.TAU); ctx.fill();
        ctx.beginPath(); ctx.arc(e.r * 0.18, -e.r * 0.45, 1.9, 0, U.TAU); ctx.fill();
        ctx.strokeStyle = AE.FX.alpha(col, 0.55);
        ctx.lineWidth = 1.4;
        ctx.setLineDash([4, 6]);
        ctx.beginPath(); ctx.arc(0, 0, e.r * 1.3, -time * 0.9, -time * 0.9 + U.TAU); ctx.stroke();
        ctx.setLineDash([]);
        ctx.globalCompositeOperation = 'lighter';
        for (let k = 0; k < 3; k++) {
          const oa = time * 1.4 + k * U.TAU / 3;
          const ox = Math.cos(oa) * e.r * 1.35, oy = Math.sin(oa) * e.r * 0.8 - e.r * 0.2;
          AE.FX.glow(ctx, ox, oy, e.r * 0.42, col, 0.5);
        }
        ctx.globalCompositeOperation = 'source-over';
      } else if (s === 'charger') {
        const ang = Math.atan2(AE.G.player.y - e.y, AE.G.player.x - e.x);        ctx.rotate(ang - e.rot);
        ctx.fillStyle = flash ? 'rgba(255,236,246,0.72)' : '#3a1a0a';
        ctx.strokeStyle = col; ctx.lineWidth = 2.2;
        ctx.beginPath();
        ctx.moveTo(e.r * 1.5, 0);
        ctx.lineTo(e.r * 0.2, -e.r * 0.9);
        ctx.lineTo(-e.r * 0.95, -e.r * 0.6);
        ctx.lineTo(-e.r * 0.6, 0);
        ctx.lineTo(-e.r * 0.95, e.r * 0.6);
        ctx.lineTo(e.r * 0.2, e.r * 0.9);
        ctx.closePath(); ctx.fill(); ctx.stroke();
        ctx.fillStyle = '#ffd0a8';
        ctx.beginPath();
        ctx.moveTo(e.r * 1.5, 0);
        ctx.lineTo(e.r * 0.72, -e.r * 0.3);
        ctx.lineTo(e.r * 0.72, e.r * 0.3);
        ctx.closePath(); ctx.fill();
      }

      // 精英标记
      if (e.elite) {
        ctx.globalCompositeOperation = 'lighter';
        ctx.strokeStyle = 'rgba(255,212,121,0.7)';
        ctx.lineWidth = 1.6;
        ctx.beginPath();
        ctx.arc(0, 0, e.r * 1.35, time * 1.2, time * 1.2 + 4.6);
        ctx.stroke();
        ctx.globalCompositeOperation = 'source-over';
      }
      ctx.restore();

      // 血条（精英 / 受伤精英）
      if (e.elite && e.hp < e.maxHp) {
        const w = e.r * 2.4;
        ctx.fillStyle = 'rgba(0,0,0,0.55)';
        ctx.fillRect(e.x - w / 2, e.y - e.r - 14, w, 4);
        ctx.fillStyle = '#ffd479';
        ctx.fillRect(e.x - w / 2, e.y - e.r - 14, w * Math.max(0, e.hp / e.maxHp), 4);
      }
    },

    drawBoss: function (ctx, e, time) {
      // 传送门 / 前摇
      if (e.spawning > 0) {
        const k = 1 - e.spawning / 1.5;
        ctx.save();
        ctx.globalCompositeOperation = 'lighter';
        ctx.globalAlpha = 0.5 + Math.sin(time * 18) * 0.2;
        ctx.strokeStyle = e.color;
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.arc(e.x, e.y, 30 + k * 70, 0, U.TAU);
        ctx.stroke();
        ctx.restore();
      }
      const flash = e.flash > 0;
      const col = e.color;
      ctx.save();
      ctx.translate(e.x, e.y);

      // 阴影 & 光环
      ctx.globalAlpha = 0.35;
      ctx.fillStyle = '#000';
      ctx.beginPath(); ctx.ellipse(0, e.r * 0.9, e.r * 1.2, e.r * 0.45, 0, 0, U.TAU); ctx.fill();
      ctx.globalAlpha = 1;
      ctx.globalCompositeOperation = 'lighter';
      AE.FX.glow(ctx, 0, 0, e.r * 2.9, col, 0.32 + Math.sin(time * 2) * 0.04);
      if (e.enraged) {
        AE.FX.glow(ctx, 0, 0, e.r * 3.4, '#ff3355', 0.24 + Math.sin(time * 7) * 0.08);
      }
      ctx.globalCompositeOperation = 'source-over';
      if (e.enraged) {
        ctx.strokeStyle = 'rgba(255,70,90,' + (0.28 + Math.sin(time * 6) * 0.12).toFixed(2) + ')';
        ctx.lineWidth = 2.4;
        ctx.setLineDash([10, 12]);
        ctx.beginPath();
        ctx.arc(0, 0, e.r + 18, time * 1.5, time * 1.5 + U.TAU);
        ctx.stroke();
        ctx.setLineDash([]);
      }

      // 外环符文：双层反向旋转，强化首领的存在感
      ctx.save();
      ctx.rotate(time * 0.22);
      ctx.strokeStyle = AE.FX.alpha(col, 0.26);
      ctx.lineWidth = 2;
      ctx.setLineDash([13, 17]);
      ctx.beginPath(); ctx.arc(0, 0, e.r + 34, 0, U.TAU); ctx.stroke();
      ctx.setLineDash([]);
      ctx.rotate(-time * 0.55);
      ctx.strokeStyle = 'rgba(255,212,121,0.16)';
      ctx.lineWidth = 1.4;
      ctx.beginPath(); ctx.arc(0, 0, e.r + 54, 0.3, 2.2); ctx.stroke();
      ctx.beginPath(); ctx.arc(0, 0, e.r + 54, Math.PI + 0.3, Math.PI + 2.2); ctx.stroke();
      ctx.restore();

      // 前摇提示
      if (e.ai === 'breaker' && e.mode === 'tele') {
        const a = Math.atan2(e.chargeDir.y, e.chargeDir.x);
        ctx.save();
        ctx.rotate(a);
        ctx.globalAlpha = 0.35 + Math.sin(time * 30) * 0.15;
        ctx.strokeStyle = '#ff9f68';
        ctx.lineWidth = 4;
        ctx.setLineDash([18, 14]);
        ctx.beginPath(); ctx.moveTo(e.r, 0); ctx.lineTo(900, 0); ctx.stroke();
        ctx.setLineDash([]);
        ctx.restore();
      }
      if (e.ai === 'manyeye' && (e.mode === 'beamTele' || e.mode === 'beam')) {
        const tele = e.mode === 'beamTele';
        for (let i = 0; i < 2; i++) {
          const a = e.beamBase + (i === 0 ? -0.24 : 0.24);
          ctx.save();
          ctx.rotate(a);
          const g2 = ctx.createLinearGradient(0, 0, 1100, 0);
          g2.addColorStop(0, AE.FX.alpha(col, tele ? 0.35 : 0.85));
          g2.addColorStop(1, AE.FX.alpha(col, 0));
          ctx.strokeStyle = g2;
          ctx.lineWidth = tele ? 3 : 16;
          if (tele) ctx.setLineDash([16, 12]);
          ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(1100, 0); ctx.stroke();
          ctx.setLineDash([]);
          if (!tele) {
            ctx.lineWidth = 4;
            ctx.strokeStyle = 'rgba(255,255,255,0.85)';
            ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(1100, 0); ctx.stroke();
          }
          ctx.restore();
        }
      }

      if (e.ai === 'eclipse' && (e.mode === 'beamTele' || e.mode === 'beam')) {
        const tele = e.mode === 'beamTele';
        for (let i = 0; i < 3; i++) {
          const a = e.beamBase + (i - 1) * 0.36;
          ctx.save();
          ctx.rotate(a);
          const g3 = ctx.createLinearGradient(0, 0, 1100, 0);
          g3.addColorStop(0, AE.FX.alpha(col, tele ? 0.4 : 0.9));
          g3.addColorStop(1, AE.FX.alpha(col, 0));
          ctx.strokeStyle = g3;
          ctx.lineWidth = tele ? 3 : 14;
          if (tele) ctx.setLineDash([14, 10]);
          ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(1100, 0); ctx.stroke();
          ctx.setLineDash([]);
          if (!tele) {
            ctx.lineWidth = 4;
            ctx.strokeStyle = 'rgba(255,255,255,0.85)';
            ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(1100, 0); ctx.stroke();
          }
          ctx.restore();
        }
      }

      if (e.ai === 'abyss' && (e.mode === 'beamTele' || e.mode === 'beam')) {
        const tele = e.mode === 'beamTele';
        for (let i = 0; i < 3; i++) {
          const a = e.beamBase + (i - 1) * 0.17;
          ctx.save();
          ctx.rotate(a);
          const ga = ctx.createLinearGradient(0, 0, 1100, 0);
          ga.addColorStop(0, AE.FX.alpha(col, tele ? 0.32 : 0.85));
          ga.addColorStop(1, AE.FX.alpha(col, 0));
          ctx.strokeStyle = ga;
          ctx.lineWidth = tele ? 2.5 : 10;
          if (tele) ctx.setLineDash([10, 12]);
          ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(1100, 0); ctx.stroke();
          ctx.setLineDash([]);
          if (!tele) {
            ctx.lineWidth = 3;
            ctx.strokeStyle = 'rgba(255,230,240,0.9)';
            ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(1100, 0); ctx.stroke();
          }
          ctx.restore();
        }
      }
      if (e.ai === 'abyss' && (e.sweepTele > 0 || e.sweepActive > 0)) {
        const tele = e.sweepTele > 0;
        const lanes = [-0.5, 0, 0.5];
        for (let i = 0; i < lanes.length; i++) {
          ctx.save();
          ctx.rotate(e.sweepAng + lanes[i]);
          const gs = ctx.createLinearGradient(0, 0, 520, 0);
          gs.addColorStop(0, AE.FX.alpha(col, tele ? 0.55 : 0.9));
          gs.addColorStop(0.7, AE.FX.alpha('#ff5c9a', tele ? 0.38 : 0.65));
          gs.addColorStop(1, AE.FX.alpha(col, 0));
          ctx.strokeStyle = gs;
          ctx.lineWidth = tele ? 4 : 20;
          if (tele) ctx.setLineDash([18, 12]);
          ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(520, 0); ctx.stroke();
          ctx.setLineDash([]);
          if (tele) {
            ctx.strokeStyle = AE.FX.alpha(col, 0.85);
            ctx.lineWidth = 2.5;
            ctx.beginPath(); ctx.arc(520, 0, 15, 0, U.TAU); ctx.stroke();
          } else {
            ctx.strokeStyle = 'rgba(255,225,240,0.75)';
            ctx.lineWidth = 3;
            ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(500, 0); ctx.stroke();
          }
          ctx.restore();
        }
      }

      ctx.rotate(e.rot);
      const R = e.r;
      if (e.ai === 'weaver') {
        ctx.strokeStyle = col; ctx.lineWidth = 2;
        for (let i = 0; i < 8; i++) {
          const a = i * U.TAU / 8 + time * 0.3;
          ctx.beginPath(); ctx.moveTo(0, 0);
          ctx.lineTo(Math.cos(a) * R * 1.5, Math.sin(a) * R * 1.5); ctx.stroke();
        }
        ctx.fillStyle = '#1c0f30';
        ctx.beginPath(); ctx.arc(0, 0, R, 0, U.TAU); ctx.fill(); ctx.stroke();
        ctx.strokeStyle = AE.FX.alpha(col, 0.5);
        ctx.beginPath(); ctx.arc(0, 0, R * 0.7, time, time + 4); ctx.stroke();
        ctx.fillStyle = col;
        ctx.beginPath(); ctx.arc(0, 0, R * 0.3, 0, U.TAU); ctx.fill();
        ctx.fillStyle = '#fff';
        ctx.beginPath(); ctx.arc(0, 0, R * 0.12, 0, U.TAU); ctx.fill();
      } else if (e.ai === 'breaker') {
        ctx.fillStyle = '#2a1408';
        ctx.strokeStyle = col; ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.moveTo(R * 1.35, 0);
        ctx.lineTo(R * 0.2, -R * 0.95);
        ctx.lineTo(-R * 0.9, -R * 0.5);
        ctx.lineTo(-R * 0.7, 0);
        ctx.lineTo(-R * 0.9, R * 0.5);
        ctx.lineTo(R * 0.2, R * 0.95);
        ctx.closePath(); ctx.fill(); ctx.stroke();
        ctx.fillStyle = col;
        ctx.beginPath(); ctx.arc(R * 0.25, 0, R * 0.26, 0, U.TAU); ctx.fill();
        ctx.fillStyle = '#fff';
        ctx.beginPath(); ctx.arc(R * 0.3, 0, R * 0.1, 0, U.TAU); ctx.fill();
      } else if (e.ai === 'manyeye') {
        ctx.fillStyle = '#0a211c';
        ctx.strokeStyle = col; ctx.lineWidth = 2.5;
        ctx.beginPath();
        for (let i = 0; i < 12; i++) {
          const a = i * U.TAU / 12;
          const rr = R * (i % 2 ? 0.86 : 1.12);
          ctx.lineTo(Math.cos(a) * rr, Math.sin(a) * rr);
        }
        ctx.closePath(); ctx.fill(); ctx.stroke();
        // 环上小眼
        for (let i = 0; i < 8; i++) {
          const a = i * U.TAU / 8 + time * 0.4;
          ctx.fillStyle = AE.FX.alpha(col, 0.9);
          ctx.beginPath();
          ctx.arc(Math.cos(a) * R * 0.7, Math.sin(a) * R * 0.7, 3.4, 0, U.TAU);
          ctx.fill();
        }
        // 主眼
        ctx.fillStyle = '#dffcf1';
        ctx.beginPath(); ctx.ellipse(0, 0, R * 0.5, R * 0.32, 0, 0, U.TAU); ctx.fill();
        ctx.fillStyle = '#06231c';
        ctx.beginPath(); ctx.arc(Math.cos(e.t * 0.8) * R * 0.12, Math.sin(e.t * 0.8) * R * 0.08, R * 0.17, 0, U.TAU); ctx.fill();
        ctx.fillStyle = '#fff';
        ctx.beginPath(); ctx.arc(Math.cos(e.t * 0.8) * R * 0.12 - 2, Math.sin(e.t * 0.8) * R * 0.08 - 3, R * 0.06, 0, U.TAU); ctx.fill();
      } else if (e.ai === 'abyss') {
        // 深渊之眼：卷须 + 开合眼睑 + 竖瞳 + 环绕碎片
        const open = e.mode === 'tele' ? Math.max(0.08, e.modeT / 1.1)
          : (e.mode === 'beam' ? 0.2 : 0.82 + Math.sin(time * 1.6) * 0.06);
        ctx.strokeStyle = AE.FX.alpha(col, 0.42);
        ctx.lineWidth = 4;
        for (let i = 0; i < 8; i++) {
          const a = i * U.TAU / 8 + time * 0.18;
          const wob = Math.sin(time * 2.2 + i) * 26;
          ctx.beginPath();
          ctx.moveTo(Math.cos(a) * R * 0.86, Math.sin(a) * R * 0.86);
          ctx.quadraticCurveTo(
            Math.cos(a) * R * 1.36 + Math.cos(a + 1.5) * wob,
            Math.sin(a) * R * 1.36 + Math.sin(a + 1.5) * wob,
            Math.cos(a) * R * 1.92, Math.sin(a) * R * 1.92);
          ctx.stroke();
        }
        ctx.fillStyle = '#140410';
        ctx.strokeStyle = col; ctx.lineWidth = 3;
        ctx.beginPath(); ctx.ellipse(0, 0, R * 1.04, R * 0.94, 0, 0, U.TAU); ctx.fill(); ctx.stroke();
        ctx.fillStyle = '#efe6ff';
        ctx.beginPath(); ctx.ellipse(0, 0, R * 0.8, R * 0.64 * open, 0, 0, U.TAU); ctx.fill();
        const gi = ctx.createRadialGradient(0, 0, R * 0.06, 0, 0, R * 0.56);
        gi.addColorStop(0, '#ffd9e6');
        gi.addColorStop(0.4, col);
        gi.addColorStop(1, '#3a0a1e');
        ctx.fillStyle = gi;
        ctx.beginPath(); ctx.ellipse(0, 0, R * 0.54, R * 0.44 * open, 0, 0, U.TAU); ctx.fill();
        ctx.fillStyle = '#08020a';
        ctx.beginPath(); ctx.ellipse(0, 0, R * 0.085, R * 0.46 * open, 0, 0, U.TAU); ctx.fill();
        ctx.fillStyle = 'rgba(255,255,255,0.9)';
        ctx.beginPath(); ctx.arc(-R * 0.2, -R * 0.16, R * 0.055, 0, U.TAU); ctx.fill();
        for (let i = 0; i < 10; i++) {
          const a = i * U.TAU / 10 + time * 0.35;
          ctx.fillStyle = AE.FX.alpha(col, 0.85);
          ctx.beginPath(); ctx.arc(Math.cos(a) * R * 0.84, Math.sin(a) * R * 0.74, 3.2, 0, U.TAU); ctx.fill();
          ctx.fillStyle = '#10030c';
          ctx.beginPath(); ctx.arc(Math.cos(a) * R * 0.84, Math.sin(a) * R * 0.74, 1.3, 0, U.TAU); ctx.fill();
        }
        for (let i = 0; i < 3; i++) {
          const oa = e.t * 1.15 + i * U.TAU / 3;
          const ox = Math.cos(oa) * 136, oy = Math.sin(oa) * 136;
          ctx.globalCompositeOperation = 'lighter';
          AE.FX.glow(ctx, ox, oy, 34, col, 0.5);
          ctx.globalCompositeOperation = 'source-over';
          ctx.save();
          ctx.translate(ox, oy); ctx.rotate(oa * 2);
          ctx.fillStyle = '#1b0614'; ctx.strokeStyle = col; ctx.lineWidth = 2;
          ctx.beginPath();
          ctx.moveTo(0, -16); ctx.lineTo(11, 0); ctx.lineTo(0, 16); ctx.lineTo(-11, 0);
          ctx.closePath(); ctx.fill(); ctx.stroke();
          ctx.restore();
        }
      } else if (e.ai === 'final') {
        // final
        const stage = e.stage || 1;
        ctx.fillStyle = '#2a0a16';
        ctx.strokeStyle = col; ctx.lineWidth = 3;
        ctx.beginPath();
        const spikes = 8 + stage * 2;
        for (let i = 0; i < spikes * 2; i++) {
          const a = i * Math.PI / spikes;
          const rr = i % 2 ? R * 0.72 : R * (1.18 + Math.sin(time * 3 + i) * 0.05);
          const x = Math.cos(a) * rr, y = Math.sin(a) * rr;
          if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
        }
        ctx.closePath(); ctx.fill(); ctx.stroke();
        ctx.strokeStyle = AE.FX.alpha(col, 0.55);
        ctx.lineWidth = 1.5;
        for (let i = 0; i < 3; i++) {
          ctx.beginPath();
          ctx.arc(0, 0, R * (0.4 + i * 0.24), time * (1 + i * 0.4), time * (1 + i * 0.4) + 3.6);
          ctx.stroke();
        }
        ctx.fillStyle = col;
        ctx.beginPath(); ctx.arc(0, 0, R * 0.3, 0, U.TAU); ctx.fill();
        ctx.fillStyle = '#fff';
        ctx.beginPath(); ctx.arc(0, 0, R * 0.13 + Math.sin(time * 5) * 2, 0, U.TAU); ctx.fill();
      } else {
        // eclipse：黑星 + 日冕 + 三颗环绕黑星
        ctx.strokeStyle = AE.FX.alpha(col, 0.55);
        ctx.lineWidth = 2;
        for (let i = 0; i < 16; i++) {
          const a = i * U.TAU / 16 + time * 0.35;
          const r1 = R * 1.02, r2 = R * (1.3 + Math.sin(time * 2 + i) * 0.08);
          ctx.beginPath();
          ctx.moveTo(Math.cos(a) * r1, Math.sin(a) * r1);
          ctx.lineTo(Math.cos(a) * r2, Math.sin(a) * r2);
          ctx.stroke();
        }
        ctx.fillStyle = '#0b0718';
        ctx.strokeStyle = col; ctx.lineWidth = 3;
        ctx.beginPath(); ctx.arc(0, 0, R * 0.95, 0, U.TAU); ctx.fill(); ctx.stroke();
        ctx.strokeStyle = 'rgba(255,255,255,0.85)';
        ctx.lineWidth = 4;
        ctx.beginPath(); ctx.arc(0, 0, R * 0.72, time * 1.4, time * 1.4 + 4.2); ctx.stroke();
        ctx.fillStyle = col;
        ctx.beginPath(); ctx.arc(0, 0, R * 0.26, 0, U.TAU); ctx.fill();
        ctx.fillStyle = '#fff';
        ctx.beginPath(); ctx.arc(0, 0, R * 0.1, 0, U.TAU); ctx.fill();
        for (let i = 0; i < e.orbits.length; i++) {
          const oa = e.orbits[i] - e.rot;
          const ox = Math.cos(oa) * e.orbitR, oy = Math.sin(oa) * e.orbitR;
          ctx.globalCompositeOperation = 'lighter';
          AE.FX.glow(ctx, ox, oy, 30, col, 0.55);
          ctx.globalCompositeOperation = 'source-over';
          ctx.fillStyle = '#07050f';
          ctx.strokeStyle = col; ctx.lineWidth = 2;
          ctx.beginPath(); ctx.arc(ox, oy, 16, 0, U.TAU); ctx.fill(); ctx.stroke();
          ctx.fillStyle = '#ffffff';
          ctx.beginPath(); ctx.arc(ox, oy, 3.2, 0, U.TAU); ctx.fill();
        }
      }
      ctx.restore();
    },

    /* ---------- 查询 ---------- */
    nearestTo: function (x, y, range) {
      let best = null, bd = range * range;
      for (let i = 0; i < this.list.length; i++) {
        const e = this.list[i];
        if (!e.alive) continue;
        const dd = U.d2(x, y, e.x, e.y);
        if (dd < bd) { bd = dd; best = e; }
      }
      return best;
    }
  };

  AE.Enemies = En;
})(typeof window !== 'undefined' ? window : globalThis);
