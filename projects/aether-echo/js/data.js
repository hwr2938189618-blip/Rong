/* ============================================================
 * 星渊回响 · Aether Echo
 * data.js — 全部数值表（武器 / 被动 / 敌人 / BOSS / 角色 / 永久强化）
 * 纯数据，不碰 DOM，可在 Node 里直接载入做平衡模拟。
 * ============================================================ */
(function (g) {
  'use strict';
  const AE = (g.AE = g.AE || {});
  const D = (g.DATA = g.DATA || {});
  AE.Data = D;

  D.VERSION = '1.0.0';
  D.TITLE = '星渊回响';
  D.SUBTITLE = 'AETHER ECHO';

  D.CONST = {
    RUN_LENGTH: 600,          // 抵达最终 BOSS 的时间（秒）
    WORLD_W: 2800,
    WORLD_H: 1900,
    MAX_ENEMIES: 260,
    MAX_BULLETS: 420,
    MAX_EBULLETS: 420,
    MAX_ORBS: 260,
    MAX_PARTICLES: 620,
    MAX_TEXTS: 70,
    BASE_HP: 100,
    BASE_SPEED: 232,
    BASE_CRIT: 0.05,
    BASE_CRITDMG: 1.85,
    DASH_CD: 2.0,
    DASH_TIME: 0.16,
    DASH_SPEED: 3.4,
    PICKUP: 92,
    PLAYER_R: 13,
    LEVEL_MAX: 60,
    WEAPON_SLOTS: 6,
    PASSIVE_SLOTS: 6,
    XP_MAGNET: 240
  };

  /* ---------- 升级经验曲线 ---------- */
  D.xpNeed = function (level) {
    // level = 当前等级，返回升到下一级所需经验
    const n = Math.max(1, level);
    return Math.floor(4 + n * 1.6 + Math.pow(n, 1.5) * 0.5);
  };

  /* ---------- 时间缩放曲线（敌人成长） ---------- */
  D.hpScale = function (t, loop) {
    const m = t / 60;
    const endless = loop || 0;
    return (1 + m * 0.40 + Math.pow(m, 1.7) * 0.025) * (1 + endless * 0.9);
  };
  D.dmgScale = function (t, loop) {
    const m = t / 60;
    return (1 + m * 0.115) * (1 + (loop || 0) * 0.35);
  };

  /* ============================================================
   * 武器（6 把，每把 8 级，满级自动进化）
   * ============================================================ */
  D.WEAPONS = [
    {
      id: 'pulse', name: '星屑脉冲', icon: '✦', color: '#7df9ff',
      tag: '射手', intro: '锁定最近的敌人，发射高速星屑弹。',
      levels: [
        { dmg: 12, cd: 0.55, count: 1, speed: 820, pierce: 0, size: 4.5 },
        { dmg: 17, cd: 0.52, count: 1, speed: 840, pierce: 0, size: 4.5 },
        { dmg: 17, cd: 0.49, count: 2, speed: 860, pierce: 0, size: 4.6 },
        { dmg: 23, cd: 0.46, count: 2, speed: 880, pierce: 0, size: 5.0 },
        { dmg: 23, cd: 0.43, count: 3, speed: 900, pierce: 0, size: 5.0 },
        { dmg: 30, cd: 0.40, count: 3, speed: 920, pierce: 0, size: 5.2 },
        { dmg: 30, cd: 0.37, count: 4, speed: 940, pierce: 0, size: 5.4 },
        { dmg: 38, cd: 0.34, count: 4, speed: 960, pierce: 1, size: 5.6 }
      ],
      evolved: {
        name: '星屑风暴', icon: '✧', dmg: 50, cd: 0.22, count: 5, speed: 1050,
        pierce: 3, size: 6, homing: 2.4, note: '弹幕化作风暴，穿透并追踪'
      }
    },
    {
      id: 'orbit', name: '轨道刃', icon: '◍', color: '#b388ff',
      tag: '环绕', intro: '锐利的相位刃环绕己身，接触即切割。',
      levels: [
        { dmg: 16, count: 2, radius: 72, rot: 2.8, hitCd: 0.52 },
        { dmg: 21, count: 2, radius: 74, rot: 2.9, hitCd: 0.52 },
        { dmg: 21, count: 3, radius: 76, rot: 2.9, hitCd: 0.50 },
        { dmg: 28, count: 3, radius: 80, rot: 3.0, hitCd: 0.50 },
        { dmg: 28, count: 3, radius: 86, rot: 3.1, hitCd: 0.48 },
        { dmg: 36, count: 4, radius: 90, rot: 3.1, hitCd: 0.48 },
        { dmg: 36, count: 4, radius: 96, rot: 3.2, hitCd: 0.46 },
        { dmg: 48, count: 4, radius: 96, rot: 3.2, hitCd: 0.42 }
      ],
      evolved: {
        name: '永寂环带', icon: '❂', dmg: 70, count: 6, radius: 112, rot: 2.5,
        hitCd: 0.32, note: '六枚环刃，斩尽触界之敌'
      }
    },
    {
      id: 'nova', name: '虚空新星', icon: '◎', color: '#ffd479',
      tag: '范围', intro: '周期性爆发虚空冲击，范围伤害并击退。',
      levels: [
        { dmg: 30, cd: 2.6, radius: 112, kb: 190 },
        { dmg: 40, cd: 2.5, radius: 120, kb: 195 },
        { dmg: 40, cd: 2.45, radius: 138, kb: 200 },
        { dmg: 55, cd: 2.3, radius: 146, kb: 205 },
        { dmg: 55, cd: 2.1, radius: 160, kb: 210 },
        { dmg: 72, cd: 2.0, radius: 172, kb: 215 },
        { dmg: 72, cd: 1.85, radius: 186, kb: 220 },
        { dmg: 95, cd: 1.7, radius: 200, kb: 230 }
      ],
      evolved: {
        name: '奇点爆发', icon: '❃', dmg: 140, cd: 1.05, radius: 250, kb: 320,
        pull: 280, second: 76, note: '先吸引，再撕裂：双重爆发'
      }
    },
    {
      id: 'seek', name: '追猎蜂群', icon: '➤', color: '#ff9f68',
      tag: '追踪', intro: '放出自动追踪的蜂群弹，命中后爆炸。',
      levels: [
        { dmg: 32, cd: 1.80, count: 2, speed: 330, blast: 52, radius: 36 },
        { dmg: 42, cd: 1.78, count: 2, speed: 340, blast: 54, radius: 37 },
        { dmg: 42, cd: 1.75, count: 3, speed: 345, blast: 54, radius: 38 },
        { dmg: 56, cd: 1.72, count: 3, speed: 350, blast: 58, radius: 40 },
        { dmg: 56, cd: 1.68, count: 4, speed: 355, blast: 60, radius: 41 },
        { dmg: 72, cd: 1.62, count: 4, speed: 360, blast: 62, radius: 42 },
        { dmg: 72, cd: 1.58, count: 5, speed: 365, blast: 64, radius: 44 },
        { dmg: 92, cd: 1.50, count: 5, speed: 370, blast: 66, radius: 45 }
      ],
      evolved: {
        name: '蜂群母巢', icon: '➹', dmg: 120, cd: 0.90, count: 6, speed: 400,
        blast: 74, radius: 50, note: '母巢苏醒，蜂群倾巢而出'
      }
    },
    {
      id: 'arc', name: '相位链', icon: '∿', color: '#8affc1',
      tag: '连锁', intro: '闪电在敌群间跳跃，逐次衰减。',
      levels: [
        { dmg: 20, cd: 1.40, chains: 2, range: 260, falloff: 0.82 },
        { dmg: 27, cd: 1.38, chains: 2, range: 265, falloff: 0.82 },
        { dmg: 27, cd: 1.36, chains: 3, range: 270, falloff: 0.83 },
        { dmg: 36, cd: 1.32, chains: 3, range: 275, falloff: 0.84 },
        { dmg: 36, cd: 1.28, chains: 4, range: 280, falloff: 0.85 },
        { dmg: 48, cd: 1.24, chains: 4, range: 290, falloff: 0.86 },
        { dmg: 48, cd: 1.20, chains: 5, range: 300, falloff: 0.87 },
        { dmg: 64, cd: 1.14, chains: 6, range: 310, falloff: 0.88 }
      ],
      evolved: {
        name: '雷暴回廊', icon: '⌁', dmg: 96, cd: 0.66, chains: 9, range: 380,
        falloff: 0.9, stun: 0.22, note: '雷霆成廊，连锁至九'
      }
    },
    {
      id: 'prism', name: '破碎明光', icon: '✹', color: '#ff7fb0',
      tag: '散射', intro: '朝瞄准方向泼洒棱镜碎片，近距离高爆发。',
      levels: [
        { dmg: 12, cd: 1.00, count: 3, spread: 0.55, speed: 760, life: 0.50, pierce: 1 },
        { dmg: 12, cd: 0.96, count: 4, spread: 0.60, speed: 770, life: 0.50, pierce: 1 },
        { dmg: 17, cd: 0.92, count: 4, spread: 0.60, speed: 780, life: 0.52, pierce: 1 },
        { dmg: 17, cd: 0.90, count: 5, spread: 0.66, speed: 790, life: 0.52, pierce: 1 },
        { dmg: 23, cd: 0.86, count: 5, spread: 0.66, speed: 800, life: 0.54, pierce: 1 },
        { dmg: 23, cd: 0.82, count: 6, spread: 0.72, speed: 810, life: 0.54, pierce: 2 },
        { dmg: 30, cd: 0.78, count: 6, spread: 0.72, speed: 820, life: 0.56, pierce: 2 },
        { dmg: 30, cd: 0.74, count: 7, spread: 0.78, speed: 830, life: 0.56, pierce: 2 }
      ],
      evolved: {
        name: '棱镜审判', icon: '❈', dmg: 40, cd: 0.58, count: 10, spread: 1.10,
        speed: 850, life: 0.58, pierce: 3, ricochet: 1, note: '光化作裁决，弹射不止'
      }
    }
  ];

  D.WEAPON_MAP = {};
  D.WEAPONS.forEach(function (w) { D.WEAPON_MAP[w.id] = w; });

  /* 武器当前一级的实际数值（含进化覆盖） */
  D.weaponStats = function (w, level) {
    const def = D.WEAPON_MAP[w.id];
    if (!def) return null;
    if (w.evolved && def.evolved) return def.evolved;
    return def.levels[Math.max(0, Math.min(7, level - 1))];
  };

  /* 升级卡片上的数值摘要 */
  D.weaponDetail = function (w, level) {
    const s = D.weaponStats(w, level);
    if (!s) return '';
    const def = D.WEAPON_MAP[w.id];
    const parts = ['伤害 ' + s.dmg];
    if (s.cd) parts.push('间隔 ' + s.cd.toFixed(2) + 's');
    if (def.id === 'orbit') parts.push('刃数 ' + s.count);
    else if (s.count) parts.push('数量 ' + s.count);
    if (s.pierce) parts.push('穿透 ' + s.pierce);
    if (s.chains) parts.push('连锁 ' + s.chains);
    return parts.join(' · ');
  };

  /* ============================================================
   * 被动（10 种，每种 5 级）
   * ============================================================ */
  D.PASSIVES = [
    {
      id: 'power', name: '强袭矩阵', icon: '✦', color: '#ff8fa3',
      desc: function (l) { return '全部武器伤害 +' + (l * 12) + '%'; },
      apply: function (p, l) { p.dmgMul += 0.12; }
    },
    {
      id: 'haste', name: '时律加速', icon: '◈', color: '#7df9ff',
      desc: function (l) { return '攻击速度 +' + (l * 10) + '%'; },
      apply: function (p, l) { p.atkSpd += 0.10; }
    },
    {
      id: 'swift', name: '掠影步', icon: '⌁', color: '#8affc1',
      desc: function (l) { return '移动速度 +' + (l * 8) + '%'; },
      apply: function (p, l) { p.spdMul += 0.08; }
    },
    {
      id: 'vitality', name: '生命基质', icon: '✚', color: '#ff5c7a',
      desc: function (l) { return '生命上限 +' + (l * 18) + '，并立即回复同等生命'; },
      apply: function (p, l) { p.maxHp += 18; p.hp = Math.min(p.maxHp, p.hp + 18); p.levelHpBonus += 18; }
    },
    {
      id: 'regen', name: '自愈回响', icon: '✜', color: '#8affc1',
      desc: function (l) { return '每秒回复 ' + (l * 0.7).toFixed(1) + ' 点生命'; },
      apply: function (p, l) { p.regen += 0.7; }
    },
    {
      id: 'magnet', name: '引力拾取', icon: '⊙', color: '#ffd479',
      desc: function (l) { return '拾取范围 +' + (l * 25) + '%，经验获取 +' + (l * 6) + '%'; },
      apply: function (p, l) { p.pickupMul += 0.25; p.xpMul += 0.06; }
    },
    {
      id: 'area', name: '扩散领域', icon: '◎', color: '#b388ff',
      desc: function (l) { return '技能范围 +' + (l * 12) + '%'; },
      apply: function (p, l) { p.areaMul += 0.12; }
    },
    {
      id: 'crit', name: '锐眼', icon: '✷', color: '#ffd479',
      desc: function (l) { return '暴击率 +' + (l * 6) + '%'; },
      apply: function (p, l) { p.crit += 0.06; }
    },
    {
      id: 'armor', name: '相位护甲', icon: '⛨', color: '#9fb4ff',
      desc: function (l) { return '受到伤害减少 ' + (l * 2) + ' 点'; },
      apply: function (p, l) { p.armor += 2; }
    },
    {
      id: 'dash', name: '瞬息', icon: '↯', color: '#7df9ff',
      desc: function (l) { return '闪避冷却 -' + (l * 12) + '%'; },
      apply: function (p, l) { p.dashCdMul *= 0.88; }
    }
  ];
  D.PASSIVE_MAP = {};
  D.PASSIVES.forEach(function (p) { D.PASSIVE_MAP[p.id] = p; });

  /* ============================================================
   * 敌人
   * ============================================================ */
  D.ENEMIES = {
    crawler: {
      name: '虚蚀爬虫', hp: 18, speed: 64, dmg: 8, r: 12, xp: 1,
      color: '#ff6b9d', shape: 'crawler', behavior: 'chase'
    },
    stalker: {
      name: '疾影', hp: 13, speed: 128, dmg: 6, r: 10, xp: 1,
      color: '#7df9ff', shape: 'stalker', behavior: 'stalker'
    },
    spitter: {
      name: '蚀雾喷吐者', hp: 30, speed: 54, dmg: 5, r: 12, xp: 2,
      color: '#8affc1', shape: 'spitter', behavior: 'ranged'
    },
    bloater: {
      name: '爆裂囊', hp: 46, speed: 50, dmg: 10, r: 16, xp: 2,
      color: '#ffd479', shape: 'bloater', behavior: 'chase', explode: 92, explodeDmg: 22
    },
    bulwark: {
      name: '重壳', hp: 96, speed: 40, dmg: 12, r: 20, xp: 3,
      color: '#b388ff', shape: 'bulwark', behavior: 'chase', armor: 2
    },
    splitter: {
      name: '裂体', hp: 56, speed: 62, dmg: 9, r: 17, xp: 3,
      color: '#ff9f68', shape: 'splitter', behavior: 'chase', split: 2
    },
    wisp: {
      name: '游魂', hp: 22, speed: 96, dmg: 8, r: 11, xp: 2,
      color: '#c9b6ff', shape: 'wisp', behavior: 'wisp'
    }
  };

  /* 随时间解锁的敌群权重 */
  D.SPAWN_TABLE = [
    { t: 0, w: { crawler: 10 } },
    { t: 30, w: { crawler: 9, stalker: 3 } },
    { t: 70, w: { crawler: 8, stalker: 4, spitter: 3 } },
    { t: 120, w: { crawler: 7, stalker: 4, spitter: 3, bloater: 2 } },
    { t: 175, w: { crawler: 6, stalker: 4, spitter: 3, bloater: 2, bulwark: 2 } },
    { t: 235, w: { crawler: 6, stalker: 4, spitter: 3, bloater: 2, bulwark: 2, splitter: 2 } },
    { t: 300, w: { crawler: 5, stalker: 5, spitter: 3, bloater: 2, bulwark: 3, splitter: 3 } },
    { t: 380, w: { crawler: 4, stalker: 5, spitter: 4, bloater: 2, bulwark: 3, splitter: 3, wisp: 3 } },
    { t: 470, w: { crawler: 4, stalker: 5, spitter: 4, bloater: 3, bulwark: 4, splitter: 4, wisp: 4 } }
  ];

  /* ============================================================
   * BOSS
   * ============================================================ */
  D.BOSSES = [
    {
      id: 'weaver', name: '织巢者', title: 'NEST WEAVER', at: 150,
      hp: 420, r: 54, speed: 96, dmg: 18, xp: 120, echo: 24,
      color: '#b388ff', ai: 'weaver'
    },
    {
      id: 'breaker', name: '裂界兽', title: 'RIFT BREAKER', at: 300,
      hp: 1500, r: 60, speed: 112, dmg: 28, xp: 180, echo: 34,
      color: '#ff9f68', ai: 'breaker'
    },
    {
      id: 'manyeye', name: '千目', title: 'THOUSAND EYES', at: 450,
      hp: 2300, r: 58, speed: 86, dmg: 24, xp: 240, echo: 44,
      color: '#8affc1', ai: 'manyeye'
    },
    {
      id: 'final', name: '终焉回响', title: 'FINAL ECHO', at: 600,
      hp: 4000, r: 76, speed: 118, dmg: 34, xp: 400, echo: 80,
      color: '#ff5c7a', ai: 'final'
    }
  ];

  /* ============================================================
   * 角色
   * ============================================================ */
  D.CHARS = [
    {
      id: 'echo', name: '回声者', title: 'THE ECHO', cost: 0,
      hp: 100, speed: 232, dmgMul: 1.0, armor: 0, crit: 0, xpMul: 1.0,
      start: 'pulse', color: '#7df9ff',
      intro: '均衡的回响者，以星屑脉冲开辟道路。',
      perk: '攻守均衡 · 无短板'
    },
    {
      id: 'blade', name: '刃舞者', title: 'BLADE DANCER', cost: 100,
      hp: 82, speed: 262, dmgMul: 1.05, armor: 0, crit: 0.12, xpMul: 1.0,
      start: 'orbit', color: '#b388ff',
      intro: '以高速与暴击周旋，用环刃绞碎近身之敌。',
      perk: '移速 +13% · 暴击 +12% · 生命 -18'
    },
    {
      id: 'warden', name: '守望者', title: 'VOID WARDEN', cost: 180,
      hp: 132, speed: 210, dmgMul: 1.0, armor: 2, crit: 0, xpMul: 1.0,
      start: 'nova', color: '#ffd479',
      intro: '厚重的新星核心，以冲击波清空四周。',
      perk: '生命 +32 · 护甲 +2 · 移速 -10%'
    },
    {
      id: 'seer', name: '星语者', title: 'STAR SEER', cost: 280,
      hp: 92, speed: 238, dmgMul: 1.0, armor: 0, crit: 0, xpMul: 1.18,
      start: 'arc', color: '#8affc1',
      intro: '与星渊共振，经验与连锁闪电都更快。',
      perk: '经验 +18% · 初始相位链'
    }
  ];
  D.CHAR_MAP = {};
  D.CHARS.forEach(function (c) { D.CHAR_MAP[c.id] = c; });

  /* ============================================================
   * 永久强化（局外成长，回响购买）
   * ============================================================ */
  D.META = [
    { id: 'might', name: '强袭基质', icon: '✦', max: 5, cost: function (l) { return 15 + l * 15; }, per: 0.06, stat: 'dmg', desc: function (l) { return '伤害 +' + (l * 6) + '%'; } },
    { id: 'vigor', name: '生命基质', icon: '✚', max: 5, cost: function (l) { return 15 + l * 15; }, per: 0.08, stat: 'hp', desc: function (l) { return '生命上限 +' + (l * 8) + '%'; } },
    { id: 'swift', name: '掠影基质', icon: '⌁', max: 5, cost: function (l) { return 12 + l * 12; }, per: 0.03, stat: 'spd', desc: function (l) { return '移动速度 +' + (l * 3) + '%'; } },
    { id: 'haste', name: '时律基质', icon: '◈', max: 5, cost: function (l) { return 18 + l * 18; }, per: 0.04, stat: 'atk', desc: function (l) { return '攻击速度 +' + (l * 4) + '%'; } },
    { id: 'fortune', name: '回响基质', icon: '⊙', max: 5, cost: function (l) { return 20 + l * 20; }, per: 0.05, stat: 'xp', desc: function (l) { return '经验与回响获取 +' + (l * 5) + '%'; } },
    { id: 'revive', name: '回响之种', icon: '✷', max: 2, cost: function (l) { return 140 + l * 160; }, per: 1, stat: 'revive', desc: function (l) { return '每局复活 ' + l + ' 次'; } }
  ];

  /* 首次进入游戏的操作提示 */
  D.TIPS = [
    '武器会自动开火，专心走位即可。',
    '按住 Shift / 空格 闪避，可穿过敌群。',
    '同一种武器升到 8 级会自动进化。',
    '金色精英会掉落大量经验。',
    'BOSS 的行动都有前摇，提前绕开。'
  ];
})(typeof window !== 'undefined' ? window : globalThis);
