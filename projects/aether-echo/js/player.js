/* ============================================================
 * player.js — 玩家：移动 / 冲刺 / 受伤 / 属性 / 绘制
 * ============================================================ */
(function (g) {
  'use strict';
  const AE = (g.AE = g.AE || {});
  const U = AE.U, C = null;

  const Player = {
    create: function (charId) {
      const D = AE.Data, S = AE.Save.data;
      const char = D.CHAR_MAP[charId] || D.CHARS[0];
      const meta = S.meta || {};
      const lv = function (id) { return meta[id] || 0; };
      const p = {
        char: char,
        x: D.CONST.WORLD_W / 2, y: D.CONST.WORLD_H / 2,
        vx: 0, vy: 0, r: D.CONST.PLAYER_R,
        maxHp: Math.round(char.hp * (1 + lv('vigor') * 0.08)),
        speed: char.speed * (1 + lv('swift') * 0.03),
        dmgMul: char.dmgMul * (1 + lv('might') * 0.06),
        atkSpd: 1 * (1 + lv('haste') * 0.04),
        spdMul: 0, pickupMul: 1, areaMul: 1,
        xpMul: char.xpMul * (1 + lv('fortune') * 0.05),
        echoMul: 1 + lv('fortune') * 0.05,
        crit: D.CONST.BASE_CRIT + (char.crit || 0),
        critDmg: D.CONST.BASE_CRITDMG,
        armor: char.armor || 0,
        regen: 0,
        dashCdMul: (char.dashCdMul || 1) * (1 - lv('tempo') * 0.04),
        dashDamage: !!char.dashDamage,
        killStack: !!char.killStack,
        burn: !!char.burn,
        timeWarp: !!char.timeWarp,
        warpT: 0,
        refractChance: char.refractChance || 0,
        refractMul: 1, refractBoostT: 0, refractCd: 0,
        ultGain: 0, igniteChance: 0, burnMul: 1 + (meta.ignis || 0) * 0.15,
        tetherT: 0,
        shardId: null, shardT: 0, shardMod: null,
        beamWidth: 1, beamGuard: false, channeling: false,
        orbitBonus: 0, beamLeech: false,
        killStacks: 0, stackBonus: 0,
        revives: lv('revive'),
        level: 1, xp: 0, xpNeed: D.xpNeed(1),
        weapons: [], passives: {}, passiveCount: 0,
        relics: [],
        aimX: 0, aimY: 0, aimAngle: -Math.PI / 2,
        dashT: 0, dashCd: 0, dashDir: { x: 1, y: 0 },
        ult: Math.min(100, (meta.core || 0) * 20), ultMax: 100, ultPulse: 0,
        avatarT: 0, avatarAtk: 0, avatarAura: 0,
        invuln: 0, flash: 0, hurtT: 0,
        moving: false, alive: true, t: 0,
        levelHpBonus: 0, damageDealt: 0, healed: 0,
        trailT: 0, after: []
      };
      p.hp = p.maxHp;
      p.aimX = p.x + 100; p.aimY = p.y;
      Player.addWeapon(p, char.start, 1, true);
      return p;
    },

    resetAt: function (p) {
      const D = AE.Data;
      p.x = D.CONST.WORLD_W / 2;
      p.y = D.CONST.WORLD_H / 2;
      p.hp = p.maxHp;
      p.invuln = 1.2;
      p.alive = true;
      p.dashT = 0; p.dashCd = 0;
      p.shardId = null; p.shardT = 0; p.shardMod = null;
      p.refractBoostT = 0; p.refractCd = 0;
      p.after.length = 0;
    },

    addWeapon: function (p, id, level, silent) {
      const def = AE.Data.WEAPON_MAP[id];
      if (!def) return null;
      for (let i = 0; i < p.weapons.length; i++) {
        if (p.weapons[i].id === id) {
          const w = p.weapons[i];
          w.level = Math.min(8, level || (w.level + 1));
          if (w.level >= 8 && !w.evolved) {
            w.evolved = true;
            if (!silent) Player.onEvolve(p, w);
            else Player.recordEvolved(w.id);
          }
          return w;
        }
      }
      const w = { id: id, level: Math.min(8, level || 1), evolved: false, t: 0.25, spin: Math.random() * 6 };
      p.weapons.push(w);
      return w;
    },

    recordEvolved: function (id) {
      const S = AE.Save && AE.Save.data;
      if (!S) return false;
      if (!Array.isArray(S.evolvedSeen)) S.evolvedSeen = [];
      if (S.evolvedSeen.indexOf(id) < 0) {
        S.evolvedSeen.push(id);
        AE.Save.save();
        return true;
      }
      return false;
    },

    onEvolve: function (p, w) {
      const def = AE.Data.WEAPON_MAP[w.id];
      if (AE.G) AE.G.runEvolves = (AE.G.runEvolves || 0) + 1;
      const isNew = Player.recordEvolved(w.id);
      AE.FX.ring(p.x, p.y, def.evolved ? def.color : def.color, 10, 240, 0.7, 5);
      AE.FX.spark(p.x, p.y, def.color, 34, { spd: 340, life: 0.8, size: 3.4 });
      AE.FX.flash(0.22, def.color);
      AE.FX.shake(0.5);
      AE.Audio.sfx('evolve');
      if (AE.Game) AE.Game.announce('武器进化 · ' + (def.evolved ? def.evolved.name : def.name), def.color, 2.6);
      if (AE.Save && AE.Save.data && AE.Save.data.stats) {
        AE.Save.data.stats.evolves = (AE.Save.data.stats.evolves || 0) + 1;
        AE.Save.save();
      }
      if (AE.Game && AE.Game.checkAchievements) AE.Game.checkAchievements();
      if (isNew && AE.UI && AE.UI.toast) {
        AE.UI.toast('图鉴 +1 · ' + (def.evolved ? def.evolved.name : def.name), '#ffd479');
      }
    },

    addPassive: function (p, id) {
      const def = AE.Data.PASSIVE_MAP[id];
      if (!def) return 0;
      const cur = p.passives[id] || 0;
      const next = Math.min(5, cur + 1);
      p.passives[id] = next;
      if (cur === 0) p.passiveCount++;
      def.apply(p, next);
      return next;
    },

    pickupRadius: function (p) { return AE.Data.CONST.PICKUP * p.pickupMul; },

    moveSpeed: function (p) {
      return p.speed * (1 + p.spdMul) * (p.avatarT > 0 ? 1.25 : 1) *
        (p.shardT > 0 && p.shardId === 'swift' ? 1.25 : 1) *
        ((p.tetherT || 0) > 0 ? 0.72 : 1);
    },

    attackSpeedMul: function (p) {
      let m = (p && (p.warpT || 0) > 0) ? 1.3 : 1;
      if (p && p.shardT > 0 && p.shardId === 'swift') m *= 1.15;
      return m;
    },

    /* 精英词缀碎片：8 秒临时强化，重复拾取刷新并切换 */
    applyShard: function (p, mod) {
      if (!p || !p.alive || !mod) return false;
      p.shardId = mod.id;
      p.shardMod = mod;
      p.shardT = mod.dur || 8;
      AE.FX.ring(p.x, p.y, mod.color, 5, 76, 0.45, 3);
      AE.FX.spark(p.x, p.y, mod.color, 16, { spd: 240, life: 0.5, size: 2.8, add: true });
      AE.FX.flash(0.05, mod.color);
      AE.Audio.sfx('pickup', { pitch: 1.25 });
      if (AE.Game) AE.Game.announce((mod.shard || '词缀碎片') + ' · ' + (mod.shardDesc || mod.name), mod.color, 1.6);
      return true;
    },

    shardArmor: function (p) {
      return (p && p.shardT > 0 && p.shardId === 'warden') ? 10 : 0;
    },

    update: function (p, dt) {
      if (!p.alive) return;
      p.tetherT = Math.max(0, (p.tetherT || 0) - dt);
      p.warpT = Math.max(0, (p.warpT || 0) - dt);
      p.refractBoostT = Math.max(0, (p.refractBoostT || 0) - dt);
      p.refractCd = Math.max(0, (p.refractCd || 0) - dt);
      if (p.shardT > 0) {
        p.shardT = Math.max(0, p.shardT - dt);
        if (p.shardT === 0) { p.shardId = null; p.shardMod = null; }
      }
      const Input = AE.Input;
      p.t += dt;
      p.invuln = Math.max(0, p.invuln - dt);
      p.flash = Math.max(0, p.flash - dt);
      p.hurtT = Math.max(0, p.hurtT - dt);
      p.dashCd = Math.max(0, p.dashCd - dt);

      if (p.regen > 0 && p.hp < p.maxHp) {
        const h = Math.min(p.maxHp - p.hp, p.regen * dt);
        p.hp += h; p.healed += h;
      }
      // 遗物：血月 —— 低血量时额外回复
      if (p.relics.indexOf('bloodmoon') >= 0 && p.hp < p.maxHp * 0.5) {
        const hm = Math.min(p.maxHp - p.hp, 3 * dt);
        p.hp += hm; p.healed += hm;
      }
      // 遗物：雷霆核心 —— 定时电击最近敌人
      if (p.relics.indexOf('static') >= 0) {
        p.staticT = (p.staticT || 0) - dt;
        if (p.staticT <= 0) {
          const ts = AE.Weapons.nearestEnemies(p.x, p.y, 3, 420);
          if (ts.length) {
            p.staticT = 4.2;
            for (let i = 0; i < ts.length; i++) {
              const t = ts[i];
              AE.FX.line(p.x, p.y, t.x, t.y, '#9fe8ff', 0.18, 4, false);
              AE.FX.spark(t.x, t.y, '#9fe8ff', 5, { spd: 140, life: 0.3, size: 2.2 });
              AE.Enemies.damage(t, (40 + p.level * 6) * p.dmgMul, { noSplash: true });
            }
            AE.Audio.sfx('arc');
          } else {
            p.staticT = 0.5;
          }
        }
      }

      const mv = Input.moveVec();
      p.moving = mv.x !== 0 || mv.y !== 0;

      if (p.dashT > 0) {
        p.dashT -= dt;
        p.x += p.dashDir.x * p.speed * AE.Data.CONST.DASH_SPEED * dt;
        p.y += p.dashDir.y * p.speed * AE.Data.CONST.DASH_SPEED * dt;
        // 逐光者：闪避穿过敌人造成伤害
        if (p.dashDamage) {
          const list = AE.Enemies.list;
          const now = AE.G.time;
          for (let i = 0; i < list.length; i++) {
            const e = list[i];
            if (!e.alive || e.spawning > 0) continue;
            if (now - (e.dashHitAt || -9) < 0.5) continue;
            const rr = e.r + p.r + 14;
            if (U.d2(p.x, p.y, e.x, e.y) > rr * rr) continue;
            e.dashHitAt = now;
            const crit = Math.random() < p.crit;
            const dmg = (40 + p.level * 6) * p.dmgMul * (crit ? p.critDmg : 1);
            AE.Enemies.damage(e, dmg, { crit: crit });
            e.kx = (e.kx || 0) + p.dashDir.x * 120;
            e.ky = (e.ky || 0) + p.dashDir.y * 120;
            AE.FX.spark(e.x, e.y, p.char.color, 6, { spd: 180, life: 0.35, size: 2.6 });
          }
        }
        p.trailT -= dt;
        if (p.trailT <= 0) {
          p.trailT = 0.028;
          p.after.push({ x: p.x, y: p.y, life: 0.3, max: 0.3 });
          if (p.after.length > 12) p.after.shift();
          AE.FX.spark(p.x, p.y, p.char.color, 1, { spd: 40, life: 0.3, size: 3, add: true });
        }
      } else {
        let dx = mv.x, dy = mv.y;
        const l = Math.hypot(dx, dy);
        if (l > 1) { dx /= l; dy /= l; }
        const spd = Player.moveSpeed(p);
        p.vx = dx * spd; p.vy = dy * spd;
        p.x += p.vx * dt; p.y += p.vy * dt;

        if (p.moving) p.facing = Math.atan2(dy, dx);
      }

      for (let i = p.after.length - 1; i >= 0; i--) {
        p.after[i].life -= dt;
        if (p.after[i].life <= 0) p.after.splice(i, 1);
      }

      // 星核爆发：E / 触屏「爆」——化身形态
      const wantUlt = Input.hit('KeyE') || Input.ultPressed;
      if (wantUlt) {
        if (p.ult >= p.ultMax && p.avatarT <= 0) Player.castUlt(p);
        Input.ultPressed = false;
      }

      // 星核化身：持续 10 秒，自动发射星矛 + 近身星火（按角色形态变化）
      if (p.avatarT > 0) {
        const av = p.avatar || AE.Data.AVATARS.echo;
        p.avatarT -= dt;
        p.avatarAtk -= dt * Player.attackSpeedMul(p);
        p.avatarAura -= dt;
        if (p.avatarAtk <= 0) {
          p.avatarAtk = av.cadence || 0.5;
          const ts = AE.Weapons.nearestEnemies(p.x, p.y, av.chain ? 6 : 4, 640);
          if (av.chain) {
            for (let ai = 0; ai < ts.length; ai++) {
              const tgt = ts[ai];
              AE.FX.line(p.x, p.y, tgt.x, tgt.y, av.color, 0.2, 5, false);
              AE.FX.spark(tgt.x, tgt.y, av.color, 5, { spd: 150, life: 0.3, size: 2.6 });
              AE.Enemies.damage(tgt, (55 + p.level * 8) * p.dmgMul, { crit: false, noSplash: true });
            }
            if (ts.length) AE.Audio.sfx('arc');
          } else {
            for (let ai = 0; ai < ts.length; ai++) {
              const tgt = ts[ai];
              const a = Math.atan2(tgt.y - p.y, tgt.x - p.x);
              AE.World.addBullet({
                x: p.x, y: p.y, vx: Math.cos(a) * 560, vy: Math.sin(a) * 560,
                r: 6, dmg: (60 + p.level * 9) * p.dmgMul, life: 1.5,
                color: av.color, kind: 'shard', pierce: 2, hitIds: [],
                critChance: p.crit, critDmg: p.critDmg, size: 7,
                homing: 3.2, target: tgt, trailT: 0
              });
            }
            if (ts.length) AE.Audio.sfx('lance', { pitch: 1.25 });
          }
          if (av.drain && ts.length) {
            const healed = AE.Player.heal(p, 2 * ts.length);
            if (healed) AE.Audio.sfx('heal');
          }
        }
        if (p.avatarAura <= 0) {
          p.avatarAura = 0.5;
          const near = AE.World.grid.query(p.x, p.y, av.aura || 175);
          const ad = (30 + p.level * 4) * p.dmgMul;
          for (let ai = 0; ai < near.length; ai++) {
            const o = near[ai];
            if (!o.alive || o.spawning > 0) continue;
            if (U.d2(p.x, p.y, o.x, o.y) > (av.aura || 175) * (av.aura || 175)) continue;
            if (av.burn) {
              o.burnT = Math.max(o.burnT || 0, 2.6);
              o.burnDps = Math.max(o.burnDps || 0, (10 + p.level * 1.8) * (p.burnMul || 1));
            }
            AE.Enemies.damage(o, ad, { crit: false, noSplash: true, noFrost: true });
          }
          AE.FX.ring(p.x, p.y, av.color, 6, av.aura || 175, 0.4, 2);
        }
        if (p.avatarT <= 0) {
          p.avatarT = 0;
          p.invuln = Math.max(p.invuln, 1.1);
          AE.FX.flash(0.35, '#ffd479');
          AE.FX.shake(0.8);
          AE.FX.ring(p.x, p.y, '#ffd479', 16, 520, 0.8, 6);
          AE.Audio.sfx('explosion');
          if (AE.Game) AE.Game.announce('化身结束 · 星核余波', '#ffd479', 1.8);
          const near = AE.World.grid.query(p.x, p.y, 420);
          const dmg = (160 + p.level * 16) * p.dmgMul;
          for (let ai = 0; ai < near.length; ai++) {
            const o = near[ai];
            if (!o.alive || o.spawning > 0) continue;
            if (U.d2(p.x, p.y, o.x, o.y) > 420 * 420) continue;
            AE.Enemies.damage(o, dmg, { crit: false, noSplash: true, noFrost: true });
          }
        }
      }

      // 冲刺输入
      const wantDash = Input.hit('Space') || Input.hit('ShiftLeft') || Input.hit('ShiftRight') || Input.dashPressed;
      Input.dashPressed = false;
      if (wantDash && p.dashT <= 0 && p.dashCd <= 0) {
        if (AE.G) AE.G.dashes = (AE.G.dashes || 0) + 1;
        let ax = mv.x, ay = mv.y;
        if (!ax && !ay) { ax = Math.cos(p.aimAngle); ay = Math.sin(p.aimAngle); }
        const n = U.norm(ax, ay);
        p.dashDir = { x: n.x, y: n.y };
        p.dashT = AE.Data.CONST.DASH_TIME;
        p.dashCd = AE.Data.CONST.DASH_CD * p.dashCdMul;
        p.invuln = Math.max(p.invuln, 0.36);
        if (p.timeWarp) {
          p.warpT = 1.6;
          AE.FX.ring(p.x, p.y, p.char.color, 8, 70, 0.35, 2.5);
          AE.FX.text(p.x, p.y - 24, '时隙超频', '#d9c6ff', 12);
        }
        if (p.refractChance > 0) {
          p.refractBoostT = 3;
          AE.FX.ring(p.x, p.y, '#c9a6ff', 5, 56, 0.4, 2.2);
        }
        AE.Audio.sfx('dash');
        AE.FX.ring(p.x, p.y, p.char.color, 6, 46, 0.35, 2);
        AE.FX.spark(p.x, p.y, p.char.color, 8, { spd: 160, life: 0.35, size: 2.4 });
      }

      p.x = U.clamp(p.x, 24, AE.Data.CONST.WORLD_W - 24);
      p.y = U.clamp(p.y, 24, AE.Data.CONST.WORLD_H - 24);
    },

    /* 星核爆发：清屏大招，消耗 100 点星核能量 */
    castUlt: function (p) {
      if (!p || !p.alive || p.ult < p.ultMax) return false;
      const G = AE.G, U2 = AE.U;
      p.ult = 0;
      p.invuln = Math.max(p.invuln, 1.6);
      p.ultPulse = 1;
      p.avatarT = 10;
      p.avatarAtk = 0.25;
      p.avatarAura = 0.25;
      p.avatar = AE.Data.AVATARS[p.char.id] || AE.Data.AVATARS.echo;
      G.ultCasts = (G.ultCasts || 0) + 1;
      const cx = p.x, cy = p.y, R = 520;
      const dmg = (160 + p.level * 16) * p.dmgMul;
      const avCol = (p.avatar && p.avatar.color) || '#ffd479';
      AE.FX.flash(0.6, avCol);
      AE.FX.shake(1.2);
      AE.FX.ring(cx, cy, avCol, 24, R, 0.9, 9);
      AE.FX.ring(cx, cy, '#ffffff', 12, R * 0.55, 0.7, 5);
      AE.FX.spark(cx, cy, avCol, 90, { spd: 640, life: 1.1, size: 4.5 });
      AE.Audio.sfx('nova');
      AE.Audio.sfx('explosion');
      const list = AE.Enemies.list.slice();
      for (let i = 0; i < list.length; i++) {
        const e = list[i];
        if (!e.alive || e.spawning > 0) continue;
        if (U2.d2(cx, cy, e.x, e.y) > R * R) continue;
        e.stun = Math.max(e.stun || 0, 0.65);
        AE.Enemies.damage(e, dmg, { crit: false, noSplash: true, noFrost: true });
      }
      const eb = AE.World.ebullets;
      for (let i = eb.length - 1; i >= 0; i--) {
        if (U2.d2(cx, cy, eb[i].x, eb[i].y) < R * R) eb.splice(i, 1);
      }
      G.slowT = Math.max(G.slowT || 0, 0.32);
      if (AE.UI && AE.UI.syncDash) AE.UI.syncDash();
      if (AE.Game && AE.Game.announce) AE.Game.announce('星核化身 · AVATAR', '#ffd479', 2.2);
      return true;
    },

    setAim: function (p, x, y) {
      p.aimX = x; p.aimY = y;
      const a = Math.atan2(y - p.y, x - p.x);
      p.aimAngle = a;
    },

    heal: function (p, amount) {
      const before = p.hp;
      p.hp = Math.min(p.maxHp, p.hp + amount);
      const real = p.hp - before;
      p.healed += real;
      if (real > 0) {
        p.healAcc = (p.healAcc || 0) + real;
        if (p.healAcc >= 1) {
          const show = Math.floor(p.healAcc);
          p.healAcc -= show;
          AE.FX.text(p.x, p.y - 22, '+' + show, '#8affc1', 15);
        }
      }
      return real;
    },

    hurt: function (p, amount, srcX, srcY) {
      if (!p.alive || p.invuln > 0) return 0;
      let dmg = Math.max(1, amount - p.armor - Player.shardArmor(p));
      if (p.avatarT > 0) dmg = Math.max(1, dmg * ((p.avatar && p.avatar.reduce) || 0.55));
      else if (p.beamGuard && p.channeling) dmg = Math.max(1, dmg * 0.6);
      p.hp -= dmg;
      p.invuln = 0.55;
      p.flash = 0.3;
      p.hurtT = 0.5;
      AE.FX.text(p.x, p.y - 26, '-' + Math.round(dmg), '#ff6b8a', 17, true);
      AE.FX.spark(p.x, p.y, '#ff5c7a', 12, { spd: 220, life: 0.45, size: 3 });
      AE.FX.shake(0.32);
      AE.FX.flash(0.1, '#ff3355');
      AE.Audio.sfx('hurt');
      if (srcX !== undefined) {
        const n = U.norm(p.x - srcX, p.y - srcY);
        p.x += n.x * 8; p.y += n.y * 8;
      }
      if (p.hp <= 0) {
        p.hp = 0;
        p.alive = false;
      }
      return dmg;
    },

    /* ---------- 绘制 ---------- */
    /* 星核化身：伪 3D 星神造型（分层棱面 + 光翼 + 三重环） */
    drawAvatar: function (ctx, p, t) {
      const R = p.r * 2.8;
      const av = p.avatar || AE.Data.AVATARS.echo;
      const col = av.color || '#ffd479';
      ctx.save();
      ctx.translate(p.x, p.y);

      // 地面阴影
      ctx.globalAlpha = 0.38;
      ctx.fillStyle = '#000';
      ctx.beginPath(); ctx.ellipse(0, R * 0.92, R * 1.15, R * 0.4, 0, 0, U.TAU); ctx.fill();
      ctx.globalAlpha = 1;

      // 外层辉光
      ctx.globalCompositeOperation = 'lighter';
      AE.FX.glow(ctx, 0, 0, R * 2.6, col, 0.55);
      AE.FX.glow(ctx, 0, 0, R * 1.1, '#fff3c4', 0.8);

      // 光翼：六片菱形，反向旋转
      for (let i = 0; i < 6; i++) {
        const a = i * U.TAU / 6 - t * 0.55;
        ctx.save();
        ctx.rotate(a);
        const len = R * (1.5 + Math.sin(t * 2 + i) * 0.08);
        ctx.fillStyle = i % 2 ? AE.FX.alpha(col, 0.34) : 'rgba(255,255,255,0.16)';
        ctx.beginPath();
        ctx.moveTo(R * 0.5, 0);
        ctx.lineTo(len * 0.55, -R * 0.22);
        ctx.lineTo(len, 0);
        ctx.lineTo(len * 0.55, R * 0.22);
        ctx.closePath();
        ctx.fill();
        ctx.restore();
      }

      // 三重环
      ctx.globalCompositeOperation = 'source-over';
      for (let i = 0; i < 3; i++) {
        ctx.save();
        ctx.rotate(t * (0.5 + i * 0.35) * (i % 2 ? -1 : 1));
        ctx.scale(1, 0.34);
        ctx.strokeStyle = AE.FX.alpha(i === 1 ? '#ffffff' : col, 0.45 - i * 0.08);
        ctx.lineWidth = 2.2 - i * 0.4;
        ctx.beginPath();
        ctx.arc(0, 0, R * (1.15 + i * 0.24), 0, U.TAU);
        ctx.stroke();
        ctx.restore();
      }

      // 伪 3D 棱面身体：底暗面 → 金色主面 → 顶部高光
      ctx.save();
      ctx.rotate(Math.sin(t * 0.9) * 0.12);
      ctx.fillStyle = '#2a1a2e';
      ctx.beginPath();
      ctx.moveTo(0, -R * 1.08); ctx.lineTo(R * 0.95, R * 0.1);
      ctx.lineTo(0, R * 1.12); ctx.lineTo(-R * 0.95, R * 0.1);
      ctx.closePath(); ctx.fill();
      const bg = ctx.createLinearGradient(-R, -R, R, R);
      bg.addColorStop(0, '#ffffff');
      bg.addColorStop(0.4, col);
      bg.addColorStop(0.8, 'rgba(30,18,40,1)');
      bg.addColorStop(1, '#120a18');
      ctx.fillStyle = bg;
      ctx.beginPath();
      ctx.moveTo(0, -R * 0.92); ctx.lineTo(R * 0.78, R * 0.04);
      ctx.lineTo(0, R * 0.94); ctx.lineTo(-R * 0.78, R * 0.04);
      ctx.closePath(); ctx.fill();
      ctx.strokeStyle = 'rgba(255,248,220,0.9)';
      ctx.lineWidth = 1.6; ctx.stroke();
      // 左侧暗面 + 右侧亮面
      ctx.fillStyle = 'rgba(90,40,10,0.35)';
      ctx.beginPath();
      ctx.moveTo(0, -R * 0.92); ctx.lineTo(-R * 0.78, R * 0.04);
      ctx.lineTo(0, R * 0.94); ctx.closePath(); ctx.fill();
      ctx.fillStyle = 'rgba(255,255,240,0.5)';
      ctx.beginPath();
      ctx.moveTo(0, -R * 0.92); ctx.lineTo(R * 0.78, R * 0.04);
      ctx.lineTo(0, R * 0.32); ctx.closePath(); ctx.fill();
      ctx.restore();

      // 核心
      ctx.globalCompositeOperation = 'lighter';
      ctx.fillStyle = 'rgba(255,255,255,0.95)';
      ctx.beginPath(); ctx.arc(0, 0, R * 0.16 + Math.sin(t * 8) * 2, 0, U.TAU); ctx.fill();

      // 三颗卫星碎片
      for (let i = 0; i < 3; i++) {
        const a = t * 1.6 + i * U.TAU / 3;
        const ox = Math.cos(a) * R * 1.35, oy = Math.sin(a) * R * 0.5;
        AE.FX.glow(ctx, ox, oy, R * 0.24, '#fff3c4', 0.7);
        ctx.fillStyle = '#fff8e0';
        ctx.beginPath(); ctx.arc(ox, oy, 2.6, 0, U.TAU); ctx.fill();
      }
      ctx.globalCompositeOperation = 'source-over';

      // 朝向指针
      ctx.save();
      ctx.rotate(p.aimAngle);
      ctx.fillStyle = AE.FX.alpha(col, 0.9);
      ctx.beginPath();
      ctx.moveTo(R * 1.1, 0); ctx.lineTo(R * 0.86, -5); ctx.lineTo(R * 0.86, 5);
      ctx.closePath(); ctx.fill();
      ctx.restore();

      ctx.restore();
    },

    draw: function (ctx, p) {
      if (p.avatarT > 0) { this.drawAvatar(ctx, p, p.t); return; }
      const t = p.t;
      const col = p.char.color;
      ctx.save();
      ctx.translate(p.x, p.y);

      // 残影
      for (let i = 0; i < p.after.length; i++) {
        const a = p.after[i];
        const k = a.life / a.max;
        ctx.globalAlpha = k * 0.28;
        ctx.fillStyle = col;
        ctx.beginPath();
        ctx.arc(a.x - p.x, a.y - p.y, p.r * 0.8 * k, 0, U.TAU);
        ctx.fill();
      }
      ctx.globalAlpha = 1;

      // 地面投影
      ctx.globalAlpha = 0.32;
      ctx.fillStyle = '#000000';
      ctx.beginPath();
      ctx.ellipse(0, p.r * 0.9, p.r * 1.15, p.r * 0.5, 0, 0, U.TAU);
      ctx.fill();
      ctx.globalAlpha = 1;

      // 光环
      ctx.globalCompositeOperation = 'lighter';
      AE.FX.glow(ctx, 0, 0, 54 + Math.sin(t * 3) * 4, col, 0.42);

      // 引擎尾焰：沿移动方向拖出双层焰流
      const spd = Math.hypot(p.vx || 0, p.vy || 0);
      if (spd > 24 || p.dashT > 0) {
        const ea = p.dashT > 0 ? Math.atan2(p.dashDir.y, p.dashDir.x) : Math.atan2(p.vy, p.vx);
        const len = (p.dashT > 0 ? 30 : 12 + Math.min(14, spd * 0.03)) * (0.85 + Math.sin(t * 22) * 0.15);
        ctx.save();
        ctx.rotate(ea);
        for (let fi = 0; fi < 2; fi++) {
          ctx.fillStyle = fi === 0 ? AE.FX.alpha(col, 0.5) : 'rgba(255,255,255,0.7)';
          ctx.beginPath();
          ctx.moveTo(-p.r * 0.6, -p.r * (0.34 - fi * 0.14));
          ctx.lineTo(-p.r - len * (fi === 0 ? 1 : 0.55), 0);
          ctx.lineTo(-p.r * 0.6, p.r * (0.34 - fi * 0.14));
          ctx.closePath();
          ctx.fill();
        }
        ctx.restore();
      }

      // 装甲翼片：三层旋转外框，做出轻微立体感
      ctx.globalCompositeOperation = 'source-over';
      ctx.save();
      ctx.rotate(t * 0.35);
      for (let wi = 0; wi < 3; wi++) {
        const rr = p.r + 10 + wi * 5;
        const a0 = wi * 2.1;
        ctx.strokeStyle = AE.FX.alpha(col, 0.22 - wi * 0.05);
        ctx.lineWidth = 1.2;
        ctx.beginPath();
        ctx.arc(0, 0, rr, a0, a0 + 0.9);
        ctx.stroke();
      }
      ctx.restore();

      // 星核就绪：金色旋转符文环
      if (p.ult >= p.ultMax) {
        ctx.save();
        ctx.globalCompositeOperation = 'lighter';
        ctx.rotate(-t * 1.6);
        ctx.strokeStyle = 'rgba(255,212,121,0.85)';
        ctx.lineWidth = 2;
        ctx.setLineDash([7, 9]);
        ctx.beginPath();
        ctx.arc(0, 0, p.r + 17, 0, U.TAU);
        ctx.stroke();
        ctx.setLineDash([]);
        ctx.restore();
      }

      // 外圈
      ctx.globalCompositeOperation = 'source-over';
      ctx.strokeStyle = AE.FX.alpha(col, 0.55);
      ctx.lineWidth = 1.6;
      ctx.beginPath();
      ctx.arc(0, 0, p.r + 7, t * 0.6, t * 0.6 + 2.2);
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(0, 0, p.r + 7, t * 0.6 + Math.PI, t * 0.6 + Math.PI + 1.2);
      ctx.stroke();

      // 核心菱形
      const flash = p.flash > 0 ? 1 : 0;
      ctx.save();
      ctx.rotate(t * 0.8);
      const g1 = ctx.createLinearGradient(-p.r, -p.r, p.r, p.r);
      g1.addColorStop(0, flash ? '#ffffff' : col);
      g1.addColorStop(1, flash ? '#ffd0d8' : '#1b2450');
      ctx.fillStyle = g1;
      ctx.beginPath();
      ctx.moveTo(0, -p.r);
      ctx.lineTo(p.r * 0.82, 0);
      ctx.lineTo(0, p.r);
      ctx.lineTo(-p.r * 0.82, 0);
      ctx.closePath();
      ctx.fill();
      ctx.strokeStyle = flash ? '#ffffff' : AE.FX.alpha(col, 0.9);
      ctx.lineWidth = 1.4;
      ctx.stroke();
      ctx.restore();

      // 内核
      ctx.fillStyle = '#ffffff';
      ctx.globalAlpha = 0.9;
      ctx.beginPath();
      ctx.arc(0, 0, 3.2 + Math.sin(t * 6) * 0.6, 0, U.TAU);
      ctx.fill();
      ctx.globalAlpha = 1;

      // 朝向箭头
      ctx.save();
      ctx.rotate(p.aimAngle);
      ctx.fillStyle = AE.FX.alpha(col, 0.95);
      ctx.beginPath();
      ctx.moveTo(p.r + 13, 0);
      ctx.lineTo(p.r + 4, -4.2);
      ctx.lineTo(p.r + 4, 4.2);
      ctx.closePath();
      ctx.fill();
      ctx.restore();

      // 冲刺冷却环
      if (p.dashCd > 0.02) {
        const k = 1 - p.dashCd / (AE.Data.CONST.DASH_CD * p.dashCdMul);
        ctx.strokeStyle = 'rgba(160,200,255,0.28)';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(0, 0, p.r + 12, -Math.PI / 2, -Math.PI / 2 + U.TAU * k);
        ctx.stroke();
      }

      // 无敌闪烁
      if (p.invuln > 0 && p.dashT <= 0) {
        const blink = 0.35 + 0.35 * Math.sin(t * 30);
        ctx.globalAlpha = blink;
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.arc(0, 0, p.r + 5, 0, U.TAU);
        ctx.stroke();
        ctx.globalAlpha = 1;
      }

      ctx.globalCompositeOperation = 'source-over';
      ctx.restore();
    }
  };

  AE.Player = Player;
})(typeof window !== 'undefined' ? window : globalThis);
