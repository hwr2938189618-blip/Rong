/* ============================================================
 * ui.js — 主菜单 / 选卡 / 暂停 / 结算 / 强化（DOM 覆盖层）
 * ============================================================ */
(function (g) {
  'use strict';
  const AE = (g.AE = g.AE || {});
  const U = AE.U;
  const D = AE.Data;

  const UI = {
    el: null,
    toastEl: null,
    dashEl: null,
    pauseEl: null,
    mode: null,
    prev: 'menu',
    enabled: false,
    _toastTimer: null,
    _touch: false,

    init: function () {
      this.el = document.getElementById('overlay');
      this.toastEl = document.getElementById('toast');
      this.dashEl = document.getElementById('touch-dash');
      this.ultEl = document.getElementById('touch-ult');
      this.pauseEl = document.getElementById('touch-pause');
      if (!this.el) return;
      this.enabled = true;
      const forceTouch = typeof location !== 'undefined' && /(?:^|[?&])touch=1/.test(location.search);
      this._touch = forceTouch || (typeof g.matchMedia === 'function' && g.matchMedia('(pointer: coarse)').matches);
      const self = this;
      if (this.pauseEl) {
        this.pauseEl.addEventListener('pointerdown', function (e) {
          e.preventDefault();
          if (AE.G && AE.G.state === 'playing') AE.Game.pause();
        });
      }
      this.el.addEventListener('click', function (e) {
        const btn = e.target.closest ? e.target.closest('[data-act]') : null;
        if (!btn || btn.disabled) return;
        AE.Audio.init();
        self.action(btn.getAttribute('data-act'), btn.getAttribute('data-id'), btn.getAttribute('data-i'));
      });
      this.el.addEventListener('pointerover', function (e) {
        const btn = e.target.closest ? e.target.closest('button') : null;
        if (btn && !btn.disabled) AE.Audio.sfx('hover');
      });
      this.el.addEventListener('input', function (e) {
        const el = e.target;
        if (!el || !el.getAttribute) return;
        const key = el.getAttribute('data-set');
        if (!key) return;
        const v = Math.max(0, Math.min(1, parseFloat(el.value) / 100));
        const st = AE.Save.data.settings;
        if (key === 'music') { st.music = v; AE.Audio.setMusicVolume(v); }
        else if (key === 'sfx') { st.sfx = v; AE.Audio.setSfxVolume(v); }
        else if (key === 'shake') { st.shake = v; AE.FX.shakeMul = v; }
        AE.Save.save();
        const out = el.parentNode ? el.parentNode.querySelector('.range-val') : null;
        if (out) out.textContent = Math.round(v * 100) + '%';
      });
      if (this.dashEl) {
        this.dashEl.addEventListener('pointerdown', function (e) {
          e.preventDefault();
          AE.Input.dashPressed = true;
        });
      }
      if (this.ultEl) {
        this.ultEl.addEventListener('pointerdown', function (e) {
          e.preventDefault();
          AE.Input.ultPressed = true;
        });
      }
      g.addEventListener('keydown', function (e) {
        if (!self.enabled) return;
        const k = e.key;
        if (self.mode === 'levelup') {
          if (k === '1' || k === '2' || k === '3') {
            e.preventDefault();
            AE.Game.chooseUpgrade(parseInt(k, 10) - 1);
          } else if (k === 'r' || k === 'R') {
            e.preventDefault();
            AE.Game.reroll();
          }
          return;
        }
        if (self.mode === 'menu') {
          if (k === 'Enter') { e.preventDefault(); self.action('play'); }
          else if (k === 'd' || k === 'D') { e.preventDefault(); self.action('daily'); }
          else if (k === 'b' || k === 'B') { e.preventDefault(); self.action('rush'); }
          else if (k === 'c' || k === 'C') { e.preventDefault(); self.action('pact'); }
          return;
        }
        if (self.mode === 'pact') {
          if (k === 'Escape') { e.preventDefault(); self.action('back'); }
          return;
        }
        if (self.mode === 'result') {
          if (k === 'Enter') { e.preventDefault(); self.action('restart'); }
          return;
        }
        if (self.mode === 'how' || self.mode === 'meta' || self.mode === 'settings' ||
            self.mode === 'codex' || self.mode === 'archive') {
          if (k === 'Escape') { e.preventDefault(); self.action('back'); }
        }
      });
    },

    /* ---------- 基础 ---------- */
    setHTML: function (html, scroll) {
      if (!this.enabled) return;
      this.el.className = 'overlay' + (scroll ? ' scroll' : '');
      this.el.innerHTML = html;
      if (this.mode === 'levelup') {
        const first = this.el.querySelector('.pick');
        if (first) setTimeout(function () { first.focus(); }, 30);
      }
      this.syncDash();
    },

    hideAll: function () {
      this.mode = null;
      this.clearBossIntro();
      if (!this.enabled) return;
      this.el.className = 'overlay hidden';
      this.el.innerHTML = '';
      this.syncDash();
    },

    clearBossIntro: function () {
      const el = document.getElementById('boss-intro');
      if (el) { el.classList.add('hidden'); el.classList.remove('show'); }
    },

    hideLevelUp: function () { this.hideAll(); },
    hidePause: function () { this.hideAll(); },

    syncDash: function () {
      const playing = AE.G && AE.G.state === 'playing';
      const touch = this._touch || (AE.Input && AE.Input.touch && AE.Input.touch.on);
      const show = !!(touch && playing);
      if (this.dashEl) this.dashEl.classList.toggle('hidden', !show);
      if (this.ultEl) {
        this.ultEl.classList.toggle('hidden', !show);
        const p = AE.G && AE.G.player;
        this.ultEl.classList.toggle('ready', !!(p && p.ult >= p.ultMax));
      }
      if (this.pauseEl) this.pauseEl.classList.toggle('hidden', !show);
    },

    bossIntro: function (def, dur) {
      if (!this.enabled || !def) return;
      const el = document.getElementById('boss-intro');
      if (!el) return;
      const hold = dur || 1500;
      el.innerHTML =
        '<div class="bi-kicker">WARNING · APEX ENTITY</div>' +
        '<div class="bi-name" style="--c:' + def.color + '">' + def.name + '</div>' +
        '<div class="bi-title">' + def.title + '</div>' +
        '<div class="bi-line" style="--c:' + def.color + '"></div>';
      el.classList.remove('hidden', 'out');
      void el.offsetWidth;
      el.classList.add('show');
      const self = this;
      clearTimeout(this._introT1);
      clearTimeout(this._introT2);
      this._introT1 = setTimeout(function () {
        el.classList.add('out');
        self._introT2 = setTimeout(function () {
          el.classList.add('hidden');
          el.classList.remove('show', 'out');
        }, 600);
      }, hold);
    },

    toast: function (text, color) {
      if (!this.toastEl) return;
      this.toastEl.textContent = text;
      this.toastEl.style.color = color || '';
      this.toastEl.classList.add('show');
      clearTimeout(this._toastTimer);
      const self = this;
      this._toastTimer = setTimeout(function () { self.toastEl.classList.remove('show'); }, 1800);
    },

    scrollTop: function () {
      if (this.el) this.el.scrollTop = 0;
    },

    /* ---------- 动作分发 ---------- */
    action: function (act, id, i) {
      const S = AE.Save.data;
      switch (act) {
        case 'play':
          AE.Game.startRun(S.char);
          break;
        case 'daily':
          AE.Game.startRun(S.char, true);
          break;
        case 'rush':
          AE.Game.startRun(S.char, false, true);
          break;
        case 'rushagain':
          AE.Game.startRun(S.char, false, true);
          break;
        case 'pact':
          this.pactSel = this.pactSel || [];
          this.showPact();
          break;
        case 'pact-toggle': {
          this.pactSel = this.pactSel || [];
          const pi = this.pactSel.indexOf(id);
          if (pi >= 0) this.pactSel.splice(pi, 1);
          else if (this.pactSel.length < 4) this.pactSel.push(id);
          AE.Audio.sfx('ui');
          this.showPact();
          break;
        }
        case 'pact-start':
          if (this.pactSel && this.pactSel.length) {
            AE.Game.startRun(S.char, false, false, this.pactSel.slice());
          }
          break;
        case 'meta':
          this.prev = this.mode === 'result' ? 'result' : 'menu';
          this.showMeta();
          break;
        case 'how':
          this.showHow();
          break;
        case 'codex':
          this.settingsFrom = this.mode === 'pause' ? 'pause' : 'menu';
          this.showCodex();
          break;
        case 'archive':
          this.settingsFrom = this.mode === 'pause' ? 'pause' : 'menu';
          this.showArchive();
          break;
        case 'settings':
          this.settingsFrom = this.mode === 'pause' ? 'pause' : 'menu';
          this.showSettings();
          break;
        case 'toggle': {
          const st = AE.Save.data.settings;
          st[id] = !st[id];
          AE.Save.save();
          AE.Game.applySettings();
          if (this.mode === 'settings') this.showSettings();
          break;
        }
        case 'quality':
          AE.Save.data.settings.quality = parseFloat(id) || 1;
          AE.Save.save();
          AE.Game.applySettings();
          if (this.mode === 'settings') this.showSettings();
          break;
        case 'back':
          if (this.mode === 'settings' || this.mode === 'codex' || this.mode === 'archive') {
            if (this.settingsFrom === 'pause') this.showPause(AE.Game.pausedByBlur);
            else this.showMenu();
          } else if (this.mode === 'how' || this.mode === 'pact') this.showMenu();
          else if (this.prev === 'result' && AE.G.result) this.showResult(AE.G.result);
          else this.showMenu();
          break;
        case 'char':
          if (S.chars.indexOf(id) >= 0) {
            S.char = id;
            AE.Save.save();
            AE.Audio.sfx('ui');
            this.showMenu();
            this.toast('已选择 · ' + D.CHAR_MAP[id].name, D.CHAR_MAP[id].color);
          }
          break;
        case 'unlock': {
          const c = D.CHAR_MAP[id];
          if (!c) break;
          if (S.chars.indexOf(id) >= 0) { this.action('char', id); break; }
          if (S.echoes >= c.cost) {
            S.echoes -= c.cost;
            S.chars.push(id);
            S.char = id;
            AE.Save.save();
            AE.Audio.sfx('evolve');
            this.toast('已解锁 · ' + c.name, c.color);
            this.showMenu();
          } else {
            AE.Audio.sfx('deny');
            this.toast('回响不足，还需 ' + (c.cost - S.echoes), '#ff8fa3');
          }
          break;
        }
        case 'buy': {
          const m = D.META.filter(function (x) { return x.id === id; })[0];
          if (!m) break;
          const lv = S.meta[id] || 0;
          if (lv >= m.max) break;
          const cost = m.cost(lv);
          if (S.echoes < cost) {
            AE.Audio.sfx('deny');
            this.toast('回响不足', '#ff8fa3');
            break;
          }
          S.echoes -= cost;
          S.meta[id] = lv + 1;
          AE.Save.save();
          AE.Audio.sfx('evolve');
          this.toast(m.name + ' → Lv' + (lv + 1), '#7df9ff');
          this.showMeta();
          break;
        }
        case 'pick':
          AE.Game.chooseUpgrade(parseInt(i, 10));
          break;
        case 'reroll':
          AE.Game.reroll();
          break;
        case 'resume':
          AE.Game.resume();
          break;
        case 'restart':
          AE.Game.restart();
          break;
        case 'menu':
          AE.Game.toMenu();
          break;
        case 'endless':
          AE.Game.continueEndless();
          break;
        case 'mute': {
          const m = AE.Audio.toggle();
          if (this.mode === 'pause') this.showPause(AE.Game.pausedByBlur);
          else this.showMenu();
          this.toast(m ? '已静音' : '声音开启', '#7df9ff');
          break;
        }
      }
    },

    /* ---------- 菜单 ---------- */
    charCards: function () {
      const S = AE.Save.data;
      return D.CHARS.map(function (c) {
        const unlocked = S.chars.indexOf(c.id) >= 0;
        const sel = S.char === c.id;
        return '<button class="char-card ' + (sel ? 'selected' : '') + (unlocked ? '' : ' locked') +
          '" style="--c:' + c.color + '" data-act="' + (unlocked ? 'char' : 'unlock') + '" data-id="' + c.id + '">' +
          '<span class="char-state">' + (unlocked ? (sel ? '已选择' : '选择') : ('◈ ' + c.cost)) + '</span>' +
          '<span class="char-name">' + c.name + '</span>' +
          '<span class="char-title">' + c.title + '</span>' +
          '<span class="char-perk">' + (unlocked ? c.perk : '解锁后可用 · ' + c.intro) + '</span>' +
          '</button>';
      }).join('');
    },

    showMenu: function () {
      this.mode = 'menu';
      this.clearBossIntro();
      this.prev = 'menu';
      const S = AE.Save.data;
      const muted = AE.Audio.muted;
      const best = S.best || { time: 0, kills: 0, level: 0 };
      const daily = AE.Game.dailyInfo ? AE.Game.dailyInfo() : null;
      const dailyBest = daily && S.dailyBest ? S.dailyBest[daily.key] : null;
      const dailyNote = daily
        ? '<div class="daily-note">今日扰动 · ' + daily.anomalies.map(function (a) { return a.name; }).join(' / ') +
          (daily.events && daily.events.length ? ' · 星象 ' + daily.events.map(function (id) {
            return AE.Data.EVENT_MAP[id] ? AE.Data.EVENT_MAP[id].name : id;
          }).join(' / ') : '') +
          (dailyBest ? ' · 今日最佳 ' + U.fmtTime(dailyBest.time) : '') + '</div>'
        : '';
      const html =
        '<div class="screen menu-screen">' +
        '<div class="menu-corner"><button class="icon-btn" data-act="mute" title="' + (muted ? '开启声音' : '静音') + '">' + (muted ? '静' : '声') + '</button></div>' +
        '<div class="menu-top">' +
        '<div class="brand-deco"></div>' +
        '<div class="brand-kicker"><span></span>AETHER ECHO<span></span></div>' +
        '<h1 class="brand-title">星渊回响</h1>' +
        '<p class="brand-sub">在回响中生存 · 直到终焉</p>' +
        '</div>' +
        '<div class="menu-mid">' +
        '<div class="char-row">' + this.charCards() + '</div>' +
        '<div class="menu-actions">' +
        '<button class="btn primary" data-act="play">开始回响<span class="kbd">ENTER</span></button>' +
        '<button class="btn daily" data-act="daily">每日挑战<span class="kbd">D</span></button>' +
        '<button class="btn rush" data-act="rush">首领连战<span class="kbd">B</span></button>' +
        '<button class="btn ghost" data-act="meta">回响强化</button>' +
        '<button class="btn ghost" data-act="how">玩法</button>' +
        '</div>' +
        dailyNote +
        '<div class="menu-links">' +
        '<button class="link-btn" data-act="codex">图鉴</button>' +
        '<button class="link-btn" data-act="archive">档案</button>' +
        '<button class="link-btn" data-act="pact">契约</button>' +
        '<button class="link-btn" data-act="settings">设置</button>' +
        '</div>' +
        '<div class="menu-feats">' +
        '<span>' + D.WEAPONS.length + ' 把可进化武器</span><span>' + Object.keys(D.ENEMIES).length + ' 种虚空生物</span><span>' + D.BOSSES.length + ' 场首领战</span><span>无尽轮次</span>' +
        '</div>' +
        '<div class="menu-hint">' + (this._touch
          ? '左半屏拖动移动 · 右下角「闪」闪避 · 右上角暂停'
          : 'WASD 移动 · 空格 / Shift 闪避 · 武器自动攻击') + '</div>' +
        '</div>' +
        '<div class="menu-foot">' +
        '<div>最佳存活 <b>' + U.fmtTime(best.time || 0) + '</b></div>' +
        '<div>最高击杀 <b>' + (best.kills || 0) + '</b></div>' +
        '<div>最高等级 <b>' + (best.level || 0) + '</b></div>' +
        '<div>连战最佳 <b>' + (S.bestRush && S.bestRush.time && S.bestRush.size === AE.Data.RUSH_ORDER.length ? U.fmtTime(S.bestRush.time) : '--:--') + '</b></div>' +
        '<div>契约最佳 <b>' + (S.bestPact && S.bestPact.tier ? ('×' + S.bestPact.tier + ' · ' + U.fmtTime(S.bestPact.time)) : '--') + '</b></div>' +
        '<div class="echo">◈ 回响 <b>' + S.echoes + '</b></div>' +
        '</div>' +
        '</div>';
      this.setHTML(html, this._touch || window.innerHeight < 600);
      this.scrollTop();
      AE.Audio.setIntensity(0.14);
    },

    /* ---------- 深渊契约 ---------- */
    showPact: function () {
      this.mode = 'pact';
      const sel = this.pactSel || (this.pactSel = []);
      const cards = D.PACTS.map(function (p) {
        const on = sel.indexOf(p.id) >= 0;
        return '<button class="pact-card' + (on ? ' on' : '') + '" data-act="pact-toggle" data-id="' + p.id + '" style="--c:' + p.color + '">' +
          '<span class="pact-icon">' + p.icon + '</span>' +
          '<span class="pact-name">' + p.name + '<em>回响 +' + Math.round(p.mult * 100) + '%</em></span>' +
          '<span class="pact-desc">' + p.desc + '</span>' +
          '<span class="pact-mark">' + (on ? '已签订' : '签订契约') + '</span>' +
          '</button>';
      }).join('');
      const mult = 1 + sel.reduce(function (s, id) {
        return s + (D.PACT_MAP[id] ? D.PACT_MAP[id].mult : 0);
      }, 0);
      const best = AE.Save.data.bestPact;
      const html =
        '<div class="screen pact-screen">' +
        '<div class="pact-head"><button class="icon-btn" data-act="back" aria-label="返回">←</button>' +
        '<div><h2>深渊契约</h2><div class="sub">ABYSS CONTRACT · 自选难度</div></div></div>' +
        '<p class="pact-sub">每签订一条契约，敌人更强，结算回响 +20%；最多同时签订 4 条。</p>' +
        '<div class="pact-grid">' + cards + '</div>' +
        '<div class="pact-foot"><div class="pact-mult">回响倍率 <b>×' + mult.toFixed(2) + '</b>' +
        '<small>' + sel.length + ' / 4 条</small></div>' +
        '<button class="btn primary" data-act="pact-start"' + (sel.length ? '' : ' disabled') + '>开始契约</button></div>' +
        (best && best.tier ? '<div class="pact-best">契约最佳 · ×' + best.tier + ' 条 · ' + U.fmtTime(best.time) + '</div>' : '') +
        '</div>';
      this.setHTML(html, window.innerWidth <= 720);
      this.scrollTop();
    },

    /* ---------- 升级选卡 ---------- */
    showLevelUp: function (draft) {
      if (!draft) return;
      this.mode = 'levelup';
      const isRelic = draft.kind === 'relic';
      const cards = draft.choices.map(function (c, idx) {
        let info;
        if (isRelic) {
          const r = AE.Relics.describe(c.id);
          info = {
            kind: 'relic', tag: '遗物', name: r.name, icon: r.icon, color: r.color,
            desc: r.desc, stats: '本局永久生效', level: 0
          };
        } else {
          info = AE.Upgrades.describe(c);
        }
        const maxPips = info.kind === 'weapon' ? 8 : (info.kind === 'passive' ? 5 : 0);
        let pips = '';
        if (maxPips) {
          pips = '<div class="pick-pips">';
          for (let i = 0; i < maxPips; i++) pips += '<i class="' + (i < info.level ? 'on' : '') + '"></i>';
          pips += '</div>';
        }
        return '<button class="pick ' + (info.kind === 'weapon' && info.evolved ? 'evolved' : '') +
          (info.kind === 'relic' ? ' relic' : '') + '" style="--c:' + info.color + '" data-act="pick" data-i="' + idx + '">' +
          '<div class="pick-top"><span class="pick-icon">' + info.icon + '</span><span class="pick-tag">' + info.tag + '</span></div>' +
          '<div class="pick-name">' + info.name + '</div>' +
          '<div class="pick-desc">' + info.desc + '</div>' +
          pips +
          '<div class="pick-stats">' + info.stats + '</div>' +
          '<span class="pick-key">' + (idx + 1) + '</span>' +
          '</button>';
      }).join('');
      const html =
        '<div class="screen draft-screen">' +
        '<div class="draft-head">' +
        '<div class="draft-kicker">' + (isRelic ? 'RELIC · 遗物' : 'LEVEL UP') + '</div>' +
        '<h2 class="draft-title">' + (isRelic ? '获得遗物 · 三选一' : '等级提升 <em>LV ' + draft.level + '</em>') + '</h2>' +
        '<div class="draft-sub">' + (this._touch ? '点击卡片选择' : '按 1 / 2 / 3 选择') +
        (isRelic ? ' · 本局永久生效' : (this._touch ? '' : ' · R 重掷')) + '</div>' +
        '</div>' +
        '<div class="draft-cards">' + cards + '</div>' +
        '<div class="draft-foot">' +
        (isRelic ? '' : '<button class="btn ghost small" data-act="reroll"' + (draft.rerolls <= 0 ? ' disabled' : '') + '>重掷 · ' + draft.rerolls + '</button>') +
        '</div>' +
        '</div>';
      this.setHTML(html, this._touch || window.innerWidth <= 720 || window.innerHeight < 780);
    },

    /* ---------- 暂停 ---------- */
    showPause: function (byBlur) {
      this.mode = 'pause';
      this.prev = 'pause';
      const G = AE.G;
      const muted = AE.Audio.muted;
      const relics = ((G.player && G.player.relics) || []).map(function (id) {
        return AE.Data.RELICS.filter(function (r) { return r.id === id; })[0];
      }).filter(Boolean);
      const relicRow = relics.length
        ? '<div class="relic-row">' + relics.map(function (r) {
            return '<span class="relic-chip" style="--c:' + r.color + '" title="' + r.name + '：' + r.desc + '">' + r.icon + '</span>';
          }).join('') + '</div>'
        : '';
      const resActive = ((G.player && G.player.weapons) || []).length
        ? AE.Data.RESONANCES.filter(function (r) {
            return r.weapons.every(function (id) {
              return G.player.weapons.some(function (w) { return w.id === id; });
            });
          })
        : [];
      const resRow = resActive.length
        ? '<div class="pause-daily resonance-badge">共鸣 · ' +
          resActive.map(function (r) { return r.name; }).join(' / ') + '</div>'
        : '';
      const html =
        '<div class="screen pause-screen">' +
        '<div class="panel">' +
        '<div class="panel-kicker">' + (byBlur ? 'AUTO PAUSED' : 'PAUSED') + '</div>' +
        '<h2>暂停</h2>' +
        '<div class="pause-stats">' +
        '<div><span>存活</span><b>' + U.fmtTime(G.time) + '</b></div>' +
        '<div><span>击杀</span><b>' + G.kills + '</b></div>' +
        '<div><span>等级</span><b>' + G.level + '</b></div>' +
        '</div>' +
        (G.daily ? '<div class="pause-daily">每日挑战 · ' + G.daily.key + '<br>' +
          G.daily.anomalies.map(function (a) { return a.name; }).join(' / ') +
          (G.daily.events && G.daily.events.length ? '<br>星象 · ' + G.daily.events.map(function (id) {
            return AE.Data.EVENT_MAP[id] ? AE.Data.EVENT_MAP[id].name : id;
          }).join(' / ') : '') + '</div>' : '') +
        (G.pacts && G.pacts.length ? '<div class="pause-daily pact-badge">深渊契约 · ' +
          G.pacts.map(function (id) { return AE.Data.PACT_MAP[id] ? AE.Data.PACT_MAP[id].name : id; }).join(' / ') +
          ' · 回响 ×' + (G.pactMult || 1).toFixed(2) + '</div>' : '') +
        resRow +
        relicRow +
        '<div class="btn-col">' +
        '<button class="btn primary" data-act="resume">继续' + (this._touch ? '' : '（ESC）') + '</button>' +
        '<button class="btn ghost" data-act="mute">' + (muted ? '开启声音' : '静音') + '</button>' +
        '<button class="btn ghost" data-act="restart">重新开始</button>' +
        '<button class="btn ghost danger" data-act="menu">放弃本局 · 返回主菜单</button>' +
        '</div>' +
        '<div class="hint">' + (this._touch ? '点击继续返回战斗' : '按 ESC 继续 · 结束后仍可获得回响') + '</div>' +
        '<div class="pause-links"><button class="link-btn" data-act="codex">图鉴</button>' +
        '<button class="link-btn" data-act="settings">设置</button></div>' +
        '</div>' +
        '</div>';
      this.setHTML(html, this._touch || window.innerHeight < 600);
    },

    /* ---------- 结算 ---------- */
    showResult: function (r) {
      this.mode = 'result';
      this.prev = 'result';
      const victory = r.victory;
      const title = r.rush
        ? (victory ? '六连战 · 全破' : '连战中断')
        : (victory ? '回响长存' : '回响中断');
      const kicker = r.rush
        ? (victory ? 'BOSS RUSH · CLEAR' : 'BOSS RUSH · FAILED')
        : (victory ? 'AETHER ECHO · RUN COMPLETE' : 'ECHO FADED · RUN OVER');
      const sub = r.rush
        ? '六名首领连战 · ' + r.char.name + ' · 用时 ' + U.fmtTime(r.time)
        : (victory
          ? '终焉回响已被击破 · ' + r.char.name + (r.loop ? ' · 无尽 ' + (r.loop + 1) : '')
          : '星渊吞没了这道回响 · 但记忆仍在');
      const html =
        '<div class="screen result-screen">' +
        '<div class="result-head">' +
        '<div class="result-kicker">' + kicker + '</div>' +
        '<h1 class="result-title' + (victory ? '' : ' bad') + '">' + title + '</h1>' +
        '<p class="result-sub">' + sub + '</p>' +
        '</div>' +
        '<div class="result-grid">' +
        '<div class="result-cell"><span>存活时间</span><b>' + U.fmtTime(r.time) + '</b></div>' +
        '<div class="result-cell"><span>击杀</span><b>' + r.kills + '</b></div>' +
        '<div class="result-cell"><span>等级</span><b>' + r.level + '</b></div>' +
        '<div class="result-cell"><span>总伤害</span><b>' + U.fmtNum(r.damage) + '</b></div>' +
        '<div class="result-cell"><span>击破首领</span><b>' + r.bossKills + '</b></div>' +
        '<div class="result-cell gold"><span>获得回响</span><b>◈ ' + r.echoes + '</b></div>' +
        '<div class="result-cell"><span>评级</span><b class="grade-' + (r.grade || 'C') + '">' + (r.grade || 'C') + '</b></div>' +
        '<div class="result-cell"><span>评分</span><b>' + U.fmtNum(r.score || 0) + '</b></div>' +
        '<div class="result-cell"><span>最高连杀</span><b>' + (r.maxCombo || 0) + '</b></div>' +
        '</div>' +
        '<div class="score-badge' + (r.rank === 1 ? ' top' : '') + '">' +
        (r.rank ? '本地排行 #' + r.rank + (r.rank === 1 ? ' · 登顶' : '') : '本地排行未入榜') +
        '</div>' +
        (r.newBest ? '<div class="new-best">NEW RECORD · 最久存活</div>' : '') +
        (r.daily ? '<div class="daily-badge">每日挑战 · ' + r.daily + ' · ' +
          (r.dailyNew ? '今日新纪录' : ('今日最佳 ' + U.fmtTime(r.dailyBest ? r.dailyBest.time : 0))) +
          (r.dailyBest && r.dailyBest.victory ? ' · 已通关' : '') +
          (r.anomalies && r.anomalies.length ? ' · ' + r.anomalies.join(' / ') : '') + '</div>' : '') +
        (r.rush ? '<div class="rush-badge">首领连战 · 最佳 ' +
          (r.rushBest && r.rushBest.time ? U.fmtTime(r.rushBest.time) : '--:--') +
          (r.rushNew ? ' · 新纪录' : '') + '</div>' : '') +
        (r.pacts && r.pacts.length ? '<div class="rush-badge pact-badge">深渊契约 · ' +
          r.pacts.join(' / ') + ' · 回响 ×' + (r.pactMult || 1).toFixed(2) +
          (r.pactNew ? ' · 新纪录' : '') + '</div>' : '') +
        '<div class="echo-gain">◈ ' + r.echoes + '<span>回响已入库</span></div>' +
        '<div class="result-actions">' +
        (r.rush
          ? '<button class="btn primary" data-act="rushagain">再来一次</button>'
          : (victory
            ? '<button class="btn primary" data-act="endless">继续无尽</button>'
            : '<button class="btn primary" data-act="restart">再来一局</button>')) +
        '<button class="btn ghost" data-act="meta">回响强化</button>' +
        '<button class="btn ghost" data-act="menu">主菜单</button>' +
        '</div>' +
        '</div>';
      this.setHTML(html, this._touch || window.innerHeight < 600);
    },

    /* ---------- 强化 ---------- */
    showMeta: function () {
      this.mode = 'meta';
      const S = AE.Save.data;
      const rows = D.META.map(function (m) {
        const lv = S.meta[m.id] || 0;
        const maxed = lv >= m.max;
        const cost = maxed ? 0 : m.cost(lv);
        let pips = '<div class="meta-pips">';
        for (let i = 0; i < m.max; i++) pips += '<i class="' + (i < lv ? 'on' : '') + '"></i>';
        pips += '</div>';
        return '<div class="meta-row">' +
          '<div class="m-icon">' + m.icon + '</div>' +
          '<div><div class="m-name">' + m.name + '</div>' +
          '<div class="m-desc">' + (maxed ? '已达上限' : m.desc(lv + 1)) + '</div>' + pips + '</div>' +
          '<button class="btn small m-buy" data-act="buy" data-id="' + m.id + '"' +
          ((maxed || S.echoes < cost) ? ' disabled' : '') + '>' +
          (maxed ? 'MAX' : '◈ ' + cost) + '</button>' +
          '</div>';
      }).join('');
      const html =
        '<div class="screen meta-screen">' +
        '<div class="meta-head">' +
        '<div style="display:flex;align-items:center;gap:14px">' +
        '<button class="icon-btn" data-act="back" aria-label="返回">←</button>' +
        '<div><h2>回响强化</h2><div class="sub">PERMANENT ECHO UPGRADES</div></div>' +
        '</div>' +
        '<div class="wallet">◈ <span>' + S.echoes + '</span><small>回响</small></div>' +
        '</div>' +
        '<div class="meta-cols">' +
        '<section><div class="section-label">永久强化</div><div class="meta-list">' + rows + '</div></section>' +
        '<section><div class="section-label">操作角色</div><div class="char-list">' + this.charCards() + '</div></section>' +
        '</div>' +
        '<div class="meta-note">回响在每局结束时结算，永久保留。强化对所有角色生效。</div>' +
        '</div>';
      this.setHTML(html, true);
      this.scrollTop();
    },

    /* ---------- 设置 ---------- */
    showSettings: function () {
      this.mode = 'settings';
      const st = AE.Save.data.settings;
      const slider = function (key, label, val) {
        const pct = Math.round(val * 100);
        return '<div class="set-row"><div class="set-label">' + label + '</div>' +
          '<input type="range" min="0" max="100" value="' + pct + '" data-set="' + key + '">' +
          '<span class="range-val">' + pct + '%</span></div>';
      };
      const q = st.quality || 1;
      const html =
        '<div class="screen settings-screen">' +
        '<div class="panel wide">' +
        '<div class="panel-kicker">SETTINGS</div>' +
        '<h2>设置</h2>' +
        slider('music', '音乐音量', st.music) +
        slider('sfx', '音效音量', st.sfx) +
        slider('shake', '屏幕震动', st.shake) +
        '<div class="set-row"><div class="set-label">伤害数字</div>' +
        '<button class="switch ' + (st.dmgText ? 'on' : '') + '" data-act="toggle" data-id="dmgText">' + (st.dmgText ? '开' : '关') + '</button></div>' +
        '<div class="set-row"><div class="set-label">动态效果</div>' +
        '<button class="switch ' + (st.motion !== false ? 'on' : '') + '" data-act="toggle" data-id="motion">' + (st.motion !== false ? '开' : '关') + '</button></div>' +
        '<div class="set-row"><div class="set-label">屏幕闪光</div>' +
        '<button class="switch ' + (st.flash !== false ? 'on' : '') + '" data-act="toggle" data-id="flash">' + (st.flash !== false ? '开' : '关') + '</button></div>' +
        '<div class="set-row"><div class="set-label">左手模式</div>' +
        '<button class="switch ' + (st.leftHand ? 'on' : '') + '" data-act="toggle" data-id="leftHand">' + (st.leftHand ? '开' : '关') + '</button></div>' +
        '<div class="set-row"><div class="set-label">高对比</div>' +
        '<button class="switch ' + (st.contrast ? 'on' : '') + '" data-act="toggle" data-id="contrast">' + (st.contrast ? '开' : '关') + '</button></div>' +
        '<div class="set-row"><div class="set-label">画质</div><div class="seg">' +
        [['0.6', '低'], ['1', '中'], ['1.4', '高']].map(function (p) {
          const on = Math.abs(q - parseFloat(p[0])) < 0.01;
          return '<button class="seg-btn ' + (on ? 'on' : '') + '" data-act="quality" data-id="' + p[0] + '">' + p[1] + '</button>';
        }).join('') +
        '</div></div>' +
        '<div class="btn-col"><button class="btn primary" data-act="back">返回</button></div>' +
        '<div class="hint">设置会自动保存</div>' +
        '</div></div>';
      this.setHTML(html, true);
      this.scrollTop();
    },

    /* ---------- 图鉴 ---------- */
    showCodex: function () {
      this.mode = 'codex';
      const D = AE.Data;
      const S = AE.Save.data;
      const weapons = D.WEAPONS.map(function (w) {
        const seen = (S.evolvedSeen || []).indexOf(w.id) >= 0;
        return '<div class="codex-card" style="--c:' + w.color + '">' +
          '<div class="codex-top"><span class="codex-icon">' + w.icon + '</span><span class="codex-tag">' + w.tag + '</span></div>' +
          '<div class="codex-name">' + w.name + '</div>' +
          '<div class="codex-desc">' + w.intro + '</div>' +
          '<div class="codex-evo ' + (seen ? 'seen' : 'locked') + '">进化 · ' + w.evolved.name +
          (seen ? ' · 已解锁' : ' · 未发现') + '</div>' +
          '<div class="codex-stats">Lv1 ' + D.weaponDetail({ id: w.id, evolved: false }, 1) + '<br>Lv8 ' + D.weaponDetail({ id: w.id, evolved: false }, 8) + '</div>' +
          '</div>';
      }).join('');
      const passives = D.PASSIVES.map(function (p) {
        return '<div class="codex-card" style="--c:' + p.color + '">' +
          '<div class="codex-top"><span class="codex-icon">' + p.icon + '</span><span class="codex-tag">5 级</span></div>' +
          '<div class="codex-name">' + p.name + '</div>' +
          '<div class="codex-desc">' + p.desc(1) + '</div>' +
          '<div class="codex-stats">满级 ' + p.desc(5) + '</div>' +
          '</div>';
      }).join('');
      const resonances = D.RESONANCES.map(function (r) {
        const pair = r.weapons.map(function (id) {
          return D.WEAPON_MAP[id] ? D.WEAPON_MAP[id].name : id;
        }).join(' + ');
        return '<div class="codex-card resonance-card" style="--c:' + r.color + '">' +
          '<div class="codex-top"><span class="codex-icon">✧</span><span class="codex-tag">共鸣</span></div>' +
          '<div class="codex-name">' + r.name + '</div>' +
          '<div class="codex-desc">' + pair + '</div>' +
          '<div class="codex-stats">' + r.desc + '</div>' +
          '</div>';
      }).join('');
      const enemies = Object.keys(D.ENEMIES).map(function (k) {
        const e = D.ENEMIES[k];
        return '<div class="codex-row"><b style="color:' + e.color + '">' + e.name + '</b>' +
          '<span>生命 ' + e.hp + ' · 接触伤害 ' + e.dmg + ' · 经验 ' + e.xp + '</span></div>';
      }).join('');
      const bosses = D.BOSSES.map(function (b) {
        return '<div class="codex-row"><b style="color:' + b.color + '">' + b.name + '</b>' +
          '<span>' + U.fmtTime(b.at) + ' 出现 · 生命 ' + b.hp + ' · 伤害 ' + b.dmg + ' · ' + b.title + '</span></div>';
      }).join('');
      const relics = D.RELICS.map(function (r) {
        const seen = (S.relicsSeen || []).indexOf(r.id) >= 0;
        return '<div class="codex-card relic-card ' + (seen ? 'relic-seen' : 'relic-locked') +
          '" style="--c:' + r.color + '">' +
          '<div class="codex-top"><span class="codex-icon">' + r.icon + '</span><span class="codex-tag">遗物</span></div>' +
          '<div class="codex-name">' + r.name + '</div>' +
          '<div class="codex-desc">' + r.desc + '</div>' +
          '<div class="codex-seen">' + (seen ? '已获得' : '未发现') + '</div>' +
          '</div>';
      }).join('');
      const events = D.EVENTS.map(function (e) {
        return '<div class="codex-card" style="--c:' + e.color + '">' +
          '<div class="codex-top"><span class="codex-icon">' + e.icon + '</span><span class="codex-tag">星象</span></div>' +
          '<div class="codex-name">' + e.name + '</div>' +
          '<div class="codex-desc">' + e.desc + '</div>' +
          '<div class="codex-stats">持续 ' + e.dur + ' 秒 · 结束后回复 8% 生命</div>' +
          '</div>';
      }).join('');
      const html =
        '<div class="screen codex-screen">' +
        '<div class="meta-head"><div style="display:flex;align-items:center;gap:14px">' +
        '<button class="icon-btn" data-act="back" aria-label="返回">←</button>' +
        '<div><h2>图鉴</h2><div class="sub">CODEX · 武器进化、共鸣、遗物与敌群收集</div></div>' +
        '</div></div>' +
        '<div class="section-label">武器 · ' + D.WEAPONS.length + ' 把 · 进化 ' +
        (S.evolvedSeen || []).length + ' / ' + D.WEAPONS.length + '</div>' +
        '<div class="codex-grid">' + weapons + '</div>' +
        '<div class="section-label">武器共鸣 · 同时携带两把时生效</div>' +
        '<div class="codex-grid">' + resonances + '</div>' +
        '<div class="section-label">被动 · ' + D.PASSIVES.length + '</div>' +
        '<div class="codex-grid">' + passives + '</div>' +
        '<div class="section-label">遗物 · ' + D.RELICS.length + ' 件 · 已收集 ' +
        (S.relicsSeen || []).length + ' / ' + D.RELICS.length + '</div>' +
        '<div class="codex-grid">' + relics + '</div>' +
        '<div class="section-label">星象事件 · ' + D.EVENTS.length + ' 种</div>' +
        '<div class="codex-grid">' + events + '</div>' +
        '<div class="section-label">虚空生物</div>' +
        '<div class="codex-rows">' + enemies + '</div>' +
        '<div class="section-label">首领</div>' +
        '<div class="codex-rows">' + bosses + '</div>' +
        '<div class="btn-col"><button class="btn primary" data-act="back">返回</button></div>' +
        '</div>';
      this.setHTML(html, true);
      this.scrollTop();
    },

    /* ---------- 档案 ---------- */
    showArchive: function () {
      this.mode = 'archive';
      const S = AE.Save.data;
      const st = S.stats || {};
      const got = S.achievements || [];
      const all = AE.Data.ACHIEVEMENTS;
      const achHtml = all.map(function (a) {
        const has = got.indexOf(a.id) >= 0;
        return '<div class="ach ' + (has ? 'got' : 'locked') + '" style="--c:' + a.color + '">' +
          '<span class="ach-icon">' + (has ? a.icon : '?') + '</span>' +
          '<div><div class="ach-name">' + a.name + '</div><div class="ach-desc">' + a.desc + '</div></div>' +
          '</div>';
      }).join('');
      const runs = (S.bestRuns || []).map(function (r, i) {
        const c = AE.Data.CHAR_MAP[r.char];
        const modeTag = r.mode === 'daily' ? '每日 · ' : (r.mode === 'rush' ? '连战 · ' : '');
        return '<div class="run-row">' +
          '<span class="run-rank">#' + (i + 1) + '</span>' +
          '<b>' + U.fmtTime(r.time) + '</b>' +
          '<span>' + modeTag + 'Lv' + r.level + ' · ' + r.kills + ' 击杀</span>' +
          '<span class="run-char">' + (c ? c.name : r.char) + '</span>' +
          '<span class="' + (r.victory ? 'ok' : '') + '">' + (r.victory ? '通关' : '陨落') + '</span>' +
          '</div>';
      }).join('') || '<div class="empty">还没有记录，去打一局吧</div>';
      const winPct = st.runs ? Math.round((st.wins || 0) / st.runs * 100) : 0;
      const dailyKey = AE.dateKey();
      const db = (S.dailyBest || {})[dailyKey];
      const dailyCard = '<div class="daily-card">' +
        '<div class="daily-card-date">每日挑战 · ' + dailyKey + '</div>' +
        (db
          ? '<div class="daily-card-main"><b>' + U.fmtTime(db.time) + '</b><span>Lv' + db.level + ' · ' + db.kills + ' 击杀 · ◈ ' + db.echoes + (db.victory ? ' · 通关' : '') + '</span></div>'
          : '<div class="daily-card-main"><b>— —</b><span>今天还没有记录，打一局每日挑战</span></div>') +
        '</div>';
      const rb = (S.bestRush && S.bestRush.size === AE.Data.RUSH_ORDER.length) ? S.bestRush : { time: 0 };
      const rushCard = '<div class="daily-card rush">' +
        '<div class="daily-card-date">首领连战 · 最佳</div>' +
        (rb.time
          ? '<div class="daily-card-main"><b>' + U.fmtTime(rb.time) + '</b><span>' +
            (AE.Data.CHAR_MAP[rb.char] ? AE.Data.CHAR_MAP[rb.char].name : rb.char) + ' · ' + (rb.date || '') + '</span></div>'
          : '<div class="daily-card-main"><b>— —</b><span>还没有连战记录</span></div>') +
        '</div>';
      const charBestHtml = AE.Data.CHARS.map(function (c) {
        const cb = (S.charBest && S.charBest[c.id]) || {};
        return '<div class="run-row char-best"><b style="color:' + c.color + '">' + c.name + '</b>' +
          '<span>最久 ' + U.fmtTime(cb.time || 0) + ' · 击杀 ' + (cb.kills || 0) +
          ' · Lv' + (cb.level || 0) + (cb.wins ? ' · 通关 ' + cb.wins : '') + '</span></div>';
      }).join('');
      const lbHtml = (S.leaderboard || []).slice().sort(function (a, b) {
        return (b.score || 0) - (a.score || 0) || (b.time || 0) - (a.time || 0);
      }).map(function (r, i) {
        const c = AE.Data.CHAR_MAP[r.char];
        const modeTag = r.mode === 'daily' ? '每日 · ' : (r.mode === 'rush' ? '连战 · ' : '');
        const g = r.grade || 'C';
        return '<div class="run-row lb-row">' +
          '<span class="run-rank">#' + (i + 1) + '</span>' +
          '<b>' + U.fmtNum(r.score || 0) + '</b>' +
          '<span><em class="grade-' + g + '">' + g + '</em> · ' + modeTag +
          'Lv' + (r.level || 0) + ' · ' + (r.kills || 0) + ' 杀 · ' + (r.maxCombo || 0) + ' 连</span>' +
          '<span class="run-char">' + (c ? c.name : r.char) + '</span>' +
          '<span class="' + (r.victory ? 'ok' : '') + '">' + (r.victory ? '通关' : U.fmtTime(r.time || 0)) + '</span>' +
          '</div>';
      }).join('') || '<div class="empty">还没有评分记录，去打一局吧</div>';
      const html =
        '<div class="screen archive-screen">' +
        '<div class="meta-head"><div style="display:flex;align-items:center;gap:14px">' +
        '<button class="icon-btn" data-act="back" aria-label="返回">←</button>' +
        '<div><h2>档案</h2><div class="sub">ARCHIVE · 生涯统计、成就与最佳记录</div></div>' +
        '</div><div class="wallet">◈ <span>' + S.echoes + '</span><small>回响</small></div></div>' +
        '<div class="stat-grid">' +
        '<div class="stat-cell"><span>总局数</span><b>' + (st.runs || 0) + '</b></div>' +
        '<div class="stat-cell"><span>通关</span><b>' + (st.wins || 0) + '</b></div>' +
        '<div class="stat-cell"><span>通关率</span><b>' + winPct + '%</b></div>' +
        '<div class="stat-cell"><span>总击杀</span><b>' + U.fmtNum(st.kills || 0) + '</b></div>' +
        '<div class="stat-cell"><span>总生存</span><b>' + U.fmtTime(st.time || 0) + '</b></div>' +
        '<div class="stat-cell"><span>总伤害</span><b>' + U.fmtNum(st.damage || 0) + '</b></div>' +
        '<div class="stat-cell"><span>击破首领</span><b>' + (st.bosses || 0) + '</b></div>' +
        '<div class="stat-cell"><span>武器进化</span><b>' + (st.evolves || 0) + '</b></div>' +
        '<div class="stat-cell"><span>总治疗</span><b>' + U.fmtNum(st.healed || 0) + '</b></div>' +
        '<div class="stat-cell"><span>星核爆发</span><b>' + (st.ults || 0) + '</b></div>' +
        '<div class="stat-cell"><span>获得遗物</span><b>' + (st.relics || 0) + '</b></div>' +
        '<div class="stat-cell"><span>最高连杀</span><b>' + (st.maxCombo || 0) + '</b></div>' +
        '</div>' +
        dailyCard +
        rushCard +
        '<div class="section-label">本地排行榜 · 最高 ' +
        U.fmtNum((S.best && S.best.score) || 0) + '</div>' +
        '<div class="run-list lb-list">' + lbHtml + '</div>' +
        '<div class="section-label">角色最佳 · 分角色记录</div>' +
        '<div class="run-list">' + charBestHtml + '</div>' +
        '<div class="section-label">成就 · ' + got.length + ' / ' + all.length + '</div>' +
        '<div class="ach-grid">' + achHtml + '</div>' +
        '<div class="section-label">最佳记录</div>' +
        '<div class="run-list">' + runs + '</div>' +
        '<div class="btn-col"><button class="btn primary" data-act="back">返回</button></div>' +
        '</div>';
      this.setHTML(html, true);
      this.scrollTop();
    },

    /* ---------- 玩法说明 ---------- */
    showHow: function () {
      this.mode = 'how';
      const html =
        '<div class="screen" style="max-width:640px">' +
        '<div class="panel">' +
        '<div class="panel-kicker">HOW TO PLAY</div>' +
        '<h2>玩法</h2>' +
        '<div class="how-grid">' +
        '<div class="how-item"><h4>操作</h4><p><span class="keycap">W</span><span class="keycap">A</span><span class="keycap">S</span><span class="keycap">D</span> 移动<br><span class="keycap">空格</span>/<span class="keycap">Shift</span> 闪避<br><span class="keycap">ESC</span> 暂停 · <span class="keycap">M</span> 静音</p></div>' +
        '<div class="how-item"><h4>自动战斗</h4><p>武器会自动锁定敌人开火。你只需要走位、拾取经验，在升级时做选择。</p></div>' +
        '<div class="how-item"><h4>武器进化</h4><p>同一把武器升到 <b style="color:#ffd479">8 级</b>会立刻进化成全新形态，威力大幅提升。</p></div>' +
        '<div class="how-item"><h4>首领</h4><p>每 2.5 分钟出现一名首领，攻击都有前摇提示。击破后可获得额外强化。</p></div>' +
        '<div class="how-item"><h4>回响</h4><p>每局结束按表现结算「回响」，可在强化界面购买永久成长与解锁角色。</p></div>' +
        '<div class="how-item"><h4>评分</h4><p>结算按击杀、等级、首领、存活、最高连杀与通关计分，给出 S / A / B / C 评级，本地保留 Top 8。</p></div>' +
        '<div class="how-item"><h4>目标</h4><p>活到 <b style="color:#ffd479">10:00</b>，击破最终首领「终焉回响」，之后可进入无尽轮次。</p></div>' +
        '</div>' +
        '<div class="btn-col"><button class="btn primary" data-act="back">返回</button></div>' +
        '</div>' +
        '</div>';
      this.setHTML(html, true);
      this.scrollTop();
    }
  };

  AE.UI = UI;
})(typeof window !== 'undefined' ? window : globalThis);
