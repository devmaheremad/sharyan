// Synthesised sound design (Web Audio API). No audio files, nothing plays before a user click.

let ctx = null;
let master = null;
let enabled = false;
let noiseBuf = null;
let drone = null;
const listeners = new Set();

function makeNoise(c) {
  const len = c.sampleRate * 2;
  const buf = c.createBuffer(1, len, c.sampleRate);
  const d = buf.getChannelData(0);
  // Seeded LCG so the texture is identical on every load.
  let s = 1234567;
  for (let i = 0; i < len; i++) {
    s = (s * 1664525 + 1013904223) >>> 0;
    d[i] = (s / 4294967296) * 2 - 1;
  }
  return buf;
}

function ensure() {
  if (ctx) return ctx;
  const AC = window.AudioContext || window.webkitAudioContext;
  if (!AC) return null;
  ctx = new AC();
  const comp = ctx.createDynamicsCompressor();
  comp.threshold.value = -14;
  comp.knee.value = 12;
  comp.ratio.value = 5;
  comp.attack.value = 0.003;
  comp.release.value = 0.2;
  master = ctx.createGain();
  master.gain.value = 0;
  master.connect(comp).connect(ctx.destination);
  noiseBuf = makeNoise(ctx);
  return ctx;
}

function noiseSrc() {
  const n = ctx.createBufferSource();
  n.buffer = noiseBuf;
  n.loop = true;
  return n;
}

function env(gainNode, t, attack, peak, decay, sustain = 0.0001) {
  const g = gainNode.gain;
  g.cancelScheduledValues(t);
  g.setValueAtTime(0.0001, t);
  g.exponentialRampToValueAtTime(peak, t + attack);
  g.exponentialRampToValueAtTime(sustain, t + attack + decay);
}

function distCurve(amount) {
  const n = 1024;
  const curve = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    const x = (i * 2) / n - 1;
    curve[i] = ((3 + amount) * x * 20 * (Math.PI / 180)) / (Math.PI + amount * Math.abs(x));
  }
  return curve;
}

function ok() {
  return enabled && ctx && ctx.state === 'running';
}

export const sound = {
  get enabled() { return enabled; },

  onChange(fn) { listeners.add(fn); },

  async enable() {
    if (!ensure()) return false;
    if (ctx.state !== 'running') await ctx.resume();
    enabled = true;
    master.gain.cancelScheduledValues(ctx.currentTime);
    master.gain.setTargetAtTime(0.9, ctx.currentTime, 0.05);
    this.startDrone();
    listeners.forEach((fn) => fn(true));
    return true;
  },

  disable() {
    enabled = false;
    if (ctx) master.gain.setTargetAtTime(0, ctx.currentTime, 0.05);
    listeners.forEach((fn) => fn(false));
  },

  toggle() { return enabled ? (this.disable(), false) : this.enable(); },

  // Low pad that sits under everything; filter opens with scroll speed.
  startDrone() {
    if (drone || !ctx) return;
    const t = ctx.currentTime;
    const g = ctx.createGain();
    g.gain.value = 0;
    const lp = ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.value = 220;
    lp.Q.value = 6;
    const o1 = ctx.createOscillator();
    const o2 = ctx.createOscillator();
    const o3 = ctx.createOscillator();
    o1.type = 'sawtooth'; o1.frequency.value = 55;
    o2.type = 'sawtooth'; o2.frequency.value = 55.4;
    o3.type = 'sine'; o3.frequency.value = 27.5;
    const lfo = ctx.createOscillator();
    const lfoGain = ctx.createGain();
    lfo.frequency.value = 0.08;
    lfoGain.gain.value = 60;
    lfo.connect(lfoGain).connect(lp.frequency);
    o1.connect(lp); o2.connect(lp); o3.connect(lp);
    lp.connect(g).connect(master);
    [o1, o2, o3, lfo].forEach((o) => o.start(t));
    g.gain.setTargetAtTime(0.05, t, 1.5);
    drone = { g, lp };
  },

  // 0..1 energy from scroll velocity: opens the drone filter.
  energy(v) {
    if (!drone || !ctx) return;
    const f = 200 + Math.min(1, v) * 900;
    drone.lp.frequency.setTargetAtTime(f, ctx.currentTime, 0.25);
  },

  tick(level = 1) {
    if (!ok()) return;
    const t = ctx.currentTime;
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.type = 'square';
    o.frequency.value = 1900 + level * 120;
    env(g, t, 0.001, 0.05, 0.03);
    o.connect(g).connect(master);
    o.start(t); o.stop(t + 0.06);
  },

  // Gear change: mechanical clunk + short throttle blip.
  shift() {
    if (!ok()) return;
    const t = ctx.currentTime;
    const n = noiseSrc();
    const bp = ctx.createBiquadFilter();
    bp.type = 'bandpass'; bp.frequency.value = 1400; bp.Q.value = 1.4;
    const g = ctx.createGain();
    env(g, t, 0.002, 0.55, 0.07);
    n.connect(bp).connect(g).connect(master);
    n.start(t); n.stop(t + 0.12);
    const o = ctx.createOscillator();
    const og = ctx.createGain();
    o.type = 'sine';
    o.frequency.setValueAtTime(140, t);
    o.frequency.exponentialRampToValueAtTime(60, t + 0.12);
    env(og, t, 0.002, 0.7, 0.14);
    o.connect(og).connect(master);
    o.start(t); o.stop(t + 0.2);
    this.rev(0.45, 70, 150, 0.35, t + 0.08);
  },

  // Engine rev: detuned saws + square sub through a waveshaper, pitch rising.
  rev(duration = 1.4, from = 45, to = 190, vol = 0.5, when) {
    if (!ok()) return;
    const t = when ?? ctx.currentTime;
    const shaper = ctx.createWaveShaper();
    shaper.curve = distCurve(40);
    shaper.oversample = '4x';
    const lp = ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.setValueAtTime(500, t);
    lp.frequency.exponentialRampToValueAtTime(3200, t + duration * 0.85);
    lp.Q.value = 3;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(vol, t + 0.08);
    g.gain.setValueAtTime(vol, t + duration * 0.75);
    g.gain.exponentialRampToValueAtTime(0.0001, t + duration);
    const oscs = [
      ['sawtooth', 1], ['sawtooth', 1.012], ['square', 0.5],
    ].map(([type, mul]) => {
      const o = ctx.createOscillator();
      o.type = type;
      o.frequency.setValueAtTime(from * mul, t);
      o.frequency.exponentialRampToValueAtTime(to * mul, t + duration * 0.8);
      o.connect(shaper);
      return o;
    });
    // Firing pulses: amplitude modulation at the cylinder rate.
    const am = ctx.createGain();
    const lfo = ctx.createOscillator();
    const lfoG = ctx.createGain();
    lfo.type = 'square';
    lfo.frequency.setValueAtTime(from / 2, t);
    lfo.frequency.exponentialRampToValueAtTime(to / 2, t + duration * 0.8);
    lfoG.gain.value = 0.35;
    am.gain.value = 0.65;
    lfo.connect(lfoG).connect(am.gain);
    shaper.connect(lp).connect(am).connect(g).connect(master);
    oscs.forEach((o) => { o.start(t); o.stop(t + duration + 0.05); });
    lfo.start(t); lfo.stop(t + duration + 0.05);
    // Intake hiss.
    const n = noiseSrc();
    const bp = ctx.createBiquadFilter();
    bp.type = 'bandpass';
    bp.frequency.setValueAtTime(800, t);
    bp.frequency.exponentialRampToValueAtTime(4000, t + duration);
    const ng = ctx.createGain();
    ng.gain.setValueAtTime(0.0001, t);
    ng.gain.exponentialRampToValueAtTime(vol * 0.25, t + duration * 0.6);
    ng.gain.exponentialRampToValueAtTime(0.0001, t + duration);
    n.connect(bp).connect(ng).connect(master);
    n.start(t); n.stop(t + duration + 0.05);
  },

  // The break: whip crack + glass grit + sub drop.
  crack(vol = 1) {
    if (!ok()) return;
    const t = ctx.currentTime;
    const out = ctx.createGain();
    out.gain.value = vol;
    out.connect(master);
    const n = noiseSrc();
    const hp = ctx.createBiquadFilter();
    hp.type = 'highpass'; hp.frequency.value = 2200;
    const g = ctx.createGain();
    env(g, t, 0.001, 1.0, 0.16);
    n.connect(hp).connect(g).connect(out);
    n.start(t); n.stop(t + 0.25);
    for (let i = 0; i < 5; i++) {
      const tt = t + 0.02 + i * 0.023;
      const o = ctx.createOscillator();
      const og = ctx.createGain();
      o.type = 'triangle';
      o.frequency.value = 3200 + i * 900;
      env(og, tt, 0.001, 0.18, 0.04);
      o.connect(og).connect(out);
      o.start(tt); o.stop(tt + 0.06);
    }
    const sub = ctx.createOscillator();
    const sg = ctx.createGain();
    sub.type = 'sine';
    sub.frequency.setValueAtTime(90, t);
    sub.frequency.exponentialRampToValueAtTime(32, t + 0.7);
    env(sg, t, 0.004, 1.0, 0.8);
    sub.connect(sg).connect(out);
    sub.start(t); sub.stop(t + 0.9);
  },

  // Falcon cry: FM-ish glide with fast vibrato.
  screech() {
    if (!ok()) return;
    const t = ctx.currentTime;
    const o = ctx.createOscillator();
    const vib = ctx.createOscillator();
    const vibG = ctx.createGain();
    const g = ctx.createGain();
    const bp = ctx.createBiquadFilter();
    o.type = 'sawtooth';
    o.frequency.setValueAtTime(2600, t);
    o.frequency.exponentialRampToValueAtTime(3100, t + 0.12);
    o.frequency.exponentialRampToValueAtTime(1500, t + 0.75);
    vib.frequency.value = 34;
    vibG.gain.value = 180;
    vib.connect(vibG).connect(o.frequency);
    bp.type = 'bandpass'; bp.frequency.value = 2400; bp.Q.value = 2.5;
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(0.22, t + 0.04);
    g.gain.setValueAtTime(0.22, t + 0.3);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.8);
    o.connect(bp).connect(g).connect(master);
    [o, vib].forEach((x) => { x.start(t); x.stop(t + 0.85); });
  },

  // Air rush.
  whoosh(duration = 0.7, vol = 0.4) {
    if (!ok()) return;
    const t = ctx.currentTime;
    const n = noiseSrc();
    const bp = ctx.createBiquadFilter();
    bp.type = 'bandpass'; bp.Q.value = 0.9;
    bp.frequency.setValueAtTime(300, t);
    bp.frequency.exponentialRampToValueAtTime(3500, t + duration * 0.7);
    bp.frequency.exponentialRampToValueAtTime(900, t + duration);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(vol, t + duration * 0.6);
    g.gain.exponentialRampToValueAtTime(0.0001, t + duration);
    n.connect(bp).connect(g).connect(master);
    n.start(t); n.stop(t + duration + 0.05);
  },

  // Target hit: bell, one step higher per target. n = 1, 2, 3.
  target(n = 1, level = 1) {
    if (!ok()) return;
    const t = ctx.currentTime;
    const base = [0, 1318.5, 1568, 1975.5][n] || 1318.5;
    [[1, 0.32], [2.01, 0.12], [3.0, 0.06]].forEach(([mul, vol]) => {
      const o = ctx.createOscillator();
      const g = ctx.createGain();
      o.type = 'sine';
      o.frequency.value = base * mul;
      env(g, t, 0.002, vol * level, 1.3);
      o.connect(g).connect(master);
      o.start(t); o.stop(t + 1.4);
    });
    if (n === 3) {
      // Cash shimmer on the last target.
      const nn = noiseSrc();
      const hp = ctx.createBiquadFilter();
      hp.type = 'highpass'; hp.frequency.value = 6500;
      const g = ctx.createGain();
      for (let i = 0; i < 4; i++) {
        const tt = t + 0.05 + i * 0.07;
        g.gain.setValueAtTime(0.0001, tt);
        g.gain.exponentialRampToValueAtTime(0.25, tt + 0.005);
        g.gain.exponentialRampToValueAtTime(0.0001, tt + 0.06);
      }
      nn.connect(hp).connect(g).connect(master);
      nn.start(t); nn.stop(t + 0.5);
    }
  },

  // Deep impact for big reveals.
  boom() {
    if (!ok()) return;
    const t = ctx.currentTime;
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.type = 'sine';
    o.frequency.setValueAtTime(70, t);
    o.frequency.exponentialRampToValueAtTime(28, t + 1.1);
    env(g, t, 0.005, 1.0, 1.2);
    o.connect(g).connect(master);
    o.start(t); o.stop(t + 1.3);
    const n = noiseSrc();
    const lp = ctx.createBiquadFilter();
    lp.type = 'lowpass'; lp.frequency.value = 400;
    const ng = ctx.createGain();
    env(ng, t, 0.003, 0.5, 0.4);
    n.connect(lp).connect(ng).connect(master);
    n.start(t); n.stop(t + 0.5);
  },
};
