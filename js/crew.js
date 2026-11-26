// Section 06 — one dot per Telegram subscriber (56,044 on 26 Nov 2026).
// Scroll: scattered crowd -> the number "56,044" -> his name "الشريان".

import { qs, qsa, prng, clamp, easeInOut } from './util.js';
import { sound } from './audio.js';

const N = 56044;
// ABGR (little-endian) colours for Uint32 pixel writes.
const BG = 0xff050505;
const COLORS = [0xff4fa9d4, 0xff88d4f1, 0xff4fa9d4, 0xffeaf1f4, 0xff266a8c];

export function initCrew({ reduced }) {
  const canvas = qs('#crew-canvas');
  if (!canvas || reduced || !window.gsap) {
    qsa('.crew__cap').forEach((c) => { c.style.opacity = 1; });
    return;
  }
  const ctx = canvas.getContext('2d', { alpha: false });
  const rnd = prng(56044);
  const sx = new Float32Array(N), sy = new Float32Array(N);
  const ax = new Float32Array(N), ay = new Float32Array(N);
  const bx = new Float32Array(N), by = new Float32Array(N);
  const dl = new Float32Array(N), ph = new Float32Array(N);
  const col = new Uint32Array(N);
  for (let i = 0; i < N; i++) {
    dl[i] = rnd();
    ph[i] = rnd() * Math.PI * 2;
    col[i] = COLORS[(rnd() * COLORS.length) | 0];
  }

  let w = 0, h = 0, img = null, buf = null, ready = false, scale = 1;
  let progress = 0, running = false, raf = 0;

  function sample(drawFn) {
    const off = document.createElement('canvas');
    off.width = w; off.height = h;
    const o = off.getContext('2d');
    drawFn(o);
    const data = o.getImageData(0, 0, w, h).data;
    const pts = [];
    const stride = w * h > 2_000_000 ? 2 : 1;
    for (let yy = 0; yy < h; yy += stride) {
      for (let xx = 0; xx < w; xx += stride) {
        if (data[(yy * w + xx) * 4 + 3] > 140) pts.push(xx, yy);
      }
    }
    return pts;
  }

  function assign(pts, tx, ty) {
    const r = prng(7);
    const count = pts.length / 2;
    for (let i = 0; i < N; i++) {
      const k = ((r() * count) | 0) * 2;
      tx[i] = pts[k] + (r() - 0.5);
      ty[i] = pts[k + 1] + (r() - 0.5);
    }
  }

  async function layout() {
    const rect = canvas.getBoundingClientRect();
    const dpr = Math.min(window.devicePixelRatio || 1, 1.5);
    w = Math.max(2, Math.round(rect.width * dpr));
    h = Math.max(2, Math.round(rect.height * dpr));
    canvas.width = w; canvas.height = h;
    img = ctx.createImageData(w, h);
    buf = new Uint32Array(img.data.buffer);

    const r = prng(99);
    for (let i = 0; i < N; i++) {
      // crowd: dense band through the middle, thinning out
      const u = r(), v = r();
      sx[i] = u * w;
      const spread = 0.34 * Math.pow(v, 0.7) * (r() < 0.5 ? -1 : 1);
      sy[i] = h * (0.55 + spread);
    }

    try { await document.fonts.load('800 120px Alexandria', 'الشريان'); await document.fonts.load('400 120px Anton', '56,044'); } catch (e) { /* fall back to system fonts */ }
    scale = dpr;
    // the words sit in the middle band: captions are above, the list is below
    const cy = h * 0.55;
    const numPts = sample((o) => {
      const size = Math.min(w * 0.24, h * 0.34);
      o.font = `400 ${size}px Anton, Impact, sans-serif`;
      o.textAlign = 'center'; o.textBaseline = 'middle'; o.fillStyle = '#fff';
      o.fillText('56,044', w / 2, cy);
    });
    const namePts = sample((o) => {
      const size = Math.min(w * 0.2, h * 0.32);
      o.font = `800 ${size}px Alexandria, Cairo, sans-serif`;
      o.direction = 'rtl';
      o.textAlign = 'center'; o.textBaseline = 'middle'; o.fillStyle = '#fff';
      o.fillText('الشريان', w / 2, cy);
    });
    if (numPts.length && namePts.length) {
      assign(numPts, ax, ay);
      assign(namePts, bx, by);
      ready = true;
    }
  }

  // pointer: the crowd parts around the cursor and swirls a little
  const mouse = { x: -1e4, y: -1e4, tx: -1e4, ty: -1e4, s: 0, ts: 0 };
  const stage = qs('.crew__stage');
  stage.addEventListener('pointermove', (e) => {
    if (e.pointerType === 'touch') return;
    const r = canvas.getBoundingClientRect();
    mouse.tx = (e.clientX - r.left) * scale;
    mouse.ty = (e.clientY - r.top) * scale;
    if (mouse.s < 0.01) { mouse.x = mouse.tx; mouse.y = mouse.ty; }
    mouse.ts = 1;
  });
  stage.addEventListener('pointerleave', () => { mouse.ts = 0; });

  function render(time) {
    buf.fill(BG);
    const p = progress;
    const t = time * 0.001;
    mouse.x += (mouse.tx - mouse.x) * 0.18;
    mouse.y += (mouse.ty - mouse.y) * 0.18;
    mouse.s += (mouse.ts - mouse.s) * 0.08;
    const R = 150 * scale;
    const R2 = R * R;
    const ms = mouse.s;
    const mx = mouse.x, my = mouse.y;
    // phase weights
    const toA = clamp((p - 0.12) / 0.33);   // scatter -> number
    const toB = clamp((p - 0.58) / 0.27);   // number -> name
    for (let i = 0; i < N; i++) {
      const d = dl[i] * 0.35;
      const ea = easeInOut(clamp((toA - d) / (1 - 0.35)));
      const eb = easeInOut(clamp((toB - d) / (1 - 0.35)));
      let x = sx[i] + (ax[i] - sx[i]) * ea;
      let yy = sy[i] + (ay[i] - sy[i]) * ea;
      x += (bx[i] - x) * eb;
      yy += (by[i] - yy) * eb;
      const loose = 1 - Math.max(ea * (1 - eb), eb) * 0.92;
      x += Math.sin(t * 1.3 + ph[i]) * 2.4 * loose;
      yy += Math.cos(t * 1.1 + ph[i] * 1.7) * 2.4 * loose;
      let c = col[i];
      if (ms > 0.01) {
        const dx = x - mx, dy = yy - my;
        const d2 = dx * dx + dy * dy;
        if (d2 < R2 && d2 > 0.01) {
          const d = Math.sqrt(d2);
          const f = 1 - d / R;
          const push = f * f * R * 0.6 * ms;
          x += (dx / d) * push - (dy / d) * push * 0.35;
          yy += (dy / d) * push + (dx / d) * push * 0.35;
          if (f > 0.35) c = 0xff88d4f1;
        }
      }
      const xi = x | 0, yi = yy | 0;
      if (xi >= 0 && xi < w && yi >= 0 && yi < h) buf[yi * w + xi] = c;
    }
    ctx.putImageData(img, 0, 0);
  }

  function loop(time) {
    if (!running) return;
    if (ready) render(time);
    raf = requestAnimationFrame(loop);
  }

  const caps = qsa('.crew__cap');
  const capFor = (p) => (p < 0.3 ? 0 : p < 0.62 ? 1 : 2);
  let curCap = -1;
  function showCap(i) {
    if (i === curCap) return;
    const gsap = window.gsap;
    // never two captions on screen at once: the old one is gone before the new one starts
    gsap.killTweensOf(caps);
    caps.forEach((c, k) => { if (k !== curCap && k !== i) gsap.set(c, { autoAlpha: 0 }); });
    if (curCap >= 0) gsap.to(caps[curCap], { autoAlpha: 0, y: -14, duration: 0.18, ease: 'power2.in' });
    gsap.fromTo(caps[i], { autoAlpha: 0, y: 18 }, { autoAlpha: 1, y: 0, duration: 0.42, delay: curCap >= 0 ? 0.22 : 0, ease: 'power3.out' });
    curCap = i;
  }

  // the 56,044 targets are built only when the section gets close, not at page load
  let laidOut = false;
  const lazy = new IntersectionObserver(([e]) => {
    if (e.isIntersecting && !laidOut) { laidOut = true; layout(); lazy.disconnect(); }
  }, { rootMargin: '200% 0px' });
  lazy.observe(canvas);
  let rt = 0;
  window.addEventListener('resize', () => { clearTimeout(rt); rt = setTimeout(() => { if (laidOut) layout(); }, 200); });

  const cues = [
    { p: 0.13, fn: () => sound.whoosh(0.9, 0.35) },
    { p: 0.44, fn: () => sound.boom() },
    { p: 0.6, fn: () => sound.whoosh(0.9, 0.35) },
    { p: 0.84, fn: () => { sound.boom(); sound.target(3); } },
  ];
  let prev = 0;
  window.ScrollTrigger.create({
    trigger: '.crew__stage',
    start: 'top top',
    end: '+=320%',
    pin: true,
    scrub: 0.5,
    onUpdate: (self) => {
      progress = self.progress;
      if (progress > prev) cues.forEach((c) => { if (prev < c.p && progress >= c.p) c.fn(); });
      prev = progress;
      showCap(capFor(progress));
    },
    onToggle: (self) => {
      running = self.isActive;
      if (running) { cancelAnimationFrame(raf); raf = requestAnimationFrame(loop); }
    },
  });
  // also run a little before/after the pin so the canvas is never blank on entry
  const io = new IntersectionObserver(([e]) => {
    if (e.isIntersecting && !running) { running = true; raf = requestAnimationFrame(loop); }
    if (!e.isIntersecting) { running = false; cancelAnimationFrame(raf); }
  });
  io.observe(canvas);
  showCap(0);
}
