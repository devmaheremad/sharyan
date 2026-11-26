// Synthesised sound design (Web Audio API). No audio files.
// The page tries to start sound on its own; if the browser blocks it, the first click / tap anywhere starts it,
// unless the visitor chose "off" (remembered in localStorage).

const PREF_KEY = 'sharyan.sound';

let ctx = null;
let master = null;   // everything ends here
let fxBus = null;    // effects
let musicBus = null; // background pad
let musicTone = null;
let reverbIn = null;
let noiseBuf = null;
let enabled = false;
let musicTimer = 0;
let nextChordAt = 0;
let chordIndex = 0;
const listeners = new Set();

// ---------- preference ----------
export function readPref(key = PREF_KEY) {
  try { return window.localStorage.getItem(key); } catch (e) { return null; }
}
export function writePref(value, key = PREF_KEY) {
  try { window.localStorage.setItem(key, value); } catch (e) { /* private mode: not remembered */ }
}

// ---------- graph ----------
function seeded(seed) {
  let s = seed >>> 0;
  return () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; };
}

function makeNoise(c) {
  const len = c.sampleRate * 2;
  const buf = c.createBuffer(1, len, c.sampleRate);
  const d = buf.getChannelData(0);
  const r = seeded(1234567);
  for (let i = 0; i < len; i++) d[i] = r() * 2 - 1;
  return buf;
}

// Soft hall: stereo noise with an exponential tail.
function makeImpulse(c, seconds = 3.2, decay = 3.4) {
  const len = Math.floor(c.sampleRate * seconds);
  const buf = c.createBuffer(2, len, c.sampleRate);
  for (let ch = 0; ch < 2; ch++) {
    const d = buf.getChannelData(ch);
    const r = seeded(99 + ch);
    for (let i = 0; i < len; i++) d[i] = (r() * 2 - 1) * Math.pow(1 - i / len, decay);
  }
  return buf;
}

function ensure() {
  if (ctx) return ctx;
  const AC = window.AudioContext || window.webkitAudioContext;
  if (!AC) return null;
  ctx = new AC();
  const comp = ctx.createDynamicsCompressor();
  comp.threshold.value = -16; comp.knee.value = 14; comp.ratio.value = 4;
  comp.attack.value = 0.004; comp.release.value = 0.25;
  master = ctx.createGain();
  master.gain.value = 0;
  master.connect(comp).connect(ctx.destination);

  const conv = ctx.createConvolver();
  conv.buffer = makeImpulse(ctx);
  const wet = ctx.createGain();
  wet.gain.value = 0.55;
  reverbIn = ctx.createGain();
  reverbIn.connect(conv).connect(wet).connect(master);

  fxBus = ctx.createGain();
  fxBus.gain.value = 0.85;
  fxBus.connect(master);
  const fxSend = ctx.createGain();
  fxSend.gain.value = 0.16;
  fxBus.connect(fxSend).connect(reverbIn);

  musicTone = ctx.createBiquadFilter();
  musicTone.type = 'lowpass';
  musicTone.frequency.value = 1100;
  musicTone.Q.value = 0.4;
  musicBus = ctx.createGain();
  musicBus.gain.value = 0;
  musicTone.connect(musicBus);
  musicBus.connect(master);
  const musicSend = ctx.createGain();
  musicSend.gain.value = 0.7;
  musicBus.connect(musicSend).connect(reverbIn);

  noiseBuf = makeNoise(ctx);
  document.addEventListener('visibilitychange', () => {
    if (!ctx) return;
    if (document.hidden) ctx.suspend();
    else if (enabled) ctx.resume();
  });
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
  g.exponentialRampToValueAtTime(Math.max(0.0002, peak), t + attack);
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

function tone(freq, t, { type = 'sine', attack = 0.003, peak = 0.2, decay = 0.4, out = fxBus, detune = 0 } = {}) {
  const o = ctx.createOscillator();
  const g = ctx.createGain();
  o.type = type;
  o.frequency.setValueAtTime(freq, t);
  o.detune.value = detune;
  env(g, t, attack, peak, decay);
  o.connect(g).connect(out);
  o.start(t); o.stop(t + attack + decay + 0.05);
  return o;
}

function burst(t, { type = 'highpass', freq = 2000, q = 0.7, peak = 0.4, decay = 0.1, out = fxBus } = {}) {
  const n = noiseSrc();
  const f = ctx.createBiquadFilter();
  f.type = type; f.frequency.value = freq; f.Q.value = q;
  const g = ctx.createGain();
  env(g, t, 0.002, peak, decay);
  n.connect(f).connect(g).connect(out);
  n.start(t); n.stop(t + decay + 0.05);
  return f;
}

const ok = () => enabled && ctx && ctx.state === 'running';

// ---------- background pad: slow warm chords through a big hall ----------
const CHORDS = [
  [110.0, 164.81, 196.0, 246.94, 261.63],   // Am9
  [87.31, 130.81, 164.81, 220.0, 329.63],   // Fmaj7
  [130.81, 196.0, 246.94, 293.66, 329.63],  // Cmaj9
  [98.0, 146.83, 164.81, 220.0, 246.94],    // G6/9
];
const CHORD_LEN = 7.5;

function playChord(freqs, t) {
  const attack = 3.2, hold = CHORD_LEN - 1.2, release = 4.5;
  freqs.forEach((f, i) => {
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(i === 0 ? 0.03 : 0.018, t + attack);
    g.gain.setValueAtTime(i === 0 ? 0.03 : 0.018, t + hold);
    g.gain.linearRampToValueAtTime(0.0001, t + hold + release);
    g.connect(musicTone);
    [[f, 'triangle', 0], [f, 'sine', 7], [f * 2, 'sine', -5]].forEach(([fr, type, det], k) => {
      const o = ctx.createOscillator();
      o.type = type;
      o.frequency.value = fr;
      o.detune.value = det;
      const og = ctx.createGain();
      og.gain.value = k === 2 ? 0.25 : 0.6;
      o.connect(og).connect(g);
      o.start(t); o.stop(t + hold + release + 0.1);
    });
  });
  // a quiet high shimmer on the top note
  const top = freqs[freqs.length - 1] * 2;
  const sh = ctx.createOscillator();
  const shg = ctx.createGain();
  const trem = ctx.createOscillator();
  const tremG = ctx.createGain();
  sh.type = 'sine'; sh.frequency.value = top;
  trem.frequency.value = 0.35; tremG.gain.value = 0.004;
  shg.gain.setValueAtTime(0.0001, t);
  shg.gain.linearRampToValueAtTime(0.006, t + attack + 1);
  shg.gain.linearRampToValueAtTime(0.0001, t + hold + release);
  trem.connect(tremG).connect(shg.gain);
  sh.connect(shg).connect(musicTone);
  [sh, trem].forEach((o) => { o.start(t); o.stop(t + hold + release + 0.1); });
}

function scheduleMusic() {
  if (!ctx || !enabled) return;
  while (nextChordAt < ctx.currentTime + 2) {
    playChord(CHORDS[chordIndex % CHORDS.length], Math.max(nextChordAt, ctx.currentTime + 0.05));
    nextChordAt = Math.max(nextChordAt, ctx.currentTime) + CHORD_LEN;
    chordIndex++;
  }
}

function startMusic() {
  if (musicTimer) return;
  nextChordAt = ctx.currentTime + 0.1;
  scheduleMusic();
  musicTimer = window.setInterval(scheduleMusic, 800);
  musicBus.gain.cancelScheduledValues(ctx.currentTime);
  musicBus.gain.setTargetAtTime(0.75, ctx.currentTime, 1.6);
}

function stopMusic() {
  window.clearInterval(musicTimer);
  musicTimer = 0;
  if (ctx) musicBus.gain.setTargetAtTime(0, ctx.currentTime, 0.3);
}

// ---------- public API ----------
export const sound = {
  get enabled() { return enabled; },
  get pref() { return readPref(); },
  onChange(fn) { listeners.add(fn); },

  // Try to start without a click. Resolves true when the browser allowed it.
  async tryAutoplay() {
    if (!ensure()) return false;
    try {
      await Promise.race([ctx.resume(), new Promise((r) => setTimeout(r, 250))]);
    } catch (e) { /* blocked */ }
    if (ctx.state === 'running') { this._on(); return true; }
    return false;
  },

  // From a user gesture.
  async enable() {
    if (!ensure()) return false;
    try { await ctx.resume(); } catch (e) { return false; }
    if (ctx.state !== 'running') return false;
    this._on();
    return true;
  },

  _on() {
    if (enabled) return;
    enabled = true;
    master.gain.cancelScheduledValues(ctx.currentTime);
    master.gain.setTargetAtTime(0.9, ctx.currentTime, 0.08);
    startMusic();
    listeners.forEach((fn) => fn(true));
  },

  disable() {
    enabled = false;
    stopMusic();
    if (ctx) master.gain.setTargetAtTime(0, ctx.currentTime, 0.06);
    listeners.forEach((fn) => fn(false));
  },

  // 0..1 scroll energy opens the pad a little.
  energy(v) {
    if (!ctx || !enabled) return;
    musicTone.frequency.setTargetAtTime(1000 + Math.min(1, v) * 1600, ctx.currentTime, 0.4);
  },

  // ---------- UI ----------
  tick(level = 1) {
    if (!ok()) return;
    tone(1700 + level * 140, ctx.currentTime, { type: 'triangle', peak: 0.045, decay: 0.035 });
  },

  chime() {
    if (!ok()) return;
    const t = ctx.currentTime;
    tone(1318.5, t, { peak: 0.12, decay: 0.9 });
    tone(1975.5, t + 0.09, { peak: 0.1, decay: 1.1 });
  },

  // Loader: a soft clock tick that climbs with progress (0..1).
  introTick(p) {
    if (!ok()) return;
    const t = ctx.currentTime;
    tone(900 + p * 900, t, { type: 'sine', peak: 0.05, decay: 0.05 });
    burst(t, { type: 'bandpass', freq: 3000 + p * 2000, q: 2, peak: 0.04, decay: 0.03 });
  },

  // ---------- car ----------
  rev(duration = 1.4, from = 45, to = 190, vol = 0.45, when) {
    if (!ok()) return;
    const t = when ?? ctx.currentTime;
    const shaper = ctx.createWaveShaper();
    shaper.curve = distCurve(30);
    shaper.oversample = '4x';
    const lp = ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.setValueAtTime(420, t);
    lp.frequency.exponentialRampToValueAtTime(2400, t + duration * 0.85);
    lp.Q.value = 2;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(vol, t + 0.1);
    g.gain.setValueAtTime(vol, t + duration * 0.72);
    g.gain.exponentialRampToValueAtTime(0.0001, t + duration);
    [['sawtooth', 1], ['sawtooth', 1.01], ['square', 0.5]].forEach(([type, mul]) => {
      const o = ctx.createOscillator();
      o.type = type;
      o.frequency.setValueAtTime(from * mul, t);
      o.frequency.exponentialRampToValueAtTime(to * mul, t + duration * 0.8);
      o.connect(shaper);
      o.start(t); o.stop(t + duration + 0.05);
    });
    const am = ctx.createGain();
    const lfo = ctx.createOscillator();
    const lfoG = ctx.createGain();
    lfo.type = 'square';
    lfo.frequency.setValueAtTime(from / 2, t);
    lfo.frequency.exponentialRampToValueAtTime(to / 2, t + duration * 0.8);
    lfoG.gain.value = 0.3;
    am.gain.value = 0.7;
    lfo.connect(lfoG).connect(am.gain);
    shaper.connect(lp).connect(am).connect(g).connect(fxBus);
    lfo.start(t); lfo.stop(t + duration + 0.05);
  },

  // Starter motor cranks three times, then the engine catches.
  ignition() {
    if (!ok()) return;
    const t = ctx.currentTime;
    for (let i = 0; i < 4; i++) {
      const tt = t + i * 0.11;
      burst(tt, { type: 'lowpass', freq: 600, peak: 0.35, decay: 0.07 });
      tone(70, tt, { type: 'square', peak: 0.12, decay: 0.07 });
    }
    this.rev(1.5, 38, 200, 0.5, t + 0.48);
  },

  // Gear change: clunk + throttle blip.
  shift() {
    if (!ok()) return;
    const t = ctx.currentTime;
    burst(t, { type: 'bandpass', freq: 1300, q: 1.4, peak: 0.4, decay: 0.07 });
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.type = 'sine';
    o.frequency.setValueAtTime(140, t);
    o.frequency.exponentialRampToValueAtTime(60, t + 0.12);
    env(g, t, 0.002, 0.6, 0.14);
    o.connect(g).connect(fxBus);
    o.start(t); o.stop(t + 0.2);
    this.rev(0.45, 70, 150, 0.3, t + 0.08);
  },

  // ---------- the break ----------
  crack(vol = 1) {
    if (!ok()) return;
    const t = ctx.currentTime;
    const out = ctx.createGain();
    out.gain.value = vol * 0.8;
    out.connect(fxBus);
    burst(t, { type: 'highpass', freq: 2400, peak: 0.8, decay: 0.14, out });
    for (let i = 0; i < 4; i++) tone(3000 + i * 900, t + 0.02 + i * 0.022, { type: 'triangle', peak: 0.12, decay: 0.04, out });
    const sub = ctx.createOscillator();
    const sg = ctx.createGain();
    sub.type = 'sine';
    sub.frequency.setValueAtTime(88, t);
    sub.frequency.exponentialRampToValueAtTime(32, t + 0.7);
    env(sg, t, 0.004, 0.9, 0.8);
    sub.connect(sg).connect(out);
    sub.start(t); sub.stop(t + 0.9);
  },

  boom() {
    if (!ok()) return;
    const t = ctx.currentTime;
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.type = 'sine';
    o.frequency.setValueAtTime(68, t);
    o.frequency.exponentialRampToValueAtTime(28, t + 1.1);
    env(g, t, 0.006, 0.85, 1.2);
    o.connect(g).connect(fxBus);
    o.start(t); o.stop(t + 1.3);
    burst(t, { type: 'lowpass', freq: 380, peak: 0.4, decay: 0.4 });
  },

  // ---------- creatures ----------
  screech() {
    if (!ok()) return;
    const t = ctx.currentTime;
    const o = ctx.createOscillator();
    const vib = ctx.createOscillator();
    const vibG = ctx.createGain();
    const g = ctx.createGain();
    const bp = ctx.createBiquadFilter();
    o.type = 'sawtooth';
    o.frequency.setValueAtTime(2500, t);
    o.frequency.exponentialRampToValueAtTime(3000, t + 0.12);
    o.frequency.exponentialRampToValueAtTime(1500, t + 0.75);
    vib.frequency.value = 32; vibG.gain.value = 160;
    vib.connect(vibG).connect(o.frequency);
    bp.type = 'bandpass'; bp.frequency.value = 2400; bp.Q.value = 2.5;
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(0.16, t + 0.04);
    g.gain.setValueAtTime(0.16, t + 0.3);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.8);
    o.connect(bp).connect(g).connect(fxBus);
    [o, vib].forEach((x) => { x.start(t); x.stop(t + 0.85); });
  },

  // "اضرب يا ذياب": a wolf howl, then the pack answers a fifth higher.
  wolf() {
    if (!ok()) return;
    const t = ctx.currentTime;
    const howl = (start, base, len, vol) => {
      const o = ctx.createOscillator();
      const o2 = ctx.createOscillator();
      const vib = ctx.createOscillator();
      const vibG = ctx.createGain();
      const f1 = ctx.createBiquadFilter();
      const g = ctx.createGain();
      o.type = 'sawtooth'; o2.type = 'sine';
      o.frequency.setValueAtTime(base * 0.62, start);
      o.frequency.exponentialRampToValueAtTime(base, start + len * 0.28);
      o.frequency.setValueAtTime(base, start + len * 0.62);
      o.frequency.exponentialRampToValueAtTime(base * 0.7, start + len);
      o2.frequency.setValueAtTime(base * 1.24, start);
      o2.frequency.exponentialRampToValueAtTime(base * 2, start + len * 0.28);
      o2.frequency.exponentialRampToValueAtTime(base * 1.4, start + len);
      vib.frequency.value = 5.5; vibG.gain.value = base * 0.018;
      vib.connect(vibG).connect(o.frequency);
      f1.type = 'bandpass'; f1.Q.value = 3;
      f1.frequency.setValueAtTime(650, start);
      f1.frequency.linearRampToValueAtTime(1100, start + len * 0.4);
      f1.frequency.linearRampToValueAtTime(800, start + len);
      g.gain.setValueAtTime(0.0001, start);
      g.gain.exponentialRampToValueAtTime(vol, start + len * 0.25);
      g.gain.setValueAtTime(vol, start + len * 0.7);
      g.gain.exponentialRampToValueAtTime(0.0001, start + len);
      const og2 = ctx.createGain(); og2.gain.value = 0.35;
      o.connect(f1).connect(g);
      o2.connect(og2).connect(g);
      g.connect(fxBus);
      const send = ctx.createGain(); send.gain.value = 0.9;
      g.connect(send).connect(reverbIn);
      [o, o2, vib].forEach((x) => { x.start(start); x.stop(start + len + 0.05); });
    };
    howl(t, 440, 2.1, 0.22);
    howl(t + 0.7, 660, 1.6, 0.12);
    howl(t + 1.0, 523, 1.5, 0.1);
  },

  // ---------- money ----------
  target(n = 1, level = 1) {
    if (!ok()) return;
    const t = ctx.currentTime;
    const base = [0, 1318.5, 1568, 1975.5][n] || 1318.5;
    [[1, 0.28], [2.01, 0.1], [3.0, 0.05]].forEach(([mul, vol]) => tone(base * mul, t, { peak: vol * level, decay: 1.3 }));
    if (n === 3) this.coins(5, t + 0.05, 0.6 * level);
  },

  coins(count = 6, when, vol = 0.6) {
    if (!ok()) return;
    const t0 = when ?? ctx.currentTime;
    const r = seeded(77);
    for (let i = 0; i < count; i++) {
      const tt = t0 + i * (0.05 + r() * 0.05);
      const f = 3600 + r() * 2200;
      tone(f, tt, { type: 'triangle', peak: 0.07 * vol, decay: 0.18 });
      tone(f * 1.5, tt, { type: 'sine', peak: 0.04 * vol, decay: 0.12 });
    }
  },

  // Cash register: drawer + bell + coins.
  cash() {
    if (!ok()) return;
    const t = ctx.currentTime;
    burst(t, { type: 'bandpass', freq: 900, q: 1, peak: 0.35, decay: 0.12 });
    tone(2637, t + 0.08, { peak: 0.2, decay: 1.2 });
    tone(3520, t + 0.08, { peak: 0.12, decay: 1.0 });
    this.coins(10, t + 0.2, 1);
  },

  // Record scratch, then the bass lands.
  scratch() {
    if (!ok()) return;
    const t = ctx.currentTime;
    const f = burst(t, { type: 'bandpass', freq: 1200, q: 4, peak: 0.5, decay: 0.4 });
    f.frequency.setValueAtTime(1600, t);
    f.frequency.linearRampToValueAtTime(300, t + 0.12);
    f.frequency.linearRampToValueAtTime(1800, t + 0.22);
    f.frequency.linearRampToValueAtTime(500, t + 0.36);
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.type = 'sawtooth';
    o.frequency.setValueAtTime(420, t);
    o.frequency.linearRampToValueAtTime(140, t + 0.12);
    o.frequency.linearRampToValueAtTime(520, t + 0.22);
    o.frequency.linearRampToValueAtTime(160, t + 0.36);
    env(g, t, 0.01, 0.08, 0.38);
    o.connect(g).connect(fxBus);
    o.start(t); o.stop(t + 0.45);
    window.setTimeout(() => this.boom(), 380);
  },

  // Riser into a coin.
  rise() {
    if (!ok()) return;
    const t = ctx.currentTime;
    const f = burst(t, { type: 'bandpass', freq: 300, q: 1.2, peak: 0.25, decay: 1.4 });
    f.frequency.setValueAtTime(300, t);
    f.frequency.exponentialRampToValueAtTime(5000, t + 1.2);
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.type = 'sine';
    o.frequency.setValueAtTime(180, t);
    o.frequency.exponentialRampToValueAtTime(1400, t + 1.2);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(0.12, t + 1.1);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 1.3);
    o.connect(g).connect(fxBus);
    o.start(t); o.stop(t + 1.35);
    tone(1975.5, t + 1.2, { peak: 0.2, decay: 1.2 });
  },

  whoosh(duration = 0.7, vol = 0.35) {
    if (!ok()) return;
    const t = ctx.currentTime;
    const n = noiseSrc();
    const bp = ctx.createBiquadFilter();
    bp.type = 'bandpass'; bp.Q.value = 0.9;
    bp.frequency.setValueAtTime(300, t);
    bp.frequency.exponentialRampToValueAtTime(3200, t + duration * 0.7);
    bp.frequency.exponentialRampToValueAtTime(900, t + duration);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(vol, t + duration * 0.6);
    g.gain.exponentialRampToValueAtTime(0.0001, t + duration);
    n.connect(bp).connect(g).connect(fxBus);
    n.start(t); n.stop(t + duration + 0.05);
  },
};
