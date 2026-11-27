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
        dashCdMul: 1,
        revives: lv('revive'),
        level: 1, xp: 0, xpNeed: D.xpNeed(1),
        weapons: [], passives: {}, passiveCount: 0,
        aimX: 0, aimY: 0, aimAngle: -Math.PI / 2,
        dashT: 0, dashCd: 0, dashDir: { x: 1, y: 0 },
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
          }
          return w;
        }
      }
      const w = { id: id, level: Math.min(8, level || 1), evolved: false, t: 0.25, spin: Math.random() * 6 };
      p.weapons.push(w);
      return w;
    },

    onEvolve: function (p, w) {
      const def = AE.Data.WEAPON_MAP[w.id];
      AE.FX.ring(p.x, p.y, def.evolved ? def.color : def.color, 10, 240, 0.7, 5);
      AE.FX.spark(p.x, p.y, def.color, 34, { spd: 340, life: 0.8, size: 3.4 });
      AE.FX.flash(0.22, def.color);
      AE.FX.shake(0.5);
      AE.Audio.sfx('evolve');
      if (AE.Game) AE.Game.announce('武器进化 · ' + (def.evolved ? def.evolved.name : def.name), def.color, 2.6);
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

    update: function (p, dt) {
      if (!p.alive) return;
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

      const mv = Input.moveVec();
      p.moving = mv.x !== 0 || mv.y !== 0;

      if (p.dashT > 0) {
        p.dashT -= dt;
        p.x += p.dashDir.x * p.speed * AE.Data.CONST.DASH_SPEED * dt;
        p.y += p.dashDir.y * p.speed * AE.Data.CONST.DASH_SPEED * dt;
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
        const spd = p.speed * (1 + p.spdMul);
        p.vx = dx * spd; p.vy = dy * spd;
        p.x += p.vx * dt; p.y += p.vy * dt;

        if (p.moving) p.facing = Math.atan2(dy, dx);
      }

      for (let i = p.after.length - 1; i >= 0; i--) {
        p.after[i].life -= dt;
        if (p.after[i].life <= 0) p.after.splice(i, 1);
      }

      // 冲刺输入
      const wantDash = Input.hit('Space') || Input.hit('ShiftLeft') || Input.hit('ShiftRight') || Input.dashPressed;
      Input.dashPressed = false;
      if (wantDash && p.dashT <= 0 && p.dashCd <= 0) {
        let ax = mv.x, ay = mv.y;
        if (!ax && !ay) { ax = Math.cos(p.aimAngle); ay = Math.sin(p.aimAngle); }
        const n = U.norm(ax, ay);
        p.dashDir = { x: n.x, y: n.y };
        p.dashT = AE.Data.CONST.DASH_TIME;
        p.dashCd = AE.Data.CONST.DASH_CD * p.dashCdMul;
        p.invuln = Math.max(p.invuln, 0.36);
        AE.Audio.sfx('dash');
        AE.FX.ring(p.x, p.y, p.char.color, 6, 46, 0.35, 2);
        AE.FX.spark(p.x, p.y, p.char.color, 8, { spd: 160, life: 0.35, size: 2.4 });
      }

      p.x = U.clamp(p.x, 24, AE.Data.CONST.WORLD_W - 24);
      p.y = U.clamp(p.y, 24, AE.Data.CONST.WORLD_H - 24);
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
      if (real > 0) AE.FX.text(p.x, p.y - 22, '+' + Math.round(real), '#8affc1', 15);
      return real;
    },

    hurt: function (p, amount, srcX, srcY) {
      if (!p.alive || p.invuln > 0) return 0;
      const dmg = Math.max(1, amount - p.armor);
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
    draw: function (ctx, p) {
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
