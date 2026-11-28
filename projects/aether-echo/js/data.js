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

  D.VERSION = '1.53.0';
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
        name: '星屑风暴', icon: '✧', dmg: 42, cd: 0.24, count: 5, speed: 1050,
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
        { dmg: 48, count: 4, radius: 130, rot: 3.2, hitCd: 0.46 }
      ],
      evolved: {
        name: '永寂环带', icon: '❂', dmg: 110, count: 6, radius: 152, rot: 2.5,
        hitCd: 0.38, note: '六枚环刃，斩尽触界之敌'
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
        name: '奇点爆发', icon: '❃', dmg: 165, cd: 1.05, radius: 250, kb: 320,
        pull: 280, second: 90, note: '先吸引，再撕裂：双重爆发'
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
        { dmg: 72, cd: 1.20, chains: 5, range: 300, falloff: 0.87 },
        { dmg: 90, cd: 1.10, chains: 6, range: 320, falloff: 0.88 }
      ],
      evolved: {
        name: '雷暴回廊', icon: '⌁', dmg: 180, cd: 0.55, chains: 9, range: 380,
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
        name: '棱镜审判', icon: '❈', dmg: 58, cd: 0.54, count: 12, spread: 1.15,
        speed: 850, life: 0.58, pierce: 3, ricochet: 1, note: '光化作裁决，弹射不止'
      }
    },
    {
      id: 'well', name: '引力奇点', icon: '◉', color: '#9f8bff',
      tag: '控场', intro: '在敌群中心撕开引力井，持续牵引并撕裂其中的敌人。',
      levels: [
        { dmg: 10, cd: 3.2, radius: 110, duration: 2.4, tick: 0.50, pull: 150 },
        { dmg: 14, cd: 3.0, radius: 118, duration: 2.5, tick: 0.50, pull: 160 },
        { dmg: 14, cd: 2.9, radius: 126, duration: 2.6, tick: 0.48, pull: 170 },
        { dmg: 19, cd: 2.7, radius: 136, duration: 2.8, tick: 0.46, pull: 180 },
        { dmg: 19, cd: 2.5, radius: 146, duration: 3.0, tick: 0.44, pull: 195 },
        { dmg: 25, cd: 2.3, radius: 156, duration: 3.2, tick: 0.42, pull: 210 },
        { dmg: 25, cd: 2.1, radius: 166, duration: 3.4, tick: 0.40, pull: 225 },
        { dmg: 33, cd: 1.9, radius: 176, duration: 3.6, tick: 0.38, pull: 240 }
      ],
      evolved: {
        name: '事件视界', icon: '⬤', dmg: 30, cd: 1.35, radius: 220, duration: 4.0,
        tick: 0.40, pull: 330, implode: 160, note: '引力井坍缩时撕碎一切'
      }
    },
    {
      id: 'lance', name: '贯穿光矛', icon: '➹', color: '#ffd479',
      tag: '贯穿', intro: '蓄能后射出贯穿一切的光矛，直线上所有敌人一起贯穿。',
      levels: [
        { dmg: 55, cd: 2.3, width: 20, range: 820, beams: 1, spread: 0 },
        { dmg: 70, cd: 2.2, width: 22, range: 830, beams: 1, spread: 0 },
        { dmg: 70, cd: 2.1, width: 24, range: 850, beams: 1, spread: 0 },
        { dmg: 95, cd: 2.0, width: 26, range: 870, beams: 1, spread: 0 },
        { dmg: 95, cd: 1.9, width: 28, range: 890, beams: 1, spread: 0 },
        { dmg: 125, cd: 1.75, width: 30, range: 910, beams: 1, spread: 0 },
        { dmg: 125, cd: 1.6, width: 32, range: 940, beams: 1, spread: 0 },
        { dmg: 165, cd: 1.45, width: 36, range: 980, beams: 1, spread: 0 }
      ],
      evolved: {
        name: '贯穿星轨', icon: '⇶', dmg: 240, cd: 1.05, width: 46, range: 1050,
        beams: 3, spread: 0.13, note: '三道星轨同时贯穿战场'
      }
    },
    {
      id: 'scythe', name: '回旋月刃', icon: '☾', color: '#9fe8ff',
      tag: '回旋', intro: '甩出月牙刃，去程与回程各切一次。',
      levels: [
        { dmg: 26, cd: 1.75, count: 2, speed: 430, spread: 0.30, life: 1.35, size: 7 },
        { dmg: 32, cd: 1.70, count: 2, speed: 440, spread: 0.30, life: 1.35, size: 7 },
        { dmg: 32, cd: 1.62, count: 3, speed: 450, spread: 0.32, life: 1.40, size: 7.5 },
        { dmg: 42, cd: 1.55, count: 3, speed: 460, spread: 0.32, life: 1.40, size: 7.5 },
        { dmg: 42, cd: 1.48, count: 3, speed: 475, spread: 0.34, life: 1.45, size: 8 },
        { dmg: 52, cd: 1.40, count: 4, speed: 485, spread: 0.34, life: 1.50, size: 8 },
        { dmg: 52, cd: 1.32, count: 4, speed: 500, spread: 0.36, life: 1.55, size: 8.5 },
        { dmg: 80, cd: 1.24, count: 4, speed: 510, spread: 0.36, life: 1.60, size: 9 }
      ],
      evolved: {
        name: '双生月蚀', icon: '☽', dmg: 125, cd: 0.85, count: 6, speed: 540,
        spread: 0.22, life: 1.75, size: 10, note: '六刃往返，月蚀成环'
      }
    },
    {
      id: 'bloom', name: '星华绽放', icon: '✿', color: '#ff9f68',
      tag: '环射', intro: '向四周绽放星华花瓣，绕身清场。',
      levels: [
        { dmg: 18, cd: 2.5, count: 8, speed: 285, life: 1.00, pierce: 1, size: 4.6 },
        { dmg: 23, cd: 2.42, count: 9, speed: 292, life: 1.02, pierce: 1, size: 4.8 },
        { dmg: 23, cd: 2.34, count: 10, speed: 300, life: 1.04, pierce: 1, size: 5.0 },
        { dmg: 28, cd: 2.24, count: 11, speed: 306, life: 1.06, pierce: 1, size: 5.2 },
        { dmg: 28, cd: 2.14, count: 12, speed: 312, life: 1.08, pierce: 2, size: 5.4 },
        { dmg: 32, cd: 2.04, count: 13, speed: 318, life: 1.10, pierce: 2, size: 5.5 },
        { dmg: 32, cd: 1.94, count: 14, speed: 325, life: 1.12, pierce: 2, size: 5.6 },
        { dmg: 38, cd: 1.84, count: 15, speed: 330, life: 1.15, pierce: 2, size: 5.8 }
      ],
      evolved: {
        name: '超新星花园', icon: '❁', dmg: 58, cd: 1.30, count: 26, speed: 360,
        life: 1.35, pierce: 2, size: 6.2, note: '花园盛开，环身皆刃'
      }
    },
    {
      id: 'beam', name: '湮灭光束', icon: '⌁', color: '#ff7fb0', tag: '持续',
      intro: '锁定单个方向持续轰击，沿直线反复灼击。',
      levels: [
        { dmg: 30, cd: 2.3, duration: 0.5, width: 10, range: 520 },
        { dmg: 40, cd: 2.2, duration: 0.55, width: 11, range: 530 },
        { dmg: 40, cd: 2.1, duration: 0.6, width: 12, range: 545 },
        { dmg: 55, cd: 2.0, duration: 0.65, width: 13, range: 560 },
        { dmg: 55, cd: 1.95, duration: 0.7, width: 14, range: 575 },
        { dmg: 70, cd: 1.85, duration: 0.78, width: 15, range: 590 },
        { dmg: 70, cd: 1.78, duration: 0.84, width: 16, range: 605 },
        { dmg: 90, cd: 1.70, duration: 0.90, width: 18, range: 620 }
      ],
      evolved: {
        name: '终焉光路', icon: '⇶', dmg: 120, cd: 1.35, duration: 1.0,
        width: 26, range: 700, note: '一道光路，贯穿前方一切'
      }
    },
    {
      id: 'flame', name: '焰流喷射', icon: '♨', color: '#ff9f68',
      tag: '近喷', intro: '朝前方喷出短程火流，整片扇形同时灼烧并点燃。',
      levels: [
        { dmg: 22, cd: 0.42, range: 210, angle: 0.85 },
        { dmg: 28, cd: 0.40, range: 215, angle: 0.88 },
        { dmg: 28, cd: 0.38, range: 225, angle: 0.92 },
        { dmg: 36, cd: 0.36, range: 235, angle: 0.96 },
        { dmg: 36, cd: 0.34, range: 245, angle: 1.00 },
        { dmg: 46, cd: 0.32, range: 255, angle: 1.04 },
        { dmg: 46, cd: 0.30, range: 265, angle: 1.08 },
        { dmg: 58, cd: 0.28, range: 280, angle: 1.12 }
      ],
      evolved: {
        name: '日冕喷流', icon: '❂', dmg: 130, cd: 0.18, range: 330, angle: 1.25,
        note: '火流化作日冕，扫尽前方'
      }
    }
  ];

  D.WEAPON_MAP = {};
  D.WEAPONS.forEach(function (w) { D.WEAPON_MAP[w.id] = w; });

  /* ---------- 武器共鸣：同时携带两把指定武器时生效 ---------- */
  D.RESONANCES = [
    {
      id: 'conduct', name: '星轨交汇', color: '#7df9ff',
      weapons: ['pulse', 'arc'], dmg: 1.18,
      desc: '星屑脉冲与相位链伤害 +18%'
    },
    {
      id: 'ringflow', name: '永寂环流', color: '#b388ff',
      weapons: ['orbit', 'well'], dmg: 1.18,
      desc: '轨道刃与引力奇点伤害 +18%'
    },
    {
      id: 'lightpath', name: '光路同调', color: '#ffd479',
      weapons: ['lance', 'beam'], dmg: 1.10, width: 1.25,
      desc: '贯穿光矛与湮灭光束伤害 +10%，宽度 +25%'
    },
    {
      id: 'huntmoon', name: '猎月双生', color: '#ff9f68',
      weapons: ['seek', 'scythe'], dmg: 1.20,
      desc: '追猎蜂群与回旋月刃伤害 +20%'
    },
    {
      id: 'supernova', name: '超新星花园', color: '#ff9f68',
      weapons: ['bloom', 'nova'], dmg: 1.20,
      desc: '星华绽放与虚空新星伤害 +20%'
    },
    {
      id: 'prismstar', name: '棱镜星屑', color: '#ff7fb0',
      weapons: ['prism', 'pulse'], dmg: 1.16,
      desc: '破碎明光与星屑脉冲伤害 +16%'
    }
  ];

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
    if (def.id === 'well') {
      parts.push('半径 ' + s.radius);
      parts.push('持续 ' + s.duration + 's');
    }
    if (def.id === 'lance') {
      parts.push('宽度 ' + s.width);
      if (s.beams > 1) parts.push('光束 ' + s.beams);
    }
    if (def.id === 'beam') {
      parts.push('引导 ' + s.duration + 's');
      parts.push('宽度 ' + s.width);
      parts.push('射程 ' + s.range);
    }
    if (def.id === 'flame') {
      parts.push('射程 ' + s.range);
      parts.push('扇角 ' + Math.round(s.angle * 57.3) + '°');
    }
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
    },
    {
      id: 'surge', name: '超导回路', icon: '⚡', color: '#ffd479',
      desc: function (l) { return '星核能量获取 +' + (l * 30) + '%'; },
      apply: function (p, l) { p.ultGain += 0.30; }
    },
    {
      id: 'ignite', name: '引燃', icon: '✹', color: '#ff9f68',
      desc: function (l) { return '命中时 ' + (l * 8) + '% 概率点燃敌人 2.5 秒'; },
      apply: function (p, l) { p.igniteChance += 0.08; }
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
    },
    mender: {
      name: '织命者', hp: 34, speed: 66, dmg: 4, r: 13, xp: 3,
      color: '#8affc1', shape: 'mender', behavior: 'healer'
    },
    charger: {
      name: '冲角兽', hp: 66, speed: 76, dmg: 12, r: 16, xp: 3,
      color: '#ff9f68', shape: 'charger', behavior: 'charger'
    },
    priest: {
      name: '虚空祭司', hp: 74, speed: 62, dmg: 11, r: 15, xp: 5,
      color: '#d9a6ff', shape: 'priest', behavior: 'priest'
    },
    binder: {
      name: '虚空缚者', hp: 78, speed: 72, dmg: 9, r: 14, xp: 4,
      color: '#c9a6ff', shape: 'binder', behavior: 'binder'
    },
    screamer: {
      name: '虚空尖啸者', hp: 92, speed: 64, dmg: 10, r: 15, xp: 5,
      color: '#ff7fb0', shape: 'screamer', behavior: 'screamer'
    }
  };

  /* 随时间解锁的敌群权重 */
  D.SPAWN_TABLE = [
    { t: 0, w: { crawler: 10 } },
    { t: 30, w: { crawler: 9, stalker: 3 } },
    { t: 70, w: { crawler: 8, stalker: 4, spitter: 3 } },
    { t: 120, w: { crawler: 7, stalker: 4, spitter: 3, bloater: 2 } },
    { t: 175, w: { crawler: 6, stalker: 4, spitter: 3, bloater: 2, bulwark: 2 } },
    { t: 235, w: { crawler: 6, stalker: 4, spitter: 3, bloater: 2, bulwark: 2, splitter: 2, mender: 2 } },
    { t: 300, w: { crawler: 5, stalker: 5, spitter: 3, bloater: 2, bulwark: 3, splitter: 3, mender: 2, charger: 3 } },
    { t: 380, w: { crawler: 4, stalker: 5, spitter: 4, bloater: 2, bulwark: 3, splitter: 3, wisp: 3, mender: 3, charger: 3, priest: 1, binder: 2, screamer: 1 } },
    { t: 470, w: { crawler: 4, stalker: 5, spitter: 4, bloater: 3, bulwark: 4, splitter: 4, wisp: 4, mender: 3, charger: 4, priest: 2, binder: 2, screamer: 2 } }
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
    },
    {
      id: 'eclipse', name: '星蚀', title: 'ECLIPSE', at: 780,
      hp: 4800, r: 68, speed: 96, dmg: 30, xp: 360, echo: 70,
      color: '#c9b6ff', ai: 'eclipse'
    },
    {
      id: 'abyss', name: '深渊之眼', title: 'THE ABYSS GAZES', at: 960,
      hp: 5600, r: 86, speed: 88, dmg: 32, xp: 460, echo: 90,
      color: '#ff5c9a', ai: 'abyss'
    }
  ];
  /* 首领连战顺序 */
  D.RUSH_ORDER = ['weaver', 'breaker', 'manyeye', 'eclipse', 'final', 'abyss'];

  /* 无尽首领词缀 */
  D.BOSS_AFFIXES = [
    { id: 'frenzy', name: '狂暴', color: '#ff5c7a', desc: '攻击与移速 +25%' },
    { id: 'aegis', name: '护盾', color: '#9fb4ff', desc: '生命 +25%，护甲 +8' },
    { id: 'summoner', name: '召唤', color: '#8affc1', desc: '每 6 秒召唤 2 只虚空生物' },
    { id: 'gravity', name: '引力', color: '#9f8bff', desc: '每 7 秒预警后牵引玩家 0.7 秒' }
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
    },
    {
      id: 'lumen', name: '逐光者', title: 'LIGHTRUNNER', cost: 320,
      hp: 88, speed: 250, dmgMul: 1.0, armor: 0, crit: 0.08, xpMul: 1.0,
      start: 'prism', color: '#ffd479', dashDamage: true, dashCdMul: 0.7,
      intro: '把闪避本身当成武器，从敌群中穿过去。',
      perk: '闪避冷却 -30% · 闪避穿过敌人造成伤害'
    },
    {
      id: 'devourer', name: '噬星者', title: 'STAR DEVOURER', cost: 420,
      hp: 92, speed: 226, dmgMul: 1.0, armor: 0, crit: 0, xpMul: 1.0,
      start: 'arc', color: '#ff7fb0', killStack: true,
      intro: '每一次击杀都让它更饥饿，也更强。',
      perk: '每击杀 +0.5% 伤害（上限 +100%）· 生命 -8%'
    },
    {
      id: 'ember', name: '灼星者', title: 'EMBER STAR', cost: 520,
      hp: 96, speed: 240, dmgMul: 0.92, armor: 0, crit: 0, xpMul: 1.0,
      start: 'bloom', color: '#ff9f68', burn: true,
      intro: '把每一次命中都点成火种，让敌群自己烧起来。',
      perk: '所有命中附加 3 秒灼烧（每秒 4 + 1.1×等级）· 伤害 -8%'
    }
  ];
  D.CHAR_MAP = {};
  D.CHARS.forEach(function (c) { D.CHAR_MAP[c.id] = c; });

  /* 星核化身：每个角色的化身形态 */
  D.AVATARS = {
    echo: { name: '星神·回响', color: '#ffd479', cadence: 0.50, aura: 175, reduce: 0.55 },
    blade: { name: '星神·刃舞', color: '#b388ff', cadence: 0.32, aura: 205, reduce: 0.50 },
    warden: { name: '星神·壁垒', color: '#9fb4ff', cadence: 0.72, aura: 240, reduce: 0.35 },
    seer: { name: '星神·雷廊', color: '#8affc1', cadence: 0.55, aura: 175, reduce: 0.55, chain: true },
    lumen: { name: '星神·逐光', color: '#fff3c4', cadence: 0.28, aura: 150, reduce: 0.50 },
    devourer: { name: '星神·噬星', color: '#ff7fb0', cadence: 0.55, aura: 195, reduce: 0.50, drain: true },
    ember: { name: '星神·灼世', color: '#ff9f68', cadence: 0.50, aura: 215, reduce: 0.60, burn: true }
  };

  /* ============================================================
   * 永久强化（局外成长，回响购买）
   * ============================================================ */
  D.META = [
    { id: 'might', name: '强袭基质', icon: '✦', max: 5, cost: function (l) { return 15 + l * 15; }, per: 0.06, stat: 'dmg', desc: function (l) { return '伤害 +' + (l * 6) + '%'; } },
    { id: 'vigor', name: '生命基质', icon: '✚', max: 5, cost: function (l) { return 15 + l * 15; }, per: 0.08, stat: 'hp', desc: function (l) { return '生命上限 +' + (l * 8) + '%'; } },
    { id: 'swift', name: '掠影基质', icon: '⌁', max: 5, cost: function (l) { return 12 + l * 12; }, per: 0.03, stat: 'spd', desc: function (l) { return '移动速度 +' + (l * 3) + '%'; } },
    { id: 'haste', name: '时律基质', icon: '◈', max: 5, cost: function (l) { return 18 + l * 18; }, per: 0.04, stat: 'atk', desc: function (l) { return '攻击速度 +' + (l * 4) + '%'; } },
    { id: 'fortune', name: '回响基质', icon: '⊙', max: 5, cost: function (l) { return 20 + l * 20; }, per: 0.05, stat: 'xp', desc: function (l) { return '经验与回响获取 +' + (l * 5) + '%'; } },
    { id: 'revive', name: '回响之种', icon: '✷', max: 2, cost: function (l) { return 140 + l * 160; }, per: 1, stat: 'revive', desc: function (l) { return '每局复活 ' + l + ' 次'; } },
    { id: 'core', name: '星核基质', icon: '⚡', max: 3, cost: function (l) { return 40 + l * 30; }, per: 20, stat: 'ult', desc: function (l) { return '开局星核 +' + (l * 20) + ' 点'; } },
    { id: 'ignis', name: '炽焰基质', icon: '✹', max: 3, cost: function (l) { return 50 + l * 40; }, per: 0.15, stat: 'burn', desc: function (l) { return '灼烧伤害 +' + (l * 15) + '%'; } }
  ];

  /* 首次进入游戏的操作提示 */
  D.TIPS = [
    '武器会自动开火，专心走位即可。',
    '按住 Shift / 空格 闪避，可穿过敌群。',
    '同一种武器升到 8 级会自动进化。',
    '金色精英会掉落大量经验。',
    '连杀达到 25 / 50 / 100 时会回复生命并补充星核。',
    '深渊之眼的触须横扫会留下三条直线预警，往侧面绕。',
    '无尽首领的「引力」词缀会先拉出紫色牵引线，随后把玩家拖向首领。',
    '虚空缚者的锁链会减速；拉开距离或优先击杀它即可断链。',
    '虚空尖啸者会周期性清掉附近弹幕，优先点掉它再输出。',
    '同时携带脉冲 + 相位链、环刃 + 引力井等组合会触发武器共鸣。',
    'BOSS 的行动都有前摇，提前绕开。'
  ];

  /* ============================================================
   * 成就（永久记录）
   * ============================================================ */
  D.ACHIEVEMENTS = [
    { id: 'first_blood', name: '初次回响', desc: '击杀第一个敌人', icon: '✦', color: '#7df9ff' },
    { id: 'kills_100', name: '猎手', desc: '累计击杀 100 个敌人', icon: '✧', color: '#7df9ff' },
    { id: 'kills_1000', name: '清道夫', desc: '累计击杀 1,000 个敌人', icon: '❂', color: '#b388ff' },
    { id: 'kills_10000', name: '星渊屠夫', desc: '累计击杀 10,000 个敌人', icon: '❈', color: '#ff5c7a' },
    { id: 'run_300', name: '单局清场', desc: '单局击杀 300 个敌人', icon: '✹', color: '#ff9f68' },
    { id: 'run_600', name: '势不可挡', desc: '单局击杀 600 个敌人', icon: '⌁', color: '#ffd479' },
    { id: 'lv20', name: '渐入佳境', desc: '单局达到 20 级', icon: '◈', color: '#8affc1' },
    { id: 'lv40', name: '回响共鸣', desc: '单局达到 40 级', icon: '✷', color: '#ffd479' },
    { id: 'boss1', name: '弑神者', desc: '击破任意首领', icon: '⛨', color: '#ff8fa3' },
    { id: 'boss10', name: '首领猎人', desc: '累计击破 10 名首领', icon: '❃', color: '#ffd479' },
    { id: 'evolve1', name: '第一次进化', desc: '让任意武器进化一次', icon: '✧', color: '#b388ff' },
    { id: 'evolve6', name: '全副武装', desc: '累计完成 6 次武器进化', icon: '✺', color: '#b388ff' },
    { id: 'time10', name: '坚持到底', desc: '单局存活 10 分钟', icon: '⊙', color: '#8affc1' },
    { id: 'win1', name: '回响长存', desc: '击破最终首领，完成一次通关', icon: '✵', color: '#ffd479' },
    { id: 'runs10', name: '老兵', desc: '完成 10 局游戏', icon: '◍', color: '#9fb4ff' },
    { id: 'time15', name: '深潜者', desc: '单局存活 15 分钟', icon: '◷', color: '#8affc1' },
    { id: 'relic4', name: '遗物收藏家', desc: '单局获得 4 件遗物', icon: '✧', color: '#ffd479' },
    { id: 'relic5', name: '遗物猎人', desc: '单局获得 5 件遗物', icon: '✺', color: '#ffd479' },
    { id: 'rush_win', name: '五连破晓', desc: '完成一次首领连战', icon: '⛨', color: '#ff8fa3' },
    { id: 'pact2', name: '契约行者', desc: '以至少 2 条深渊契约通关', icon: '⟡', color: '#b388ff' },
    { id: 'pact4', name: '深渊主宰', desc: '以 4 条深渊契约通关', icon: '❖', color: '#ff5c7a' },
    { id: 'abyss_kill', name: '凝视深渊', desc: '击破深渊之眼', icon: '◉', color: '#ff5c9a' },
    { id: 'event5', name: '星象观测者', desc: '单局经历 5 次星象事件', icon: '☄', color: '#ff9f68' },
    { id: 'burn300', name: '燎原', desc: '单局用灼烧击杀 300 个敌人', icon: '✹', color: '#ff9f68' },
    { id: 'ult20', name: '超新星', desc: '单局释放 20 次星核爆发', icon: '⚡', color: '#ffd479' },
    { id: 'affix3', name: '词缀猎人', desc: '单局击破 3 名带词缀的首领', icon: '❖', color: '#9fb4ff' },
    { id: 'daily_win', name: '今日之星', desc: '完成一次每日挑战通关', icon: '☀', color: '#ffd479' },
    { id: 'lv60', name: '星渊主宰', desc: '单局达到 60 级', icon: '❂', color: '#ffd479' },
    { id: 'top1', name: '榜首', desc: '本地排行榜登顶', icon: '☗', color: '#ffd479' },
    { id: 'resonance2', name: '共鸣回响', desc: '单局同时激活 2 组武器共鸣', icon: '✧', color: '#7df9ff' },
    { id: 'resonance3', name: '三重协奏', desc: '单局同时激活 3 组武器共鸣', icon: '❖', color: '#b388ff' },
    { id: 'allchar', name: '全员集结', desc: '解锁全部角色', icon: '✺', color: '#7df9ff' }
  ];

  /* ============================================================
   * 每日挑战随机扰动
   * ============================================================ */
  D.ANOMALIES = [
    { id: 'swift', name: '疾行之潮', desc: '敌人移速 +20%，经验 +15%', color: '#7df9ff' },
    { id: 'frenzy', name: '狂暴低语', desc: '敌人伤害 +25%，回响 +20%', color: '#ff5c7a' },
    { id: 'greed', name: '丰饶裂隙', desc: '击杀掉落经验 +35%', color: '#ffd479' },
    { id: 'void', name: '虚空稀薄', desc: '敌人生命 -10%，数量 +20%', color: '#b388ff' },
    { id: 'iron', name: '铁壁回响', desc: '玩家护甲 +3，移速 -6%', color: '#9fb4ff' },
    { id: 'overload', name: '超载星核', desc: '星核获取 +60%，但敌人伤害 +15%', color: '#ffd479' },
    { id: 'glass', name: '折光星核', desc: '伤害 +25%，但生命上限 -20%', color: '#ff8fa3' },
    { id: 'swarm', name: '虫群裂隙', desc: '敌人数量 +20%，经验 +10%', color: '#8affc1' }
  ];

  /* ============================================================
   * 星象事件（局内随机，每 60~90 秒一次）
   * ============================================================ */
  D.EVENTS = [
    { id: 'meteor', name: '陨星雨', icon: '☄', color: '#ff9f68', dur: 12, weight: 3,
      desc: '陨星不断砸向战场' },
    { id: 'tide', name: '虚空潮汐', icon: '≈', color: '#9f8bff', dur: 10, weight: 3,
      desc: '敌人陷入迟缓' },
    { id: 'surge', name: '星核涌动', icon: '⚡', color: '#ffd479', dur: 10, weight: 2,
      desc: '攻速与星核充能大幅提升' },
    { id: 'hunt', name: '精英狩猎', icon: '✦', color: '#ff5c7a', dur: 8, weight: 2,
      desc: '三名精英同时出现' }
  ];
  D.EVENT_MAP = {};
  D.EVENTS.forEach(function (e) { D.EVENT_MAP[e.id] = e; });

  /* ============================================================
   * 深渊契约（开局可选难度词条，提高回响收益）
   * ============================================================ */
  D.PACTS = [
    { id: 'horde', name: '兽潮', icon: '≋', color: '#ff9f68', mult: 0.2, desc: '敌人数量 +35%' },
    { id: 'frenzy', name: '狂怒', icon: '✹', color: '#ff5c7a', mult: 0.2, desc: '敌人伤害 +30%' },
    { id: 'swift', name: '疾行', icon: '⌁', color: '#7df9ff', mult: 0.2, desc: '敌人移速 +25%' },
    { id: 'elite', name: '精锐', icon: '✦', color: '#ffd479', mult: 0.2, desc: '精英出现频率翻倍，精英生命 +25%' }
  ];
  D.PACT_MAP = {};
  D.PACTS.forEach(function (p) { D.PACT_MAP[p.id] = p; });

  /* ============================================================
   * 遗物（击破首领后三选一，本局永久生效）
   * apply 为即时属性，hook=true 表示由战斗代码读取的被动效果
   * ============================================================ */
  D.RELICS = [
    {
      id: 'rage', name: '狂怒核心', icon: '✦', color: '#ff5c7a',
      desc: '全部武器伤害 +12%',
      apply: function (p) { p.dmgMul += 0.12; }
    },
    {
      id: 'haste_r', name: '时律棱镜', icon: '◈', color: '#7df9ff',
      desc: '攻击速度 +10%',
      apply: function (p) { p.atkSpd += 0.10; }
    },
    {
      id: 'blood', name: '血契', icon: '✚', color: '#ff8fa3',
      desc: '生命上限 +20%，并立即回复 30%',
      apply: function (p) {
        p.maxHp = Math.round(p.maxHp * 1.2);
        p.hp = Math.min(p.maxHp, p.hp + p.maxHp * 0.3);
      }
    },
    {
      id: 'crit_r', name: '猎杀本能', icon: '✷', color: '#ffd479',
      desc: '暴击率 +10%',
      apply: function (p) { p.crit += 0.10; }
    },
    {
      id: 'regen_r', name: '再生核心', icon: '✜', color: '#8affc1',
      desc: '每秒回复 1.2 点生命',
      apply: function (p) { p.regen += 1.2; }
    },
    {
      id: 'magnet_r', name: '引力透镜', icon: '⊙', color: '#ffd479',
      desc: '拾取范围 +40%，经验获取 +10%',
      apply: function (p) { p.pickupMul += 0.4; p.xpMul += 0.10; }
    },
    {
      id: 'area_r', name: '巨力弹头', icon: '◎', color: '#b388ff',
      desc: '技能范围 +15%',
      apply: function (p) { p.areaMul += 0.15; }
    },
    {
      id: 'armor_r', name: '相位装甲', icon: '⛨', color: '#9fb4ff',
      desc: '受到伤害减少 4 点',
      apply: function (p) { p.armor += 4; }
    },
    {
      id: 'dash_r', name: '时之沙', icon: '↯', color: '#7df9ff',
      desc: '闪避冷却 -25%',
      apply: function (p) { p.dashCdMul *= 0.75; }
    },
    {
      id: 'pact', name: '猩红契约', icon: '❈', color: '#ff5c7a',
      desc: '伤害 +22%，但生命上限 -10%',
      apply: function (p) {
        p.dmgMul += 0.22;
        p.maxHp = Math.round(p.maxHp * 0.9);
        p.hp = Math.min(p.hp, p.maxHp);
      }
    },
    {
      id: 'leech', name: '吸血符文', icon: '✧', color: '#8affc1', hook: true,
      desc: '每击杀一个敌人回复 1.5 生命'
    },
    {
      id: 'boom', name: '爆裂回响', icon: '✹', color: '#ff9f68', hook: true,
      desc: '击杀敌人时 18% 概率引发小范围爆炸'
    },
    {
      id: 'frost', name: '霜冻之触', icon: '❄', color: '#9fe8ff', hook: true,
      desc: '命中时 12% 概率冻结敌人 0.25 秒'
    },
    {
      id: 'critchain', name: '连锁暴击', icon: '⚡', color: '#ffd479', hook: true,
      desc: '暴击时对周围敌人溅射 35% 伤害'
    },
    {
      id: 'static', name: '雷霆核心', icon: '⌁', color: '#9fe8ff', hook: true,
      desc: '每 4.2 秒自动电击 3 个附近敌人'
    },
    {
      id: 'executioner', name: '处决之刃', icon: '✧', color: '#ff8fa3', hook: true,
      desc: '对生命低于 30% 的敌人伤害 +45%'
    },
    {
      id: 'bloodmoon', name: '血月', icon: '◐', color: '#ff5c7a', hook: true,
      desc: '生命低于 50% 时每秒回复 3 点生命'
    },
    {
      id: 'reaper', name: '收割之环', icon: '❂', color: '#b388ff', hook: true,
      desc: '每击杀 20 个敌人释放一次收割新星'
    },
    {
      id: 'ignition', name: '灼热核心', icon: '✹', color: '#ff9f68',
      desc: '灼烧伤害 +50%',
      apply: function (p) { p.burnMul *= 1.5; }
    },
    {
      id: 'battery', name: '超载电池', icon: '⚡', color: '#ffd479',
      desc: '星核能量获取 +40%，并立即获得 30 点星核',
      apply: function (p) { p.ultGain += 0.40; p.ult = Math.min(p.ultMax, p.ult + 30); }
    },
    {
      id: 'compass', name: '星象罗盘', icon: '✧', color: '#7df9ff', hook: true,
      desc: '星象事件间隔 -30%，事件结束回复提升到 14%'
    },
    {
      id: 'stabilizer', name: '视界稳定器', icon: '◉', color: '#ff7fb0',
      desc: '湮灭光束引导期间减伤 40%，光束宽度 +40%',
      apply: function (p) { p.beamWidth = (p.beamWidth || 1) * 1.4; p.beamGuard = true; }
    },
    {
      id: 'halo', name: '光轮护符', icon: '❂', color: '#b388ff',
      desc: '轨道刃永久多 2 枚', requires: 'orbit',
      apply: function (p) { p.orbitBonus = (p.orbitBonus || 0) + 2; }
    },
    {
      id: 'siphon', name: '湮灭虹吸', icon: '⇶', color: '#ff7fb0',
      desc: '湮灭光束每命中一个敌人回复 0.4 生命（每跳最多 4 点）', requires: 'beam',
      apply: function (p) { p.beamLeech = true; }
    },
    {
      id: 'resonator', name: '共鸣棱镜', icon: '❖', color: '#7df9ff', requiresResonance: true,
      desc: '武器共鸣的伤害与宽度增幅 +50%',
      apply: function (p) { p.resonanceMul = (p.resonanceMul || 1) * 1.5; }
    },
    {
      id: 'cinder', name: '余烬之心', icon: '✹', color: '#ff9f68', hook: true, requiresBurn: true,
      desc: '被灼烧的敌人死亡时，向周围 160 扩散余烬并点燃'
    }
  ];
})(typeof window !== 'undefined' ? window : globalThis);
