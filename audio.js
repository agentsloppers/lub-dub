// Lub-Dub audio: all sound + music synthesized with Web Audio.
const Au = {
  ac: null, bpm: 96, spb: 60 / 96, anchorT: 0, anchorStep: 0, nextStep: 0, nextT: 0,
  level: 0, muted: false, started: false, sfxAt: {},
  CH: [[45, 0, 3, 7], [41, 0, 4, 7], [48, 0, 4, 7], [43, 0, 4, 7]], // root + minor/major-ish intervals
  PENT: [57, 60, 64, 67, 69, 72, 76, 79, 81, 84],
  mtof: m => 440 * Math.pow(2, (m - 69) / 12),
  init() {
    if (this.ac) { if (this.ac.state === 'suspended') this.ac.resume(); return; }
    const ac = this.ac = new (window.AudioContext || window.webkitAudioContext)();
    this.master = ac.createGain(); this.master.gain.value = this.muted ? 0 : 0.8;
    const comp = ac.createDynamicsCompressor(); comp.threshold.value = -14; comp.ratio.value = 4;
    this.master.connect(comp); comp.connect(ac.destination);
    this.music = ac.createGain(); this.music.gain.value = 0.9; this.music.connect(this.master);
    this.sfx = ac.createGain(); this.sfx.gain.value = 0.9; this.sfx.connect(this.master);
    // cheap reverb: decaying noise impulse
    const len = ac.sampleRate * 1.6, buf = ac.createBuffer(2, len, ac.sampleRate);
    for (let c = 0; c < 2; c++) { const d = buf.getChannelData(c); for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 3); }
    this.rev = ac.createConvolver(); this.rev.buffer = buf;
    this.revG = ac.createGain(); this.revG.gain.value = 0.35; this.rev.connect(this.revG); this.revG.connect(this.master);
    // noise buffer
    const nb = ac.createBuffer(1, ac.sampleRate, ac.sampleRate), nd = nb.getChannelData(0);
    for (let i = 0; i < nd.length; i++) nd[i] = Math.random() * 2 - 1;
    this.nbuf = nb;
    this.anchorT = ac.currentTime + 0.25; this.anchorStep = 0; this.nextStep = 0; this.nextT = this.anchorT;
    this.timer = setInterval(() => this.pump(), 25);
    this.started = true;
  },
  setMuted(m) { this.muted = m; if (this.master) this.master.gain.setTargetAtTime(m ? 0 : 0.8, this.ac.currentTime, 0.05); },
  setTempo(bpm) { // takes effect at the next unscheduled step so the grid stays continuous
    if (!this.ac) { this.bpm = bpm; this.spb = 60 / bpm; return; }
    this.anchorT = this.nextT; this.anchorStep = this.nextStep; this.bpm = bpm; this.spb = 60 / bpm;
  },
  beatPos(t) { return this.anchorStep / 4 + (t - this.anchorT) / this.spb; },
  now() { return this.ac ? this.ac.currentTime : 0; },
  latency() { return this.ac ? (this.ac.outputLatency || 0) + (this.ac.baseLatency || 0) : 0; },
  pump() {
    const ac = this.ac; if (!ac || ac.state !== 'running') return;
    while (this.nextT < ac.currentTime + 0.14) {
      this.step(this.nextStep, this.nextT);
      this.nextStep++; this.nextT += this.spb / 4;
    }
  },
  // --- primitives ---
  osc(type, f, t, dur, vol, o = {}) {
    const ac = this.ac, os = ac.createOscillator(), g = ac.createGain();
    os.type = type; os.frequency.setValueAtTime(f, t);
    if (o.to) os.frequency.exponentialRampToValueAtTime(o.to, t + dur);
    const a = o.a || 0.004;
    g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(vol, t + a);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    let n = os;
    if (o.lp) { const fl = ac.createBiquadFilter(); fl.type = 'lowpass'; fl.frequency.setValueAtTime(o.lp, t); if (o.lpTo) fl.frequency.exponentialRampToValueAtTime(o.lpTo, t + dur); os.connect(fl); n = fl; }
    n.connect(g); g.connect(o.dest || this.sfx);
    if (o.rev) { const rg = ac.createGain(); rg.gain.value = o.rev; g.connect(rg); rg.connect(this.rev); }
    os.start(t); os.stop(t + dur + 0.05);
  },
  noise(t, dur, vol, o = {}) {
    const ac = this.ac, s = ac.createBufferSource(), g = ac.createGain(), f = ac.createBiquadFilter();
    s.buffer = this.nbuf; f.type = o.type || 'highpass'; f.frequency.setValueAtTime(o.f || 6000, t);
    if (o.fTo) f.frequency.exponentialRampToValueAtTime(o.fTo, t + dur);
    g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    s.connect(f); f.connect(g); g.connect(o.dest || this.sfx); s.start(t, Math.random() * 0.5); s.stop(t + dur + 0.05);
  },
  // --- music ---
  step(n, t) {
    const s = n % 16, bar = Math.floor(n / 16), ch = this.CH[bar % 4], L = this.level, M = this.music;
    if (s % 4 === 0) { // lub-dub kick
      this.osc('sine', 140, t, 0.16, 0.95, { to: 42, dest: M });
      this.osc('sine', 95, t + 0.15, 0.13, 0.45, { to: 40, dest: M });
    }
    if (L >= 1 && s % 4 === 2) this.noise(t, 0.05, 0.12, { f: 8000, dest: M });
    if (L >= 3 && s % 2 === 1) this.noise(t, 0.03, 0.06, { f: 9000, dest: M });
    if (L >= 2 && (s === 4 || s === 12)) this.noise(t, 0.12, 0.14, { type: 'bandpass', f: 1800, dest: M });
    // bass
    const bp = [0, 3, 6, 8, 10, 14];
    if (bp.includes(s) && (L >= 1 || s % 8 === 0)) {
      const m = ch[0] + (s === 14 ? 12 : 0);
      this.osc('sawtooth', this.mtof(m), t, this.spb * 0.35, 0.22, { lp: 500, lpTo: 140, dest: M });
    }
    // arp
    if (L >= 1) {
      const idx = [0, 1, 2, 3, 2, 1][s % 6 === 0 && s ? 0 : s % 6], note = ch[0] + 24 + ch[1 + (s * 5 % 3)] + (s % 8 === 7 ? 12 : 0);
      if (s % 2 === 0 || L >= 3) this.osc('triangle', this.mtof(note), t, this.spb * 0.5, 0.09 + 0.02 * L, { rev: 0.5, dest: M });
    }
    // pad
    if (s === 0) for (let i = 1; i < 4; i++) {
      this.osc('sawtooth', this.mtof(ch[0] + 24 + ch[i]), t, this.spb * 4, 0.035, { a: this.spb * 1.2, lp: 900, rev: 0.7, dest: M });
    }
  },
  // --- sfx (rate-limited per name) ---
  ok(name, gap) { const t = performance.now(); if ((this.sfxAt[name] || 0) + gap > t) return false; this.sfxAt[name] = t; return true; },
  pulse(q) { // q: 2 perfect, 1 good, 0 off
    if (!this.ac) return; const t = this.ac.currentTime;
    if (q === 2) {
      this.osc('sine', 300, t, 0.5, 0.5, { to: 1200, rev: 0.6 });
      this.osc('triangle', 150, t, 0.35, 0.4, { to: 600 });
      this.noise(t, 0.3, 0.25, { f: 2000, fTo: 9000 });
    } else if (q === 1) {
      this.osc('sine', 260, t, 0.3, 0.4, { to: 700, rev: 0.3 });
    } else this.osc('square', 120, t, 0.12, 0.18, { to: 70, lp: 600 });
  },
  kill(i = 0) {
    if (!this.ac || !this.ok('kill', 35)) return; const t = this.ac.currentTime;
    const m = this.PENT[Math.min(this.PENT.length - 1, i % this.PENT.length)];
    this.osc('square', this.mtof(m), t, 0.14, 0.12, { lp: 3000, rev: 0.4 });
    this.noise(t, 0.06, 0.12, { f: 3000 });
  },
  hurt() {
    if (!this.ac) return; const t = this.ac.currentTime;
    this.osc('sawtooth', 110, t, 0.6, 0.5, { to: 35, lp: 800, lpTo: 80 });
    this.noise(t, 0.5, 0.4, { type: 'lowpass', f: 3000, fTo: 100 });
  },
  deflect() { if (!this.ac || !this.ok('def', 60)) return; this.osc('triangle', 1800, this.ac.currentTime, 0.1, 0.15, { to: 900 }); },
  card() { if (!this.ac) return; const t = this.ac.currentTime; [0, 4, 7, 12].forEach((s, i) => this.osc('triangle', this.mtof(69 + s), t + i * 0.06, 0.35, 0.2, { rev: 0.6 })); },
  tick() { if (!this.ac || !this.ok('tick', 40)) return; this.osc('sine', 880, this.ac.currentTime, 0.06, 0.12); },
  over() { if (!this.ac) return; const t = this.ac.currentTime; [0, -3, -5, -8, -12].forEach((s, i) => this.osc('sawtooth', this.mtof(60 + s), t + i * 0.18, 0.5, 0.2, { lp: 900, rev: 0.7 })); },
  boss() { if (!this.ac) return; const t = this.ac.currentTime; this.osc('sawtooth', 60, t, 1.4, 0.5, { to: 30, lp: 400 }); this.noise(t, 1, 0.3, { type: 'lowpass', f: 800, fTo: 60 }); },
  wave() { if (!this.ac) return; const t = this.ac.currentTime; [0, 7, 12, 19].forEach((s, i) => this.osc('square', this.mtof(60 + s), t + i * 0.07, 0.25, 0.1, { lp: 2500, rev: 0.5 })); }
};
