/* ============================================================
 * game.js — 主循环 / 状态机 / 波次导演 / 升级 / HUD / 结算
 * ============================================================ */
(function (g) {
  'use strict';
  const AE = (g.AE = g.AE || {});
  const U = AE.U;
  const STEP = 1 / 60;

  const G = {
    state: 'menu',
    time: 0, loop: 0, t: 0, frame: 0,
    player: null, enemies: null, boss: null,
    kills: 0, bossKills: 0, combo: 0, comboT: 0,
    xp: 0, level: 1, xpNeed: 0, pending: 0,
    spawnT: 0, eliteT: 50, bossIdx: 0, bossWarnT: 0, bossWarned: false,
    draft: null, anns: [], timers: [], echoBonus: 0, winning: false,
    slowT: 0, daily: null, mod: null,
    rush: false, rushIndex: 0, rushGap: 0,
    relicLock: false,
    event: null, eventT: 0, eventLeft: 0, meteorT: 0,
    eventCount: 0, burnKills: 0, ultCasts: 0, abyssKilled: false,
    stats: { damage: 0 }, result: null
  };
  AE.G = G;

  const Game = {
    canvas: null, ctx: null, W: 1280, H: 720, dpr: 1,
    acc: 0, last: 0, headless: false, pausedByBlur: false,

    init: function (canvas) {
      this.canvas = canvas;
      this.ctx = canvas.getContext('2d', { alpha: false });
      this.headless = !!AE.HEADLESS;
      AE.Save.load();
      AE.Audio.muted = !!AE.Save.data.muted;
      this.applySettings();
      G.enemies = AE.Enemies.list;
      this.resize();
      if (!this.headless) {
        AE.Input.init(canvas);
        const self = this;
        g.addEventListener('resize', function () { self.resize(); });
        g.addEventListener('visibilitychange', function () {
          if (document.hidden && G.state === 'playing') self.pause(true);
        });
        g.addEventListener('keydown', function (e) {
          if (e.code === 'KeyM' && G.state !== 'menu') {
            const m = AE.Audio.toggle();
            AE.UI.toast(m ? '已静音' : '声音开启', '#7df9ff');
          }
          if (e.code === 'Escape' || e.code === 'KeyP') {
            if (G.state === 'playing') self.pause();
            else if (G.state === 'paused') self.resume();
          }
        });
        AE.UI.init();
        this.startMenu();
        this.last = performance.now();
        const loop = function (now) { self.frame(now); };
        if (typeof g.requestAnimationFrame === 'function') g.requestAnimationFrame(loop);
      }
    },

    resize: function () {
      const w = Math.max(320, g.innerWidth || 1280);
      const h = Math.max(240, g.innerHeight || 720);
      this.W = w; this.H = h;
      this.dpr = Math.min(2, g.devicePixelRatio || 1);
      if (this.canvas) {
        this.canvas.width = Math.floor(w * this.dpr);
        this.canvas.height = Math.floor(h * this.dpr);
        this.canvas.style.width = w + 'px';
        this.canvas.style.height = h + 'px';
      }
      AE.Cam.init(w, h);
      AE.FX.init(w, h, this.dpr);
    },

    applySettings: function () {
      const s = (AE.Save.data && AE.Save.data.settings) || {};
      AE.Audio.setMusicVolume(s.music === undefined ? 0.7 : s.music);
      AE.Audio.setSfxVolume(s.sfx === undefined ? 0.85 : s.sfx);
      AE.FX.shakeMul = s.shake === undefined ? 1 : s.shake;
      AE.FX.dmgText = s.dmgText !== false;
      AE.FX.quality = s.quality || 1;
      AE.FX.motion = s.motion !== false;
      AE.FX.contrast = !!s.contrast;
      if (typeof document !== 'undefined' && document.body && document.body.classList &&
          document.body.classList.toggle) {
        document.body.classList.toggle('high-contrast', !!s.contrast);
        document.body.classList.toggle('reduce-motion', s.motion === false);
      }
    },

    dailyInfo: function () {
      const key = AE.dateKey();
      if (this._dailyKey === key && this._dailyInfo) return this._dailyInfo;
      const seed = AE.hashSeed('aether-echo-' + key);
      const rng = AE.mulberry32(seed ^ 0x9e3779b9);
      const pool = AE.Data.ANOMALIES.slice();
      const picked = [];
      for (let i = 0; i < 2 && pool.length; i++) {
        const idx = Math.floor(rng() * pool.length) % pool.length;
        picked.push(pool.splice(idx, 1)[0]);
      }
      this._dailyKey = key;
      this._dailyInfo = { key: key, seed: seed, anomalies: picked };
      return this._dailyInfo;
    },

    modFrom: function (list) {
      const m = {
        enemySpeed: 1, enemyDmg: 1, enemyHp: 1,
        xpMul: 1, echoMul: 1, spawnMul: 1, armor: 0, speedMul: 1
      };
      (list || []).forEach(function (a) {
        if (a.id === 'swift') { m.enemySpeed *= 1.2; m.xpMul *= 1.15; }
        else if (a.id === 'frenzy') { m.enemyDmg *= 1.25; m.echoMul *= 1.2; }
        else if (a.id === 'greed') { m.xpMul *= 1.35; }
        else if (a.id === 'void') { m.enemyHp *= 0.9; m.spawnMul *= 1.2; }
        else if (a.id === 'iron') { m.armor += 3; m.speedMul *= 0.94; }
      });
      return m;
    },

    checkAchievements: function (final) {
      const S = AE.Save.data;
      if (!S || !AE.Data.ACHIEVEMENTS) return;
      if (!Array.isArray(S.achievements)) S.achievements = [];
      if (!S.stats) S.stats = { kills: 0, time: 0, damage: 0, bosses: 0, wins: 0, evolves: 0, runs: 0 };
      const st = S.stats;
      const runActive = !!G.player && (G.state === 'playing' || G.state === 'levelup' || G.state === 'paused' || G.state === 'gameover' || G.state === 'victory');
      const runKills = runActive ? G.kills : 0;
      const runBosses = runActive ? G.bossKills : 0;
      const runLevel = runActive ? G.level : 0;
      const runTime = runActive ? G.time : 0;
      const totalKills = (st.kills || 0) + (final ? 0 : runKills);
      const totalBosses = (st.bosses || 0) + (final ? 0 : runBosses);
      const list = AE.Data.ACHIEVEMENTS;
      const unlock = function (id) {
        if (S.achievements.indexOf(id) >= 0) return;
        S.achievements.push(id);
        AE.Save.save();
        const a = list.filter(function (x) { return x.id === id; })[0];
        if (a && AE.UI) AE.UI.toast('成就解锁 · ' + a.name, a.color || '#ffd479');
        if (AE.Audio) AE.Audio.sfx('evolve');
      };
      if (totalKills >= 1) unlock('first_blood');
      if (totalKills >= 100) unlock('kills_100');
      if (totalKills >= 1000) unlock('kills_1000');
      if (totalKills >= 10000) unlock('kills_10000');
      if (runKills >= 300) unlock('run_300');
      if (runKills >= 600) unlock('run_600');
      if (runLevel >= 20) unlock('lv20');
      if (runLevel >= 40) unlock('lv40');
      if (totalBosses >= 1) unlock('boss1');
      if (totalBosses >= 10) unlock('boss10');
      if ((st.evolves || 0) >= 1) unlock('evolve1');
      if ((st.evolves || 0) >= 6) unlock('evolve6');
      if (runTime >= 600) unlock('time10');
      if ((st.wins || 0) >= 1) unlock('win1');
      if (runTime >= 900) unlock('time15');
      if ((st.runs || 0) >= 10) unlock('runs10');
      if (runActive && G.player.relics && G.player.relics.length >= 4) unlock('relic4');
      if (runActive && G.player.relics && G.player.relics.length >= 5) unlock('relic5');
      if (S.bestRush && S.bestRush.time > 0) unlock('rush_win');
      if ((G.pactWinTier || 0) >= 2) unlock('pact2');
      if ((G.pactWinTier || 0) >= 4) unlock('pact4');
      if (G.abyssKilled) unlock('abyss_kill');
      if ((G.eventCount || 0) >= 5) unlock('event5');
      if ((G.burnKills || 0) >= 300) unlock('burn300');
      if ((G.ultCasts || 0) >= 20) unlock('ult20');
      if (S.chars.length >= AE.Data.CHARS.length) unlock('allchar');
    },

    /* ---------- 场景 ---------- */
    startMenu: function () {
      G.state = 'menu';
      G.time = 0; G.loop = 0;
      G.daily = null; G.mod = null;
      G.rush = false; G.rushIndex = 0; G.rushGap = 0;
      AE.RNG.restore();
      G.enemies = AE.Enemies.list;
      if (!G.player) {
        AE.Cam.x = AE.Data.CONST.WORLD_W / 2;
        AE.Cam.y = AE.Data.CONST.WORLD_H / 2;
      }
      AE.FX.reset();
      AE.Audio.setIntensity(0.14);
      AE.UI.showMenu();
    },

    startRun: function (charId, daily, rush, pacts) {
      if (G.state === 'playing') return;
      AE.Audio.init();
      const S = AE.Save.data;
      if (charId && AE.Data.CHAR_MAP[charId] && S.chars.indexOf(charId) >= 0) S.char = charId;
      charId = S.char || 'echo';
      const isDaily = !!daily;
      const isRush = !!rush;
      G.daily = isDaily ? this.dailyInfo() : null;
      G.mod = this.modFrom(G.daily ? G.daily.anomalies : []);
      G.pacts = Array.isArray(pacts) ? pacts.filter(function (id) {
        return AE.Data.PACT_MAP && AE.Data.PACT_MAP[id];
      }).slice(0, 4) : [];
      G.pactMult = 1 + G.pacts.reduce(function (s, id) {
        return s + (AE.Data.PACT_MAP[id].mult || 0.2);
      }, 0);
      if (G.pacts.indexOf('horde') >= 0) G.mod.spawnMul *= 1.35;
      if (G.pacts.indexOf('frenzy') >= 0) G.mod.enemyDmg *= 1.3;
      if (G.pacts.indexOf('swift') >= 0) G.mod.enemySpeed *= 1.25;
      if (isDaily) AE.RNG.set(G.daily.seed); else AE.RNG.restore();
      AE.Enemies.reset();
      AE.World.reset();
      AE.FX.reset();
      G.timers.length = 0;
      G.anns.length = 0;
      G.state = 'playing';
      G.time = 0; G.loop = 0; G.frame = 0; this.acc = 0;
      G.kills = 0; G.bossKills = 0; G.combo = 0; G.comboT = 0;
      G.level = 1; G.xp = 0; G.xpNeed = AE.Data.xpNeed(1);
      G.pending = 0; G.draft = null;
      G.spawnT = 0.6;
      G.eliteT = (G.pacts.indexOf('elite') >= 0 ? 27 : 55);
      G.bossIdx = 0; G.boss = null;
      G.bossWarnT = 0; G.bossWarned = false; G.winning = false;
      G.slowT = 0;
      G.rush = isRush; G.rushIndex = 0; G.rushGap = 1.2;
      G.relicLock = false;
      G.echoBonus = 0; G.stats = { damage: 0 }; G.result = null;
      G.pactWinTier = 0;
      G.event = null; G.eventLeft = 0; G.meteorT = 0;
      G.eventCount = 0; G.burnKills = 0; G.ultCasts = 0; G.abyssKilled = false;
      G.eventT = 55 + Math.random() * 25;
      G.player = AE.Player.create(charId);
      G.player.level = 1;
      G.player.armor += G.mod.armor || 0;
      G.player.speed *= G.mod.speedMul || 1;
      if (isRush) {
        if (G.player.weapons[0]) G.player.weapons[0].level = 3;
        const pool = AE.Data.WEAPONS.map(function (w) { return w.id; }).filter(function (id) {
          return !G.player.weapons.some(function (w) { return w.id === id; });
        });
        if (pool.length) {
          AE.Player.addWeapon(G.player, pool[Math.floor(Math.random() * pool.length)], 2);
        }
        AE.Player.addPassive(G.player, 'power');
        AE.Player.addPassive(G.player, 'power');
        AE.Player.addPassive(G.player, 'vitality');
      }
      AE.Cam.resize(this.W, this.H);
      AE.Cam.snap(G.player);
      AE.Cam.trauma = 0;
      AE.UI.hideAll();
      AE.Audio.setIntensity(0.24);
      AE.Audio.sfx('ui');
      AE.Player.setAim(G.player, G.player.x + 120, G.player.y);
      AE.FX.flash(0.35, '#ffffff');
      AE.FX.ring(G.player.x, G.player.y, '#7df9ff', 10, 220, 0.8, 3);
      this.announce(isRush ? '首领连战 · 六连战' : '第 1 层 · 苏醒', isRush ? '#ffd479' : '#7df9ff', 2.0);
      if (isDaily) {
        this.announce('每日挑战 · ' + G.daily.key, '#ffd479', 3.0);
        G.daily.anomalies.forEach(function (a) {
          this.announce('今日扰动 · ' + a.name, a.color, 2.6);
        }, this);
      }
      this.pausedByBlur = false;
    },

    pause: function (byBlur) {
      if (G.state !== 'playing') return;
      G.state = 'paused';
      this.pausedByBlur = !!byBlur;
      AE.UI.showPause(byBlur);
    },

    resume: function () {
      if (G.state !== 'paused') return;
      G.state = 'playing';
      this.acc = 0;
      this.last = performance.now();
      AE.UI.hidePause();
    },

    toMenu: function () {
      this.startMenu();
    },

    restart: function () {
      G.state = 'menu';
      this.startRun(AE.Save.data.char, !!G.daily, !!G.rush, (G.pacts || []).slice());
    },

    continueEndless: function () {
      G.loop = (G.loop || 0) + 1;
      G.time = 0;
      G.bossIdx = 0; G.boss = null; G.bossWarned = false;
      G.winning = false;
      G.spawnT = 0.5;
      // 无尽轮不再属于每日挑战：恢复全局 RNG，避免污染当日最佳、也避免“固定种子”假象
      G.daily = null;
      AE.RNG.restore();
      G.state = 'playing';
      AE.UI.hideAll();
      AE.FX.flash(0.3, '#b388ff');
      this.announce('无尽回响 · 第 ' + (G.loop + 1) + ' 轮', '#b388ff', 2.4);
      AE.Audio.setIntensity(0.3);
    },

    /* ---------- 主循环 ---------- */
    frame: function (now) {
      const self = this;
      if (!this.last) this.last = now;
      let dt = (now - this.last) / 1000;
      this.last = now;
      if (dt > 0.08) dt = 0.08;
      if (dt < 0) dt = 0;
      if (G.slowT > 0) { G.slowT -= dt; dt *= 0.35; }

      // 自适应画质：持续低于约 43fps 时自动降一档
      if (G.state === 'playing' && !this.headless) {
        this.perfT = (this.perfT || 0) + dt;
        this.perfSum = (this.perfSum || 0) + dt;
        this.perfN = (this.perfN || 0) + 1;
        if (this.perfT > 3) {
          const avg = this.perfSum / Math.max(1, this.perfN);
          const q = (AE.Save.data.settings && AE.Save.data.settings.quality) || 1;
          if (avg > 0.0235 && q > 0.62) {
            AE.Save.data.settings.quality = Math.max(0.6, Math.round((q - 0.15) * 100) / 100);
            AE.Save.save();
            this.applySettings();
            if (AE.UI) AE.UI.toast('已自动降低画质以保持流畅', '#7df9ff');
          }
          this.perfT = 0; this.perfSum = 0; this.perfN = 0;
        }
      }

      G.t += dt;
      if (G.state === 'playing') {
        this.acc += dt;
        let guard = 0;
        while (this.acc >= STEP && guard < 6) {
          this.step(STEP);
          this.acc -= STEP;
          guard++;
          if (G.state !== 'playing') break;
        }
        if (this.acc > STEP * 8) this.acc = 0;
      } else {
        AE.FX.update(dt * 0.55);
        if (G.state === 'menu') AE.Cam.followMenu(dt);
      }
      this.render();
      AE.Input.endFrame();
      if (typeof g.requestAnimationFrame === 'function') {
        g.requestAnimationFrame(function (n) { self.frame(n); });
      }
    },

    step: function (dt) {
      const p = G.player;
      if (!p) return;
      G.frame++;
      if (AE.FX.hitstop > 0) {
        AE.FX.hitstop -= dt;
        AE.FX.update(dt);
        return;
      }

      G.time += dt;
      this.updateAim();
      AE.Player.update(p, dt);
      AE.Weapons.update(p, dt);
      const edt = (G.event && G.event.id === 'tide') ? dt * 0.55 : dt;
      AE.Enemies.update(edt);
      AE.World.grid.build(AE.Enemies.list);
      AE.World.update(dt, p);

      this.updateDirector(dt);
      this.updateEvents(dt);
      this.updateTimers(dt);
      this.updateAnns(dt);

      if (G.comboT > 0) {
        G.comboT -= dt;
        if (G.comboT <= 0) G.combo = 0;
      }
      if (G.bossWarnT > 0) G.bossWarnT -= dt;

      AE.FX.update(dt);
      AE.Cam.follow(p, dt, p.aimX, p.aimY);
      if (G.frame % 120 === 0) this.checkAchievements(false);

      if (G.frame % 30 === 0) {
        const density = AE.Enemies.list.length / 120;
        AE.Audio.setIntensity(U.clamp(0.18 + G.time / 900 + density * 0.5 + (G.boss ? 0.25 : 0), 0.1, 1));
      }

      p.level = G.level;
      if (G.xp >= G.xpNeed && G.level < AE.Data.CONST.LEVEL_MAX) {
        this.levelUp();
      } else if (G.pending > 0 && G.state === 'playing' && !G.relicLock) {
        this.openLevelUp(false);
      }

      if (!p.alive && G.state === 'playing') {
        this.playerDown();
      }
    },

    updateAim: function () {
      const p = G.player;
      if (!p) return;
      const Input = AE.Input;
      let ax = null, ay = null;
      if (Input.mouse.active && !Input.touch.on) {
        const w = AE.Cam.toWorld(Input.mouse.sx, Input.mouse.sy);
        ax = w.x; ay = w.y;
      } else {
        const mv = Input.moveVec();
        if (mv.x || mv.y) { ax = p.x + mv.x * 160; ay = p.y + mv.y * 160; }
        const n = AE.Enemies.nearestTo(p.x, p.y, 560);
        if (n) {
          const d = U.dist(p.x, p.y, n.x, n.y);
          if (!ax || d < 240) { ax = n.x; ay = n.y; }
        }
      }
      if (ax === null) { ax = p.x + Math.cos(p.aimAngle) * 120; ay = p.y + Math.sin(p.aimAngle) * 120; }
      AE.Player.setAim(p, ax, ay);
    },

    /* ---------- 波次导演 ---------- */
    spawnAtRing: function (defId, elite) {
      const p = G.player;
      const C = AE.Data.CONST;
      const vw = this.W / AE.Cam.zoom, vh = this.H / AE.Cam.zoom;
      const baseR = Math.hypot(vw, vh) / 2 + 60;
      let x = 0, y = 0;
      for (let i = 0; i < 10; i++) {
        const a = Math.random() * U.TAU;
        const r = baseR * U.rnd(0.92, 1.12);
        x = p.x + Math.cos(a) * r;
        y = p.y + Math.sin(a) * r;
        const inside = x > p.x - vw / 2 - 20 && x < p.x + vw / 2 + 20 && y > p.y - vh / 2 - 20 && y < p.y + vh / 2 + 20;
        if (!inside || i === 9) break;
      }
      x = U.clamp(x, 30, C.WORLD_W - 30);
      y = U.clamp(y, 30, C.WORLD_H - 30);
      if (elite) {
        const e = AE.Enemies.spawn(defId, x, y, { elite: true });
        if (e && G.pacts && G.pacts.indexOf('elite') >= 0) {
          e.maxHp = Math.round(e.maxHp * 1.25);
          e.hp = e.maxHp;
        }
        return e;
      }
      return AE.Enemies.spawn(defId, x, y);
    },

    pickWeighted: function (weights) {
      let total = 0;
      for (const k in weights) total += weights[k];
      let r = Math.random() * total;
      for (const k in weights) {
        r -= weights[k];
        if (r <= 0) return k;
      }
      return Object.keys(weights)[0];
    },

    currentTable: function () {
      const t = G.time;
      const table = AE.Data.SPAWN_TABLE;
      let cur = table[0];
      for (let i = 0; i < table.length; i++) if (t >= table[i].t) cur = table[i];
      return cur.w;
    },

    updateRushDirector: function (dt) {
      if (G.boss) return;
      const order = AE.Data.RUSH_ORDER;
      if (G.rushIndex >= order.length) return;
      G.rushGap -= dt;
      if (G.rushGap > 0) return;
      const id = order[G.rushIndex];
      const def = AE.Data.BOSSES.filter(function (b) { return b.id === id; })[0];
      if (!def) return;
      const p = G.player, C = AE.Data.CONST;
      const a = Math.random() * U.TAU;
      const x = U.clamp(p.x + Math.cos(a) * 470, 80, C.WORLD_W - 80);
      const y = U.clamp(p.y + Math.sin(a) * 470, 80, C.WORLD_H - 80);
      const b = AE.Enemies.spawnBoss(def, x, y);
      G.boss = b;
      G.rushIndex++;
      G.rushGap = 2.4;
      if (AE.UI && AE.UI.bossIntro) AE.UI.bossIntro(def);
      this.announce('首领连战 · ' + G.rushIndex + ' / ' + order.length, '#ffd479', 2.0);
    },

    updateDirector: function (dt) {
      if (G.winning) return;
      if (G.rush) { this.updateRushDirector(dt); return; }
      const C = AE.Data.CONST;
      const count = AE.Enemies.list.length;
      const pressure = count / C.MAX_ENEMIES;
      const bossFactor = G.boss ? 2.4 : 1;

      G.spawnT -= dt;
      if (G.spawnT <= 0 && count < C.MAX_ENEMIES * 0.92) {
        const interval = Math.max(0.42, (1.35 - G.time * 0.0014)) * bossFactor * (1 + pressure * 0.9);
        G.spawnT = interval;
        const table = this.currentTable();
        const batch = Math.max(1, Math.round((2 + Math.min(4, Math.floor(G.time / 110)) + (G.loop ? 1 : 0)) * ((G.mod && G.mod.spawnMul) || 1)));
        for (let i = 0; i < batch; i++) {
          const id = this.pickWeighted(table);
          this.spawnAtRing(id, false);
        }
      }

      G.eliteT -= dt;
      if (G.eliteT <= 0 && !G.boss) {
        G.eliteT = (46 + Math.random() * 10) * (G.pacts && G.pacts.indexOf('elite') >= 0 ? 0.5 : 1);
        if (count < C.MAX_ENEMIES - 4) {
          const table = this.currentTable();
          const id = this.pickWeighted(table);
          const e = this.spawnAtRing(id, true);
          if (e) {
            this.announce('精英 · ' + AE.Data.ENEMIES[id].name, '#ffd479', 1.8);
            AE.Audio.sfx('warn');
          }
        }
      }

      if (!G.boss && G.bossIdx < AE.Data.BOSSES.length) {
        const def = AE.Data.BOSSES[G.bossIdx];
        if (!G.bossWarned && G.time >= def.at - 3.5) {
          G.bossWarned = true;
          G.bossWarnT = 3.5;
          this.announce('⚠ 强敌接近 · ' + def.name, def.color, 3.2);
          AE.Audio.sfx('warn');
        }
        if (G.time >= def.at) {
          const p = G.player;
          const a = Math.random() * U.TAU;
          const r = 470;
          const x = U.clamp(p.x + Math.cos(a) * r, 80, C.WORLD_W - 80);
          const y = U.clamp(p.y + Math.sin(a) * r, 80, C.WORLD_H - 80);
          const b = AE.Enemies.spawnBoss(def, x, y);
          G.boss = b;
          G.bossIdx++;
          G.bossWarned = false;
          G.bossWarnT = 1.2;
          if (AE.UI && AE.UI.bossIntro) AE.UI.bossIntro(def);
        }
      }
    },

    /* ---------- 星象事件 ---------- */
    updateEvents: function (dt) {
      if (G.rush) return;
      if (G.event) {
        G.eventLeft -= dt;
        if (G.event.id === 'meteor') {
          G.meteorT -= dt;
          if (G.meteorT <= 0) { G.meteorT = 0.72; this.dropMeteor(); }
        }
        if (G.eventLeft <= 0) {
          const p = G.player;
          if (p) {
            AE.Player.heal(p, p.maxHp * 0.08);
            G.echoBonus += 5;
          }
          this.announce('星象平息 · 回复 8%', G.event.color, 1.8);
          G.event = null;
          G.eventT = 60 + Math.random() * 25;
        }
        return;
      }
      G.eventT -= dt;
      if (G.eventT <= 0 && G.time > 36 && !G.winning) this.startEvent();
    },

    startEvent: function (id) {
      let def = id ? AE.Data.EVENT_MAP[id] : null;
      if (!def) {
        const pool = AE.Data.EVENTS;
        let total = 0;
        for (let i = 0; i < pool.length; i++) total += pool[i].weight || 1;
        let r = Math.random() * total;
        for (let i = 0; i < pool.length; i++) {
          r -= pool[i].weight || 1;
          if (r <= 0) { def = pool[i]; break; }
        }
        if (!def) def = pool[0];
      }
      if (!def) return null;
      G.event = def;
      G.eventLeft = def.dur;
      G.meteorT = 0.45;
      G.eventCount = (G.eventCount || 0) + 1;
      if (def.id === 'hunt') {
        const p = G.player;
        for (let i = 0; i < 3; i++) {
          const a = Math.random() * U.TAU;
          const x = U.clamp(p.x + Math.cos(a) * 330, 50, AE.Data.CONST.WORLD_W - 50);
          const y = U.clamp(p.y + Math.sin(a) * 330, 50, AE.Data.CONST.WORLD_H - 50);
          AE.Enemies.spawn('stalker', x, y, { elite: true });
        }
        AE.FX.shake(0.4);
      }
      this.announce('星象 · ' + def.name, def.color, 2.4);
      AE.Audio.sfx(def.id === 'meteor' ? 'warn' : 'evolve');
      AE.FX.flash(0.06, def.color);
      return def;
    },

    dropMeteor: function (fx, fy) {
      const p = G.player;
      const alive = AE.Enemies.list.filter(function (e) {
        return e.alive && e.spawning <= 0 && !e.boss;
      });
      let tx, ty;
      if (typeof fx === 'number' && typeof fy === 'number') {
        tx = fx; ty = fy;
      } else if (alive.length && Math.random() < 0.75) {
        const t = alive[Math.floor(Math.random() * alive.length)];
        tx = t.x; ty = t.y;
      } else {
        const a = Math.random() * U.TAU;
        const r = 120 + Math.random() * 460;
        tx = p.x + Math.cos(a) * r;
        ty = p.y + Math.sin(a) * r;
      }
      tx = U.clamp(tx, 40, AE.Data.CONST.WORLD_W - 40);
      ty = U.clamp(ty, 40, AE.Data.CONST.WORLD_H - 40);
      AE.FX.ring(tx, ty, '#ff9f68', 6, 34, 0.42, 2);
      const self = this;
      this.delay(0.42, function () {
        AE.FX.ring(tx, ty, '#ff9f68', 12, 155, 0.5, 4);
        AE.FX.ring(tx, ty, '#ffffff', 5, 70, 0.3, 2);
        AE.FX.spark(tx, ty, '#ff9f68', 18, { spd: 300, life: 0.6, size: 3 });
        AE.FX.shake(0.16);
        AE.Audio.sfx('explosion');
        const dmg = (90 + G.level * 10) * (p.dmgMul || 1);
        const near = AE.World.grid.query(tx, ty, 155);
        for (let i = 0; i < near.length; i++) {
          const e = near[i];
          if (!e.alive || e.spawning > 0) continue;
          if (U.d2(tx, ty, e.x, e.y) > 155 * 155) continue;
          AE.Enemies.damage(e, dmg, { crit: false, noSplash: true, noFrost: true });
        }
      });
    },

    /* ---------- 升级 ---------- */
    levelUp: function () {
      G.xp -= G.xpNeed;
      G.level++;
      const p = G.player;
      p.level = G.level;
      p.maxHp += 4;
      p.hp = Math.min(p.maxHp, p.hp + 4);
      G.xpNeed = AE.Data.xpNeed(G.level);
      G.pending++;
      AE.FX.ring(p.x, p.y, '#ffd479', 6, 120, 0.6, 3);
      AE.FX.spark(p.x, p.y, '#ffd479', 20, { spd: 260, life: 0.7, size: 3 });
      AE.Audio.sfx('levelup');
      this.checkAchievements(false);
      if (G.state === 'playing') this.openLevelUp(false);
    },

    openLevelUp: function (forced) {
      if (!G.player) return;
      if (G.state !== 'playing') return;
      G.state = 'levelup';
      G.draft = {
        choices: AE.Upgrades.roll(3),
        rerolls: 1,
        forced: !!forced,
        level: G.level
      };
      AE.UI.showLevelUp(G.draft);
      AE.FX.flash(0.12, '#ffd479');
      AE.Audio.sfx('ui');
      AE.Cam.addShake(0.12);
      AE.Cam.pulse = 0.06;
    },

    openRelicDraft: function () {
      if (!G.player) return;
      if (G.state !== 'playing') return;
      const choices = AE.Relics.roll(G.player, 3);
      if (!choices.length) { G.relicLock = false; this.openLevelUp(true); return; }
      G.state = 'levelup';
      G.draft = { kind: 'relic', choices: choices, rerolls: 0, level: G.level };
      AE.UI.showLevelUp(G.draft);
      AE.FX.flash(0.10, '#ffd479');
      AE.Audio.sfx('ui');
      AE.Cam.pulse = 0.05;
    },

    chooseUpgrade: function (i) {
      if (!G.draft) return false;
      const c = G.draft.choices[i];
      if (!c) return false;
      const isRelic = G.draft.kind === 'relic';
      if (isRelic) {
        AE.Relics.apply(G.player, c.id);
        G.relicLock = false;
      } else {
        AE.Upgrades.apply(G.player, c);
        if (G.pending > 0) G.pending--;
      }
      G.draft = null;
      G.state = 'playing';
      AE.UI.hideLevelUp();
      AE.Input.pressed = {};
      this.acc = 0;
      this.last = performance.now();
      G.player.invuln = Math.max(G.player.invuln, 0.45);
      return true;
    },

    reroll: function () {
      if (!G.draft || G.draft.rerolls <= 0) return false;
      G.draft.rerolls--;
      G.draft.choices = AE.Upgrades.roll(3);
      AE.UI.showLevelUp(G.draft);
      AE.Audio.sfx('ui');
      return true;
    },

    /* ---------- 经验 / 回响 ---------- */
    gainXp: function (n) {
      const p = G.player;
      if (!p) return;
      const v = n * p.xpMul * ((G.mod && G.mod.xpMul) || 1);
      G.xp += v;
      if (n >= 6) AE.FX.text(p.x, p.y - 34, '+' + Math.round(v) + ' XP', '#9fd8ff', 13);
    },

    /* ---------- 事件 ---------- */
    announce: function (text, color, dur) {
      G.anns.push({ text: text, color: color || '#ffffff', life: dur || 2, max: dur || 2 });
      while (G.anns.length > 3) G.anns.shift();
    },

    updateAnns: function (dt) {
      for (let i = G.anns.length - 1; i >= 0; i--) {
        G.anns[i].life -= dt;
        if (G.anns[i].life <= 0) G.anns.splice(i, 1);
      }
    },

    delay: function (t, fn) {
      G.timers.push({ t: t, fn: fn });
    },

    updateTimers: function (dt) {
      for (let i = G.timers.length - 1; i >= 0; i--) {
        const tm = G.timers[i];
        tm.t -= dt;
        if (tm.t <= 0) {
          G.timers.splice(i, 1);
          try { tm.fn(); } catch (e) { /* 隔离回调异常 */ }
        }
      }
    },

    onBossKilled: function (boss) {
      const def = boss.def;
      G.boss = null;
      if (def.id === 'abyss') G.abyssKilled = true;
      G.slowT = 0.85;
      G.echoBonus += def.echo || 20;
      AE.Player.heal(G.player, G.player.maxHp * 0.25);
      this.checkAchievements(false);
      if (G.rush) {
        AE.Player.heal(G.player, G.player.maxHp * 0.3);
        const self = this;
        if (G.rushIndex >= AE.Data.RUSH_ORDER.length) {
          G.winning = true;
          G.player.invuln = 6;
          this.announce('六连战 · 全破', '#ffd479', 3);
          this.delay(1.4, function () { self.endRun(true); });
        } else {
          G.pending += 3;
          const hasRelic = AE.Relics.roll(G.player, 1).length > 0;
          G.relicLock = hasRelic;
          this.announce('击破 ' + def.name + ' · 遗物 + 强化 ×3', '#ffd479', 2.4);
          this.delay(0.9, function () {
            if (G.state !== 'playing') { G.relicLock = false; return; }
            if (hasRelic) self.openRelicDraft();
            else self.openLevelUp(true);
          });
        }
        return;
      }
      if (def.id === 'final' && !G.loop) {
        G.winning = true;
        G.player.invuln = 6;
        this.announce('终焉回响 · 已消散', '#ffd479', 3);
        const self = this;
        this.delay(1.6, function () { self.endRun(true); });
      } else {
        const self = this;
        const hasRelic = AE.Relics.roll(G.player, 1).length > 0;
        G.relicLock = hasRelic;
        this.delay(1.0, function () {
          G.pending++;
          if (G.state !== 'playing') { G.relicLock = false; return; }
          if (hasRelic) self.openRelicDraft();
          else self.openLevelUp(true);
        });
        this.announce('击破 ' + def.name + ' · 遗物三选一', '#ffd479', 2.4);
      }
    },

    playerDown: function () {
      const p = G.player;
      if (p.revives > 0) {
        p.revives--;
        p.hp = Math.round(p.maxHp * 0.62);
        p.alive = true;
        p.invuln = 2.4;
        AE.FX.flash(0.4, '#8affc1');
        AE.FX.ring(p.x, p.y, '#8affc1', 10, 330, 1.1, 6);
        AE.FX.spark(p.x, p.y, '#8affc1', 50, { spd: 500, life: 1.1, size: 4 });
        AE.FX.shake(0.8);
        AE.Audio.sfx('revive');
        const list = AE.Enemies.list;
        for (let i = 0; i < list.length; i++) {
          const e = list[i];
          if (U.d2(p.x, p.y, e.x, e.y) < 330 * 330) AE.Enemies.damage(e, 400, { crit: false });
        }
        this.announce('回响之种 · 复苏', '#8affc1', 2.2);
        return;
      }
      this.endRun(false);
    },

    endRun: function (victory) {
      if (G.state === 'gameover' || G.state === 'victory') return;
      const p = G.player;
      const S = AE.Save.data;
      const base = G.kills * 0.35 + G.level * 3 + G.bossKills * 25 + G.time / 6;
      const echoes = Math.max(0, Math.floor((base + G.echoBonus) * p.echoMul *
        ((G.mod && G.mod.echoMul) || 1) * (G.pactMult || 1)));
      S.echoes += echoes;
      S.totalEchoes += echoes;
      S.runs = (S.runs || 0) + 1;
      const st = S.stats || (S.stats = { kills: 0, time: 0, damage: 0, bosses: 0, wins: 0, evolves: 0, runs: 0 });
      st.kills = (st.kills || 0) + G.kills;
      st.time = (st.time || 0) + G.time;
      st.damage = (st.damage || 0) + G.stats.damage;
      st.bosses = (st.bosses || 0) + G.bossKills;
      st.runs = (st.runs || 0) + 1;
      if (victory) st.wins = (st.wins || 0) + 1;
      S.bestRuns = (S.bestRuns || []);
      S.bestRuns.push({
        time: Math.round(G.time), kills: G.kills, level: G.level,
        victory: !!victory, char: p.char.id, echo: echoes,
        date: new Date().toISOString().slice(0, 10)
      });
      S.bestRuns.sort(function (a, b) { return b.time - a.time; });
      S.bestRuns = S.bestRuns.slice(0, 8);
      const best = S.best || (S.best = { time: 0, kills: 0, level: 0 });
      let newBest = false;
      if (G.time > (best.time || 0)) { best.time = G.time; newBest = true; }
      if (G.kills > (best.kills || 0)) best.kills = G.kills;
      if (G.level > (best.level || 0)) best.level = G.level;
      S.seen = true;
      let dailyNew = false;
      let dailyBest = null;
      if (G.daily) {
        S.dailyBest = S.dailyBest || {};
        const rec = {
          time: Math.round(G.time), kills: G.kills, level: G.level,
          char: p.char.id, echoes: echoes
        };
        const prev = S.dailyBest[G.daily.key];
        if (!prev || rec.time > prev.time) {
          S.dailyBest[G.daily.key] = rec;
          dailyNew = true;
        }
        dailyBest = S.dailyBest[G.daily.key];
        const keys = Object.keys(S.dailyBest).sort();
        while (keys.length > 14) delete S.dailyBest[keys.shift()];
      }
      let rushNew = false;
      let rushBest = null;
      if (G.rush) {
        S.bestRush = S.bestRush || { time: 0, char: '', date: '' };
        if (victory && (!S.bestRush.time || G.time < S.bestRush.time)) {
          S.bestRush = { time: Math.round(G.time), char: p.char.id, date: AE.dateKey() };
          rushNew = true;
        }
        rushBest = S.bestRush;
      }
      let pactNew = false;
      let pactBest = null;
      if (victory && G.pacts && G.pacts.length) G.pactWinTier = G.pacts.length;
      if (victory && G.pacts && G.pacts.length) {
        S.bestPact = S.bestPact || { tier: 0, time: 0, char: '', date: '' };
        const tier = G.pacts.length;
        if (tier > (S.bestPact.tier || 0) ||
            (tier === (S.bestPact.tier || 0) && (!S.bestPact.time || G.time < S.bestPact.time))) {
          S.bestPact = { tier: tier, time: Math.round(G.time), char: p.char.id, date: AE.dateKey() };
          pactNew = true;
        }
        pactBest = S.bestPact;
      }
      AE.Save.save();
      this.checkAchievements(true);
      G.result = {
        victory: !!victory,
        time: G.time, kills: G.kills, level: G.level,
        damage: Math.floor(G.stats.damage),
        echoes: echoes, bossKills: G.bossKills,
        char: p.char, loop: G.loop, newBest: newBest,
        daily: G.daily ? G.daily.key : null,
        dailyNew: dailyNew,
        dailyBest: dailyBest,
        anomalies: G.daily ? G.daily.anomalies.map(function (a) { return a.name; }) : [],
        rush: !!G.rush, rushNew: rushNew, rushBest: rushBest,
        pacts: (G.pacts || []).map(function (id) {
          const d = AE.Data.PACT_MAP[id];
          return d ? d.name : id;
        }),
        pactMult: G.pactMult || 1, pactNew: pactNew, pactBest: pactBest
      };
      G.state = victory ? 'victory' : 'gameover';
      AE.RNG.restore();
      AE.Audio.setIntensity(0.12);
      AE.Audio.sfx(victory ? 'victory' : 'roar');
      if (!victory) { AE.FX.flash(0.35, '#ff3355'); AE.FX.shake(0.7); }
      AE.UI.showResult(G.result);
      AE.Player.setAim(p, p.x + 100, p.y);
    },

    /* ---------- 渲染 ---------- */
    render: function () {
      const ctx = this.ctx;
      if (!ctx) return;
      const W = this.W, H = this.H;
      ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
      AE.FX.drawBackground(ctx, AE.Cam, W, H);

      if (G.state === 'menu') {
        AE.FX.drawScreen(ctx, AE.Cam, W, H);
        return;
      }

      ctx.save();
      AE.Cam.apply(ctx);
      AE.FX.drawWorldDecor(ctx, AE.Cam);
      AE.FX.drawRings(ctx);
      AE.Enemies.draw(ctx, G.time);
      AE.World.draw(ctx, G.time);
      if (G.player) {
        AE.Weapons.draw(ctx, G.player);
        AE.Player.draw(ctx, G.player);
      }
      AE.FX.drawWorld(ctx);
      ctx.restore();

      AE.FX.drawScreen(ctx, AE.Cam, W, H);
      if (G.state !== 'gameover' && G.state !== 'victory' && (!AE.UI || !AE.UI.mode)) this.drawHUD(ctx, W, H);
    },

    /* ---------- HUD ---------- */
    roundRect: function (ctx, x, y, w, h, r) {
      r = Math.min(r, w / 2, h / 2);
      ctx.beginPath();
      ctx.moveTo(x + r, y);
      ctx.arcTo(x + w, y, x + w, y + h, r);
      ctx.arcTo(x + w, y + h, x, y + h, r);
      ctx.arcTo(x, y + h, x, y, r);
      ctx.arcTo(x, y, x + w, y, r);
      ctx.closePath();
    },

    bar: function (ctx, x, y, w, h, pct, color, back) {
      this.roundRect(ctx, x, y, w, h, h / 2);
      ctx.fillStyle = back || 'rgba(8,12,24,0.75)';
      ctx.fill();
      if (pct > 0) {
        this.roundRect(ctx, x, y, Math.max(h, w * U.clamp(pct, 0, 1)), h, h / 2);
        ctx.fillStyle = color;
        ctx.fill();
      }
    },

    drawHUD: function (ctx, W, H) {
      const p = G.player;
      if (!p) return;
      const D = AE.Data;
      ctx.save();
      ctx.textBaseline = 'middle';
      const head = '"Segoe UI", "Microsoft YaHei", system-ui, sans-serif';

      const xpPct = U.clamp(G.xp / G.xpNeed, 0, 1);
      ctx.fillStyle = 'rgba(8,12,26,0.6)';
      ctx.fillRect(0, 0, W, 3);
      const gx = ctx.createLinearGradient(0, 0, W, 0);
      gx.addColorStop(0, '#4fd8ff');
      gx.addColorStop(0.6, '#7df9ff');
      gx.addColorStop(1, '#b388ff');
      ctx.fillStyle = gx;
      ctx.fillRect(0, 0, W * xpPct, 3);

      ctx.save();
      ctx.translate(34, 36);
      ctx.beginPath(); ctx.arc(0, 0, 20, 0, U.TAU);
      ctx.fillStyle = 'rgba(9,14,30,0.82)';
      ctx.fill();
      ctx.strokeStyle = 'rgba(125,249,255,0.55)';
      ctx.lineWidth = 1.6;
      ctx.stroke();
      ctx.textAlign = 'center';
      ctx.fillStyle = '#e8f6ff';
      ctx.font = '800 19px ' + head;
      ctx.fillText(String(G.level), 0, 1);
      ctx.font = '600 8px ' + head;
      ctx.fillStyle = 'rgba(160,210,255,0.75)';
      ctx.fillText('LV', 0, 13);
      ctx.restore();

      ctx.textAlign = 'left';
      ctx.font = '600 10px ' + head;
      ctx.fillStyle = 'rgba(150,190,235,0.65)';
      ctx.fillText(Math.floor(G.xp) + ' / ' + G.xpNeed, 62, 52);

      // 星核能量条
      const uw = 118, ux = 62, uy = 63;
      ctx.fillStyle = 'rgba(8,12,26,0.72)';
      ctx.fillRect(ux, uy, uw, 5);
      const upct = U.clamp(p.ult / p.ultMax, 0, 1);
      ctx.fillStyle = upct >= 1 ? (Math.sin(G.t * 8) > 0 ? '#ffd479' : '#7df9ff') : 'rgba(125,249,255,0.78)';
      ctx.fillRect(ux, uy, uw * upct, 5);
      ctx.strokeStyle = upct >= 1 ? 'rgba(255,212,121,0.85)' : 'rgba(125,249,255,0.28)';
      ctx.lineWidth = 1;
      ctx.strokeRect(ux + 0.5, uy + 0.5, uw - 1, 4);
      ctx.font = '600 8px ' + head;
      ctx.fillStyle = upct >= 1 ? '#ffd479' : 'rgba(150,190,235,0.55)';
      ctx.fillText(upct >= 1 ? '星核就绪 · E' : '星核', ux + uw + 8, uy + 2);

      ctx.textAlign = 'center';
      ctx.font = '800 26px ' + head;
      ctx.fillStyle = 'rgba(232,242,255,0.95)';
      ctx.fillText(U.fmtTime(G.time), W / 2, 34);
      ctx.font = '600 10px ' + head;
      ctx.fillStyle = 'rgba(140,180,225,0.6)';
      let stage = '第 1 层';
      if (G.time >= 600) stage = '终焉之间';
      else if (G.time >= 450) stage = '第 4 层';
      else if (G.time >= 300) stage = '第 3 层';
      else if (G.time >= 150) stage = '第 2 层';
      if (G.rush) {
        ctx.fillText('首领连战 · ' + Math.min(G.rushIndex, AE.Data.RUSH_ORDER.length) + ' / ' +
          AE.Data.RUSH_ORDER.length + ' · 用时 ' + U.fmtTime(G.time), W / 2, 56);
      } else if (!G.boss) {
        ctx.fillText(stage + (G.loop ? ' · 无尽 ' + (G.loop + 1) : '') + ' · 击杀 ' + G.kills, W / 2, 56);
      }
      if (G.event) {
        ctx.textAlign = 'center';
        ctx.font = '700 11px ' + head;
        ctx.fillStyle = G.event.color;
        ctx.globalAlpha = 0.85 + Math.sin(G.t * 5) * 0.15;
        ctx.fillText('★ ' + G.event.name + ' · ' + Math.max(0, G.eventLeft).toFixed(1) + 's', W / 2, 74);
        ctx.globalAlpha = 1;
      }

      if (G.combo > 1 && G.comboT > 0) {
        const k = Math.min(1, G.comboT / 0.6);
        ctx.globalAlpha = k;
        ctx.textAlign = 'left';
        ctx.font = '800 20px ' + head;
        ctx.fillStyle = G.combo > 30 ? '#ffd479' : '#7df9ff';
        ctx.fillText('×' + G.combo, 28, 82);
        ctx.font = '600 10px ' + head;
        ctx.fillStyle = 'rgba(160,200,240,0.6)';
        ctx.fillText('连杀', 28, 96);
        ctx.globalAlpha = 1;
      }

      if (G.daily) {
        ctx.textAlign = 'left';
        ctx.font = '600 10px ' + head;
        ctx.fillStyle = 'rgba(255,212,121,0.72)';
        ctx.fillText('每日 · ' + G.daily.anomalies.map(function (a) { return a.name; }).join(' / '), 28, 112);
      }
      if (p.killStack) {
        ctx.textAlign = 'left';
        ctx.font = '600 10px ' + head;
        ctx.fillStyle = 'rgba(255,127,176,0.82)';
        ctx.fillText('吞噬 +' + (p.stackBonus * 100).toFixed(1) + '% · ' + p.killStacks, 28, G.daily ? 128 : 112);
      }
      if (G.pacts && G.pacts.length) {
        ctx.textAlign = 'left';
        ctx.font = '600 10px ' + head;
        ctx.fillStyle = 'rgba(179,136,255,0.9)';
        ctx.fillText('深渊契约 ×' + G.pacts.length + ' · 回响 ×' + (G.pactMult || 1).toFixed(2),
          28, 112 + (G.daily ? 16 : 0) + (p.killStack ? 16 : 0));
      }

      const wx = W - 34, wy = H / 2 - p.weapons.length * 26 + 16;
      for (let i = 0; i < p.weapons.length; i++) {
        const w = p.weapons[i];
        const def = D.WEAPON_MAP[w.id];
        const y = wy + i * 52;
        ctx.save();
        this.roundRect(ctx, wx - 20, y - 20, 40, 40, 10);
        ctx.fillStyle = 'rgba(11,18,36,0.86)';
        ctx.fill();
        ctx.strokeStyle = w.evolved ? '#ffd479' : AE.FX.alpha(def.color, 0.62);
        ctx.lineWidth = w.evolved ? 1.8 : 1.3;
        ctx.stroke();
        ctx.textAlign = 'center';
        ctx.font = '700 19px ' + head;
        ctx.fillStyle = w.evolved ? '#ffe9a8' : def.color;
        ctx.fillText(w.evolved ? (def.evolved.icon || def.icon) : def.icon, wx, y + 1);
        for (let k = 0; k < 8; k++) {
          ctx.beginPath();
          ctx.arc(wx - 14 + k * 4, y + 16, 1.3, 0, U.TAU);
          ctx.fillStyle = k < w.level ? (w.evolved ? '#ffd479' : def.color) : 'rgba(255,255,255,0.15)';
          ctx.fill();
        }
        ctx.restore();
      }

      const hp = Math.max(0, p.hp), mx = p.maxHp;
      const hx = 28, hy = H - 54;
      ctx.textAlign = 'left';
      ctx.font = '700 13px ' + head;
      ctx.fillStyle = 'rgba(232,242,255,0.9)';
      ctx.fillText(Math.ceil(hp) + ' / ' + Math.round(mx), hx, hy - 10);
      this.bar(ctx, hx, hy, 250, 14, hp / mx, hp / mx < 0.3 ? '#ff5c7a' : '#ff7fa0');
      ctx.strokeStyle = 'rgba(255,255,255,0.12)';
      ctx.lineWidth = 1;
      this.roundRect(ctx, hx, hy, 250, 14, 7);
      ctx.stroke();
      ctx.font = '600 9px ' + head;
      ctx.fillStyle = 'rgba(170,200,235,0.55)';
      let extra = '';
      if (p.armor) extra += '护甲 ' + p.armor + '  ';
      if (p.regen) extra += '回复 ' + p.regen.toFixed(1) + '/s  ';
      if (p.revives) extra += '复活 ' + p.revives;
      if (extra) ctx.fillText(extra, hx, hy + 24);

      const dx = 292, dy = H - 47;
      const cdMax = AE.Data.CONST.DASH_CD * p.dashCdMul;
      const cdPct = 1 - U.clamp(p.dashCd / cdMax, 0, 1);
      ctx.beginPath();
      ctx.arc(dx, dy, 13, 0, U.TAU);
      ctx.fillStyle = 'rgba(9,14,30,0.75)';
      ctx.fill();
      ctx.beginPath();
      ctx.arc(dx, dy, 13, -Math.PI / 2, -Math.PI / 2 + U.TAU * cdPct);
      ctx.strokeStyle = cdPct >= 1 ? '#7df9ff' : 'rgba(125,249,255,0.35)';
      ctx.lineWidth = 2.4;
      ctx.stroke();
      ctx.textAlign = 'center';
      ctx.font = '700 9px ' + head;
      ctx.fillStyle = cdPct >= 1 ? '#d8fbff' : 'rgba(190,220,245,0.45)';
      ctx.fillText('闪', dx, dy + 1);

      if (G.boss && G.boss.alive) {
        const b = G.boss;
        const bw = Math.min(520, W * 0.52);
        const bx = W / 2 - bw / 2, by = 88;
        ctx.textAlign = 'center';
        ctx.font = '800 15px ' + head;
        ctx.fillStyle = 'rgba(255,240,245,0.95)';
        ctx.fillText(b.bossName, W / 2, by - 9);
        ctx.font = '600 8px ' + head;
        ctx.fillStyle = 'rgba(220,170,190,0.55)';
        ctx.fillText(b.bossTitle, W / 2, by + 18);
        this.bar(ctx, bx, by, bw, 10, b.hp / b.maxHp, '#ff5c7a', 'rgba(20,6,12,0.8)');
        ctx.strokeStyle = 'rgba(255,180,200,0.35)';
        ctx.lineWidth = 1;
        this.roundRect(ctx, bx, by, bw, 10, 5);
        ctx.stroke();
        ctx.strokeStyle = 'rgba(0,0,0,0.35)';
        for (let i = 1; i < 5; i++) {
          const sx = bx + bw * i / 5;
          ctx.beginPath(); ctx.moveTo(sx, by); ctx.lineTo(sx, by + 10); ctx.stroke();
        }
      }

      if (G.bossWarnT > 0) {
        const k = 0.55 + 0.45 * Math.sin(G.t * 12);
        ctx.globalAlpha = Math.min(1, G.bossWarnT) * k;
        ctx.textAlign = 'center';
        ctx.font = '800 22px ' + head;
        ctx.fillStyle = '#ff6b8a';
        ctx.fillText('⚠ 强敌接近', W / 2, H * 0.3);
        ctx.globalAlpha = 1;
      }

      this.drawAnns(ctx, W, head);

      if (G.boss && G.boss.alive) {
        const s = AE.Cam.toScreen(G.boss.x, G.boss.y);
        const pad = 44;
        if (s.x < pad || s.x > W - pad || s.y < pad || s.y > H - pad) {
          const cx = W / 2, cy = H / 2;
          const a = Math.atan2(s.y - cy, s.x - cx);
          const ex = U.clamp(cx + Math.cos(a) * (W / 2 - 60), 50, W - 50);
          const ey = U.clamp(cy + Math.sin(a) * (H / 2 - 60), 50, H - 50);
          ctx.save();
          ctx.translate(ex, ey);
          ctx.rotate(a);
          ctx.fillStyle = 'rgba(255,92,122,0.9)';
          ctx.beginPath();
          ctx.moveTo(14, 0); ctx.lineTo(-8, -8); ctx.lineTo(-4, 0); ctx.lineTo(-8, 8);
          ctx.closePath(); ctx.fill();
          ctx.restore();
        }
      }

      if (!AE.Save.data.seen && G.time < 12) {
        const touchUI = AE.Input.touch.on || (AE.UI && AE.UI._touch);
        ctx.globalAlpha = U.clamp((12 - G.time) / 2, 0, 1);
        ctx.textAlign = 'center';
        ctx.font = '600 13px ' + head;
        ctx.fillStyle = 'rgba(190,225,255,0.85)';
        ctx.fillText(touchUI
          ? '左半屏拖动移动 · 右下角「闪」闪避 · 右上角暂停'
          : 'WASD 移动 · 武器自动攻击 · 空格 / Shift 闪避 · ESC 暂停', W / 2, H - 26);
        ctx.globalAlpha = 1;
      }

      if (AE.Input.touch.on && AE.Input.joy.active) {
        const jx = AE.Input.touch.ox, jy = AE.Input.touch.oy;
        ctx.globalAlpha = 0.35;
        ctx.strokeStyle = '#7df9ff';
        ctx.lineWidth = 2;
        ctx.beginPath(); ctx.arc(jx, jy, 56, 0, U.TAU); ctx.stroke();
        ctx.globalAlpha = 0.55;
        ctx.fillStyle = 'rgba(125,249,255,0.5)';
        ctx.beginPath();
        ctx.arc(jx + AE.Input.joy.dx * 56, jy + AE.Input.joy.dy * 56, 22, 0, U.TAU);
        ctx.fill();
        ctx.globalAlpha = 1;
      }

      ctx.restore();
    },

    drawAnns: function (ctx, W, head) {
      const anns = G.anns;
      for (let i = 0; i < anns.length; i++) {
        const a = anns[i];
        const y = 126 + i * 34;
        const k = Math.min(1, a.life / 0.5) * Math.min(1, (a.max - a.life) / 0.18);
        ctx.save();
        ctx.globalAlpha = k;
        ctx.textAlign = 'center';
        ctx.font = '800 19px ' + head;
        ctx.shadowColor = a.color;
        ctx.shadowBlur = 16;
        ctx.fillStyle = a.color;
        ctx.fillText(a.text, W / 2, y);
        ctx.restore();
      }
    }
  };

  /* ============================================================
   * 升级池
   * ============================================================ */
  const Upgrades = {
    roll: function (n) {
      const D = AE.Data, p = G.player;
      const pool = [];
      const ownedW = {};
      for (let i = 0; i < p.weapons.length; i++) ownedW[p.weapons[i].id] = p.weapons[i];
      D.WEAPONS.forEach(function (def) {
        const w = ownedW[def.id];
        if (!w) {
          if (p.weapons.length < D.CONST.WEAPON_SLOTS) {
            pool.push({ kind: 'weapon', id: def.id, level: 1, weight: 2.3 });
          }
        } else if (w.level < 8) {
          pool.push({ kind: 'weapon', id: def.id, level: w.level + 1, weight: 3.4 });
        }
      });
      D.PASSIVES.forEach(function (def) {
        const lv = p.passives[def.id] || 0;
        if (lv >= 5) return;
        if (lv > 0) pool.push({ kind: 'passive', id: def.id, level: lv + 1, weight: 2.9 });
        else if (p.passiveCount < D.CONST.PASSIVE_SLOTS) {
          pool.push({ kind: 'passive', id: def.id, level: 1, weight: 2.0 });
        }
      });
      if (p.weapons.length < 2) {
        for (let i = 0; i < pool.length; i++) if (pool[i].kind === 'weapon') pool[i].weight += 2;
      }
      const choices = [];
      const used = {};
      let guard = 0;
      while (choices.length < n && guard < 80) {
        guard++;
        let total = 0;
        for (let i = 0; i < pool.length; i++) {
          const c = pool[i];
          if (used[c.kind + c.id]) continue;
          total += c.weight;
        }
        if (total <= 0) break;
        let r = Math.random() * total;
        let picked = null;
        for (let i = 0; i < pool.length; i++) {
          const c = pool[i];
          if (used[c.kind + c.id]) continue;
          r -= c.weight;
          if (r <= 0) { picked = c; break; }
        }
        if (!picked) picked = pool[0];
        used[picked.kind + picked.id] = true;
        choices.push({ kind: picked.kind, id: picked.id, level: picked.level });
      }
      while (choices.length < n) {
        choices.push(Math.random() < 0.6
          ? { kind: 'heal', id: 'heal', level: 1 }
          : { kind: 'echo', id: 'echo', level: 1 });
      }
      return choices;
    },

    describe: function (c) {
      const D = AE.Data;
      if (c.kind === 'weapon') {
        const def = D.WEAPON_MAP[c.id];
        const evolve = c.level >= 8;
        return {
          kind: 'weapon', tag: evolve ? '进化' : ('LV ' + c.level + ' / 8'),
          name: evolve ? def.evolved.name : def.name,
          icon: evolve ? (def.evolved.icon || def.icon) : def.icon,
          color: evolve ? '#ffd479' : def.color,
          desc: evolve ? def.evolved.note : def.intro,
          stats: evolve
            ? ('伤害 ' + def.evolved.dmg + (def.evolved.cd ? ' · 间隔 ' + def.evolved.cd + 's' : ' · 环绕'))
            : D.weaponDetail({ id: c.id, evolved: false }, c.level),
          evolved: evolve,
          level: c.level
        };
      }
      if (c.kind === 'passive') {
        const def = D.PASSIVE_MAP[c.id];
        return {
          kind: 'passive', tag: 'LV ' + c.level + ' / 5', name: def.name,
          icon: def.icon, color: def.color, desc: def.desc(c.level),
          stats: '被动 · 等级 ' + c.level + ' / 5', level: c.level
        };
      }
      if (c.kind === 'heal') {
        return {
          kind: 'heal', tag: '补给', name: '回响治疗', icon: '✚', color: '#8affc1',
          desc: '立即回复 35% 最大生命', stats: '生命 +', level: 1
        };
      }
      return {
        kind: 'echo', tag: '资源', name: '回响结晶', icon: '◈', color: '#7df9ff',
        desc: '本局结束时额外获得 40 回响', stats: '回响 +40', level: 1
      };
    },

    apply: function (p, c) {
      if (c.kind === 'weapon') {
        const D = AE.Data;
        const def = D.WEAPON_MAP[c.id];
        const before = p.weapons.length;
        const w = AE.Player.addWeapon(p, c.id, c.level);
        if (w) {
          if (c.level >= 8) AE.FX.flash(0.25, def.color);
          const info = Upgrades.describe(c);
          this.announce(info.name + (c.level >= 8 ? ' · 进化完成' : ''), info.color, 1.8);
          if (before !== p.weapons.length) this.announce('获得武器 · ' + def.name, def.color, 1.6);
        }
        AE.FX.ring(p.x, p.y, def.color, 8, 90, 0.45, 2.5);
        AE.Audio.sfx('ui');
      } else if (c.kind === 'passive') {
        const def = AE.Data.PASSIVE_MAP[c.id];
        const lv = AE.Player.addPassive(p, c.id);
        AE.FX.ring(p.x, p.y, def.color, 8, 80, 0.45, 2);
        AE.FX.spark(p.x, p.y, def.color, 14, { spd: 180, life: 0.5, size: 2.6 });
        this.announce(def.name + ' Lv' + lv, def.color, 1.4);
        AE.Audio.sfx('ui');
      } else if (c.kind === 'heal') {
        AE.Player.heal(p, p.maxHp * 0.35);
        AE.FX.ring(p.x, p.y, '#8affc1', 6, 0, 0.5, 3);
        AE.Audio.sfx('pickup', { pitch: 0.7 });
      } else if (c.kind === 'echo') {
        G.echoBonus += 40;
        AE.FX.spark(p.x, p.y, '#7df9ff', 16, { spd: 200, life: 0.6, size: 3 });
        AE.Audio.sfx('pickup', { pitch: 1.1 });
      }
    },

    announce: function (text, color, dur) {
      Game.announce(text, color, dur);
    }
  };
  AE.Upgrades = Upgrades;

  /* ============================================================
   * 遗物
   * ============================================================ */
  const Relics = {
    def: function (id) {
      return AE.Data.RELICS.filter(function (r) { return r.id === id; })[0] || null;
    },
    owned: function (p, id) { return p && p.relics && p.relics.indexOf(id) >= 0; },
    roll: function (p, n) {
      if (!p) return [];
      const pool = AE.Data.RELICS.filter(function (r) { return p.relics.indexOf(r.id) < 0; });
      AE.U.shuffle(pool);
      return pool.slice(0, n).map(function (r) { return { kind: 'relic', id: r.id }; });
    },
    apply: function (p, id) {
      const def = this.def(id);
      if (!def || !p || p.relics.indexOf(id) >= 0) return false;
      p.relics.push(id);
      if (def.apply) def.apply(p);
      AE.FX.ring(p.x, p.y, def.color, 8, 120, 0.55, 3);
      AE.FX.spark(p.x, p.y, def.color, 20, { spd: 240, life: 0.6, size: 3 });
      AE.Audio.sfx('evolve');
      Game.announce('遗物 · ' + def.name, def.color, 2.0);
      return true;
    },
    describe: function (id) {
      const def = this.def(id);
      if (!def) return { name: id, desc: '', icon: '?', color: '#fff' };
      return def;
    }
  };
  AE.Relics = Relics;
  AE.Game = Game;

  AE.Cam.followMenu = function (dt) {
    this.t += dt;
    const C = AE.Data.CONST;
    const tx = C.WORLD_W / 2 + Math.sin(this.t * 0.06) * 220;
    const ty = C.WORLD_H / 2 + Math.cos(this.t * 0.045) * 150;
    this.x += (tx - this.x) * Math.min(1, dt * 0.5);
    this.y += (ty - this.y) * Math.min(1, dt * 0.5);
    this.zoom = this.baseZoom;
  };
})(typeof window !== 'undefined' ? window : globalThis);
