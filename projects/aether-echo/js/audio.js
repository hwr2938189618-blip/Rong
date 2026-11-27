/* ============================================================
 * audio.js — 全程序化合成音频（无任何素材文件）
 * 音效 + 生成式配乐。首次交互后启动。
 * ============================================================ */
(function (g) {
  'use strict';
  const AE = (g.AE = g.AE || {});
  const U = AE.U;

  const Audio = {
    ctx: null,
    ready: false,
    muted: false,
    master: null,
    sfxBus: null,
    musicBus: null,
    verb: null,
    last: {},
    intensity: 0.2,
    musicOn: true,
    _timer: null,
    _step: 0,
    _next: 0,

    init: function () {
      if (this.ready) return true;
      const AC = g.AudioContext || g.webkitAudioContext;
      if (!AC) return false;
      try {
        this.ctx = new AC();
      } catch (e) { return false; }
      const ctx = this.ctx;
      const comp = ctx.createDynamicsCompressor();
      comp.threshold.value = -18;
      comp.knee.value = 18;
      comp.ratio.value = 7;
      comp.attack.value = 0.003;
      comp.release.value = 0.22;

      this.master = ctx.createGain();
      this.master.gain.value = this.muted ? 0 : 0.85;
      this.master.connect(comp);
      comp.connect(ctx.destination);

      this.sfxBus = ctx.createGain();
      this.sfxBus.gain.value = 0.9;
      this.sfxBus.connect(this.master);

      this.musicBus = ctx.createGain();
      this.musicBus.gain.value = 0.34;
      this.musicBus.connect(this.master);

      // 简易卷积混响
      this.verb = ctx.createConvolver();
      this.verb.buffer = this._impulse(1.9, 2.6);
      const vg = ctx.createGain();
      vg.gain.value = 0.32;
      this.verb.connect(vg);
      vg.connect(this.master);

      this.ready = true;
      if (ctx.state === 'suspended') ctx.resume();
      this.startMusic();
      return true;
    },

    _impulse: function (dur, decay) {
      const ctx = this.ctx;
      const rate = ctx.sampleRate;
      const len = Math.floor(rate * dur);
      const buf = ctx.createBuffer(2, len, rate);
      for (let ch = 0; ch < 2; ch++) {
        const d = buf.getChannelData(ch);
        for (let i = 0; i < len; i++) {
          d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, decay);
        }
      }
      return buf;
    },

    setMuted: function (m) {
      this.muted = !!m;
      if (this.master) {
        const t = this.ctx.currentTime;
        this.master.gain.cancelScheduledValues(t);
        this.master.gain.setTargetAtTime(m ? 0 : 0.85, t, 0.05);
      }
      if (AE.Save && AE.Save.data) { AE.Save.data.muted = !!m; AE.Save.save(); }
    },
    toggle: function () {
      this.setMuted(!this.muted);
      if (!this.muted) this.init();
      return this.muted;
    },
    setIntensity: function (v) { this.intensity = U.clamp(v, 0, 1); },

    /* ---------- 合成基元 ---------- */
    _env: function (node, t0, a, d, peak, sus) {
      const prm = node.gain;
      prm.cancelScheduledValues(t0);
      prm.setValueAtTime(0.0001, t0);
      prm.exponentialRampToValueAtTime(Math.max(0.0002, peak), t0 + a);
      if (sus !== undefined) prm.exponentialRampToValueAtTime(Math.max(0.0002, sus), t0 + a + 0.04);
      prm.exponentialRampToValueAtTime(0.0001, t0 + a + d);
    },

    tone: function (o) {
      if (!this.ready) return;
      const ctx = this.ctx, t0 = ctx.currentTime + (o.delay || 0);
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = o.type || 'sine';
      osc.frequency.setValueAtTime(o.f0 || 440, t0);
      if (o.f1) osc.frequency.exponentialRampToValueAtTime(Math.max(20, o.f1), t0 + (o.slide || o.dur || 0.2));
      const filt = ctx.createBiquadFilter();
      filt.type = o.filter || 'lowpass';
      filt.frequency.value = o.cutoff || 9000;
      filt.Q.value = o.q || 0.7;
      const pan = ctx.createStereoPanner ? ctx.createStereoPanner() : null;
      if (pan) pan.pan.value = U.clamp(o.pan || 0, -1, 1);
      osc.connect(filt); filt.connect(gain);
      if (pan) { gain.connect(pan); pan.connect(this.sfxBus); } else gain.connect(this.sfxBus);
      this._env(gain, t0, o.a || 0.005, o.dur || 0.18, o.gain || 0.15);
      osc.start(t0);
      osc.stop(t0 + (o.dur || 0.18) + 0.05);
      if (o.verb) {
        const s = ctx.createGain(); s.gain.value = o.verb;
        gain.connect(s); s.connect(this.verb);
      }
    },

    noise: function (o) {
      if (!this.ready) return;
      const ctx = this.ctx, t0 = ctx.currentTime + (o.delay || 0);
      const dur = o.dur || 0.2;
      const len = Math.max(1, Math.floor(ctx.sampleRate * dur));
      const buf = ctx.createBuffer(1, len, ctx.sampleRate);
      const d = buf.getChannelData(0);
      for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
      const src = ctx.createBufferSource();
      src.buffer = buf;
      const filt = ctx.createBiquadFilter();
      filt.type = o.filter || 'lowpass';
      filt.frequency.setValueAtTime(o.freq || 1200, t0);
      if (o.freq2) filt.frequency.exponentialRampToValueAtTime(Math.max(40, o.freq2), t0 + dur);
      filt.Q.value = o.q || 1;
      const gain = ctx.createGain();
      src.connect(filt); filt.connect(gain); gain.connect(this.sfxBus);
      this._env(gain, t0, o.a || 0.005, dur, o.gain || 0.12);
      src.start(t0);
      src.stop(t0 + dur + 0.02);
      if (o.verb) {
        const s = ctx.createGain(); s.gain.value = o.verb;
        gain.connect(s); s.connect(this.verb);
      }
    },

    /* ---------- 音效 ---------- */
    sfx: function (name, opt) {
      if (!this.ready || this.muted) return;
      opt = opt || {};
      const now = this.ctx.currentTime;
      const gap = this.SFX_GAP && this.SFX_GAP[name] !== undefined ? this.SFX_GAP[name] : 0.02;
      if (this.last[name] && now - this.last[name] < gap) return;
      this.last[name] = now;
      const p = opt.pitch || 1;
      switch (name) {
        case 'pulse':
          this.tone({ f0: 880 * p, f1: 300 * p, type: 'square', dur: 0.09, gain: 0.055, filter: 'highpass', cutoff: 500, pan: opt.pan || 0 });
          this.tone({ f0: 1400 * p, f1: 700 * p, type: 'triangle', dur: 0.06, gain: 0.04 });
          break;
        case 'orbit':
          this.tone({ f0: 220, f1: 320, type: 'sawtooth', dur: 0.07, gain: 0.03, filter: 'lowpass', cutoff: 1400 });
          break;
        case 'nova':
          this.noise({ dur: 0.42, gain: 0.13, freq: 900, freq2: 120, filter: 'lowpass', verb: 0.25 });
          this.tone({ f0: 130, f1: 42, type: 'sine', dur: 0.45, gain: 0.18 });
          break;
        case 'seek':
          this.tone({ f0: 300 * p, f1: 900 * p, type: 'sawtooth', dur: 0.14, gain: 0.045, filter: 'bandpass', cutoff: 1200, q: 2 });
          break;
        case 'blast':
          this.noise({ dur: 0.22, gain: 0.09, freq: 1800, freq2: 200 });
          break;
        case 'arc':
          this.noise({ dur: 0.12, gain: 0.06, freq: 4200, freq2: 900, filter: 'highpass', q: 0.6 });
          this.tone({ f0: 1600 * p, f1: 240, type: 'square', dur: 0.1, gain: 0.035, filter: 'highpass', cutoff: 900 });
          break;
        case 'prism':
          this.tone({ f0: 1200 * p, f1: 480 * p, type: 'triangle', dur: 0.12, gain: 0.05 });
          this.noise({ dur: 0.08, gain: 0.04, freq: 5200, filter: 'highpass' });
          break;
        case 'hit':
          this.tone({ f0: 1500, f1: 700, type: 'triangle', dur: 0.035, gain: 0.028 });
          break;
        case 'kill':
          this.noise({ dur: 0.13, gain: 0.07, freq: 1400, freq2: 260 });
          this.tone({ f0: 260 * p, f1: 120, type: 'sine', dur: 0.12, gain: 0.05 });
          break;
        case 'pickup':
          this.tone({ f0: 900 * p, f1: 1500 * p, type: 'sine', dur: 0.09, gain: 0.045 });
          break;
        case 'levelup':
          [523.25, 659.25, 783.99, 1046.5].forEach((f, i) => {
            this.tone({ f0: f, type: 'triangle', dur: 0.34, gain: 0.1, delay: i * 0.075, verb: 0.4 });
          });
          break;
        case 'evolve':
          [261.63, 392, 523.25, 659.25, 1046.5].forEach((f, i) => {
            this.tone({ f0: f, f1: f * 1.01, type: 'sawtooth', dur: 0.7, gain: 0.07, delay: i * 0.09, filter: 'lowpass', cutoff: 2600, verb: 0.6 });
          });
          this.noise({ dur: 0.7, gain: 0.1, freq: 300, freq2: 5000, filter: 'bandpass', verb: 0.5 });
          break;
        case 'dash':
          this.noise({ dur: 0.18, gain: 0.07, freq: 300, freq2: 2600, filter: 'bandpass', q: 1.2 });
          break;
        case 'hurt':
          this.tone({ f0: 190, f1: 60, type: 'sawtooth', dur: 0.32, gain: 0.16, filter: 'lowpass', cutoff: 700 });
          this.noise({ dur: 0.3, gain: 0.1, freq: 700, freq2: 120 });
          break;
        case 'explosion':
          this.noise({ dur: 0.6, gain: 0.16, freq: 1000, freq2: 60, verb: 0.35 });
          this.tone({ f0: 90, f1: 30, type: 'sine', dur: 0.55, gain: 0.16 });
          break;
        case 'roar':
          this.tone({ f0: 78, f1: 48, type: 'sawtooth', dur: 1.5, gain: 0.14, filter: 'lowpass', cutoff: 420, verb: 0.7 });
          this.noise({ dur: 1.4, gain: 0.12, freq: 260, freq2: 900, filter: 'bandpass', q: 0.8, verb: 0.8 });
          break;
        case 'bossdie':
          this.noise({ dur: 1.8, gain: 0.2, freq: 700, freq2: 40, verb: 0.8 });
          [110, 146.83, 174.61, 220].forEach((f, i) => {
            this.tone({ f0: f, f1: f * 0.5, type: 'sawtooth', dur: 1.6, gain: 0.1, delay: i * 0.12, filter: 'lowpass', cutoff: 800, verb: 0.6 });
          });
          break;
        case 'ui':
          this.tone({ f0: 720, f1: 980, type: 'triangle', dur: 0.07, gain: 0.045 });
          break;
        case 'hover':
          this.tone({ f0: 520, type: 'sine', dur: 0.04, gain: 0.018 });
          break;
        case 'deny':
          this.tone({ f0: 220, f1: 160, type: 'square', dur: 0.16, gain: 0.05, filter: 'lowpass', cutoff: 900 });
          break;
        case 'revive':
          [196, 261.63, 329.63, 392, 523.25].forEach((f, i) => {
            this.tone({ f0: f, type: 'sine', dur: 1.1, gain: 0.1, delay: i * 0.1, verb: 0.8 });
          });
          break;
        case 'victory':
          [392, 523.25, 659.25, 783.99, 1046.5].forEach((f, i) => {
            this.tone({ f0: f, type: 'triangle', dur: 1.4, gain: 0.11, delay: i * 0.14, verb: 0.8 });
          });
          break;
        case 'warn':
          this.tone({ f0: 120, f1: 90, type: 'sawtooth', dur: 0.5, gain: 0.1, filter: 'lowpass', cutoff: 500, verb: 0.4 });
          break;
      }
    },

    SFX_GAP: {
      pulse: 0.055, hit: 0.035, kill: 0.035, pickup: 0.03, orbit: 0.09,
      blast: 0.05, arc: 0.09, prism: 0.06, seek: 0.06
    },

    /* ---------- 生成式配乐 ---------- */
    startMusic: function () {
      if (!this.ready || this._timer) return;
      const self = this;
      this._next = this.ctx.currentTime + 0.15;
      this._step = 0;
      this._timer = setInterval(function () { self._schedule(); }, 40);
    },

    stopMusic: function () {
      if (this._timer) { clearInterval(this._timer); this._timer = null; }
    },

    _schedule: function () {
      if (!this.ctx || this.ctx.state === 'suspended') return;
      const spb = 60 / 92;          // 每拍
      const stepDur = spb / 2;      // 八分音符
      // 长时间切后台后，跳过积压的节拍，避免一次性补上千个音符
      if (this._next < this.ctx.currentTime - 0.5) this._next = this.ctx.currentTime + 0.08;
      while (this._next < this.ctx.currentTime + 0.18) {
        this._playStep(this._step, this._next, stepDur, spb);
        this._next += stepDur;
        this._step++;
      }
    },

    _playStep: function (step, t, stepDur, spb) {
      const ctx = this.ctx;
      const muted = this.muted;
      const intensity = this.intensity;
      if (muted) return;

      // 和弦进行：Dm - Bb - F - C （每两小节换）
      const bar = Math.floor(step / 8) % 4;
      const chords = [
        [146.83, 174.61, 220.0],   // Dm
        [116.54, 146.83, 174.61],  // Bb
        [130.81, 174.61, 220.0],   // F
        [130.81, 164.81, 196.0]    // C
      ];
      const chord = chords[bar];
      const inBar = step % 8;

      const bus = this.musicBus;

      // Pad：每小节第一拍铺和弦
      if (inBar === 0) {
        chord.forEach(function (f, i) {
          const osc = ctx.createOscillator();
          const gainNode = ctx.createGain();
          const filt = ctx.createBiquadFilter();
          osc.type = 'sawtooth';
          osc.frequency.value = f * (i === 0 ? 0.5 : 1);
          filt.type = 'lowpass';
          filt.frequency.setValueAtTime(380 + intensity * 700, t);
          filt.Q.value = 0.6;
          osc.connect(filt); filt.connect(gainNode); gainNode.connect(bus);
          gainNode.gain.setValueAtTime(0.0001, t);
          gainNode.gain.linearRampToValueAtTime(0.018 + intensity * 0.01, t + spb * 0.7);
          gainNode.gain.linearRampToValueAtTime(0.0001, t + spb * 3.9);
          osc.start(t); osc.stop(t + spb * 4);
        });
      }

      // 低音
      if (inBar === 0 || inBar === 3 || inBar === 5) {
        const f = chord[0] * (inBar === 5 ? 1 : 0.5);
        const osc = ctx.createOscillator();
        const gainNode = ctx.createGain();
        osc.type = 'triangle';
        osc.frequency.value = f;
        osc.connect(gainNode); gainNode.connect(bus);
        gainNode.gain.setValueAtTime(0.0001, t);
        gainNode.gain.exponentialRampToValueAtTime(0.055, t + 0.015);
        gainNode.gain.exponentialRampToValueAtTime(0.0001, t + stepDur * 1.5);
        osc.start(t); osc.stop(t + stepDur * 1.6);
      }

      // 琶音
      if (intensity > 0.12 && (inBar % 2 === 0 || intensity > 0.55)) {
        const seq = [0, 1, 2, 1, 2, 0, 1, 2];
        const f = chord[seq[inBar % 8]] * 2;
        const osc = ctx.createOscillator();
        const gainNode = ctx.createGain();
        const filt = ctx.createBiquadFilter();
        osc.type = 'square';
        osc.frequency.value = f;
        filt.type = 'bandpass';
        filt.frequency.value = 1400;
        filt.Q.value = 1.2;
        osc.connect(filt); filt.connect(gainNode); gainNode.connect(bus);
        gainNode.gain.setValueAtTime(0.0001, t);
        gainNode.gain.exponentialRampToValueAtTime(0.012 + intensity * 0.014, t + 0.01);
        gainNode.gain.exponentialRampToValueAtTime(0.0001, t + 0.16);
        osc.start(t); osc.stop(t + 0.18);
      }

      // 鼓
      if (intensity > 0.28 && (inBar === 0 || inBar === 4)) this._kick(t);
      if (intensity > 0.5 && (inBar === 2 || inBar === 6)) this._hat(t, 0.5);
      if (intensity > 0.72 && inBar % 2 === 1) this._hat(t, 0.25);
    },

    verbRef: function () { return this.verb; },

    _kick: function (t) {
      const ctx = this.ctx;
      const osc = ctx.createOscillator();
      const gainNode = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(120, t);
      osc.frequency.exponentialRampToValueAtTime(40, t + 0.16);
      osc.connect(gainNode); gainNode.connect(this.musicBus);
      gainNode.gain.setValueAtTime(0.11, t);
      gainNode.gain.exponentialRampToValueAtTime(0.0001, t + 0.22);
      osc.start(t); osc.stop(t + 0.24);
    },

    _hat: function (t, gv) {
      const ctx = this.ctx;
      const len = Math.floor(ctx.sampleRate * 0.05);
      const buf = ctx.createBuffer(1, len, ctx.sampleRate);
      const d = buf.getChannelData(0);
      for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
      const src = ctx.createBufferSource();
      src.buffer = buf;
      const filt = ctx.createBiquadFilter();
      filt.type = 'highpass';
      filt.frequency.value = 7000;
      const gainNode = ctx.createGain();
      gainNode.gain.setValueAtTime(0.04 * gv, t);
      gainNode.gain.exponentialRampToValueAtTime(0.0001, t + 0.05);
      src.connect(filt); filt.connect(gainNode); gainNode.connect(this.musicBus);
      src.start(t);
    }
  };

  AE.Audio = Audio;
})(typeof window !== 'undefined' ? window : globalThis);
