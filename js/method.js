// Section 01 — the method, told on his 17 Nov 2026 call: BUY above 3870.00.
// Pinned and scrubbed by scroll: line -> price leans -> wick does not count -> M1 close above = break
// -> the falcon strikes the break -> the car runs the price path through TP1 (secure all), TP2, TP3.

import { svgEl, qs, qsa, prng, clamp, lerp } from './util.js';
import { sound } from './audio.js';

const LEVEL = 3870;
const SL = 3867.5; // 25 pips (1 pip = $0.10) under the level
const TPS = [3875, 3879, 3882];
const X0 = 90;          // first candle x
const STEP = 26;        // candle spacing
const BW = 14;          // body width
const CHART_R = 1340;   // right edge of the plot
const y = (p) => 520 - (p - LEVEL) * 25;
const cx = (i) => X0 + i * STEP;

function buildCandles() {
  const r = prng(1711);
  const list = [];
  let p = 3861.4;
  for (let i = 0; i < 29; i++) {
    const trend = 3861.4 + (i / 28) * 7.2;
    let c = trend + (r() - 0.5) * 2.4;
    c = Math.min(c, 3869.3);
    const o = p;
    const h = Math.min(Math.max(o, c) + r() * 0.9, 3869.7);
    const l = Math.min(o, c) - r() * 0.9;
    list.push({ o, h, l, c });
    p = c;
  }
  const fixed = [
    { o: p, h: 3871.3, l: Math.min(p, 3867.9) - 0.2, c: 3868.6, wick: true }, // 29: wick through, close below
    { o: 3868.6, h: 3869.0, l: 3867.3, c: 3867.6 },
    { o: 3867.6, h: 3870.0, l: 3867.4, c: 3869.1 },                         // 31: touch
    { o: 3869.1, h: 3869.4, l: 3868.0, c: 3868.3 },
    { o: 3868.3, h: 3869.6, l: 3868.1, c: 3869.3 },
    { o: 3869.3, h: 3872.1, l: 3869.0, c: 3871.7, brk: true },              // 34: the break
  ];
  list.push(...fixed);
  const run = [3872.6, 3874.1, 3873.5, 3875.8, 3875.1, 3877.0, 3878.4, 3879.6, 3878.9, 3880.7, 3882.4, 3883.6, 3884.8];
  let o = 3871.7;
  run.forEach((c) => {
    const h = Math.max(o, c) + 0.35;
    const l = Math.min(o, c) - 0.4;
    list.push({ o, h, l, c, run: true });
    o = c;
  });
  return list;
}

const BREAK_I = 34;
const TP_I = [38, 42, 45]; // first candles whose high reaches TP1 / TP2 / TP3

export function initMethod({ reduced }) {
  const svg = qs('#method-svg');
  if (!svg) return;
  const candles = buildCandles();
  // Phones: crop to the last part of the approach, the break and the run, and enlarge the labels.
  const compact = window.matchMedia('(max-width: 800px)').matches;
  if (compact) {
    svg.setAttribute('viewBox', '560 90 1040 760');
    svg.classList.add('is-compact');
  }

  // ---- grid
  const grid = qs('#m-grid');
  for (let p = 3860; p <= 3886; p += 2) {
    svgEl('line', { x1: 60, x2: CHART_R, y1: y(p), y2: y(p) }, grid);
    svgEl('text', { x: compact ? 572 : 14, y: y(p) + 4 }, grid).textContent = p.toFixed(0);
  }

  // ---- targets & stop
  const tgG = qs('#m-targets');
  const tpEls = TPS.map((p, i) => {
    const g = svgEl('g', { class: 'm-tp' }, tgG);
    svgEl('line', { x1: 60, x2: CHART_R, y1: y(p), y2: y(p) }, g);
    svgEl('text', { x: CHART_R + 20, y: y(p) + 5 }, g).textContent = `TP${i + 1} ${p.toFixed(2)}`;
    return g;
  });
  const stopG = svgEl('g', { class: 'm-stop' }, qs('#m-stop'));
  const stopLine = svgEl('line', { x1: 60, x2: CHART_R, y1: y(SL), y2: y(SL) }, stopG);
  const stopText = svgEl('text', { x: CHART_R + 20, y: y(SL) + 5 }, stopG);
  stopText.textContent = `SL ${SL.toFixed(2)}`;

  // ---- candles
  const cg = qs('#m-candles');
  const candleEls = candles.map((k, i) => {
    const bull = k.c >= k.o;
    const g = svgEl('g', { class: `m-candle ${bull ? 'is-bull' : 'is-bear'}` }, cg);
    svgEl('line', { class: 'm-candle-wick', x1: cx(i), x2: cx(i), y1: y(k.h), y2: y(k.l) }, g);
    const top = y(Math.max(k.o, k.c));
    const h = Math.max(2, Math.abs(y(k.o) - y(k.c)));
    svgEl('rect', { class: 'm-candle-body', x: cx(i) - BW / 2, y: top, width: BW, height: h }, g);
    return g;
  });

  // ---- level (two halves so it can crack)
  const lg = qs('#m-level');
  const bx = cx(BREAK_I);
  const levL = svgEl('line', { class: 'm-level-line', x1: 60, x2: bx, y1: y(LEVEL), y2: y(LEVEL) }, lg);
  const levR = svgEl('line', { class: 'm-level-line', x1: bx, x2: CHART_R, y1: y(LEVEL), y2: y(LEVEL) }, lg);
  const tag = svgEl('g', { class: 'm-level-tag' }, lg);
  svgEl('rect', compact ? { x: CHART_R - 60, y: y(LEVEL) - 30, width: 318, height: 60 } : { x: CHART_R + 12, y: y(LEVEL) - 21, width: 196, height: 42 }, tag);
  svgEl('text', compact ? { x: CHART_R - 44, y: y(LEVEL) + 11 } : { x: CHART_R + 24, y: y(LEVEL) + 8 }, tag).textContent = 'BUY ▲ 3870.00';

  // ---- wick mark
  const wk = candles[29];
  const wm = svgEl('g', { class: 'm-wick-x' }, qs('#m-wick-mark'));
  const wx = cx(29), wy = y(wk.h);
  svgEl('path', { d: `M${wx - 9} ${wy - 9} L${wx + 9} ${wy + 9} M${wx + 9} ${wy - 9} L${wx - 9} ${wy + 9}`, pathLength: 1 }, wm);
  const wt = svgEl('text', { x: wx, y: wy - 22, 'text-anchor': 'middle' }, wm);
  wt.textContent = 'ذيل ✕';

  // ---- break: crack + ring
  const bg = qs('#m-break');
  const by = y(LEVEL);
  const crack = svgEl('path', {
    class: 'm-crack', pathLength: 1,
    d: `M${bx - 3} ${by - 64} L${bx + 7} ${by - 40} L${bx - 6} ${by - 22} L${bx + 5} ${by - 6} L${bx - 7} ${by + 10} L${bx + 4} ${by + 28} L${bx - 4} ${by + 50} L${bx + 2} ${by + 70}`,
  }, bg);
  const ring = svgEl('circle', { class: 'm-ring', cx: bx, cy: by, r: 10 }, bg);

  // ---- run path: a smooth curve through the closes from the break on (Catmull-Rom as cubic Beziers)
  const pts = [];
  for (let i = BREAK_I; i < candles.length; i++) pts.push([cx(i), y(candles[i].c)]);
  let d = `M${pts[0][0]} ${pts[0][1]}`;
  for (let i = 0; i < pts.length - 1; i++) {
    const p0 = pts[Math.max(0, i - 1)], p1 = pts[i], p2 = pts[i + 1], p3 = pts[Math.min(pts.length - 1, i + 2)];
    const c1 = [p1[0] + (p2[0] - p0[0]) / 6, p1[1] + (p2[1] - p0[1]) / 6];
    const c2 = [p2[0] - (p3[0] - p1[0]) / 6, p2[1] - (p3[1] - p1[1]) / 6];
    d += ` C${c1[0].toFixed(1)} ${c1[1].toFixed(1)} ${c2[0].toFixed(1)} ${c2[1].toFixed(1)} ${p2[0]} ${p2[1]}`;
  }
  const runPath = qs('#m-run');
  runPath.setAttribute('d', d);
  const total = runPath.getTotalLength();
  runPath.style.strokeDasharray = `${total}`;
  runPath.style.strokeDashoffset = `${total}`;
  // Sample the curve once, so the car is placed from a table instead of DOM calls every frame.
  const N = 720;
  const LUT = new Float32Array((N + 1) * 2);
  for (let k = 0; k <= N; k++) {
    const q = runPath.getPointAtLength((total * k) / N);
    LUT[k * 2] = q.x; LUT[k * 2 + 1] = q.y;
  }
  const at = (u) => {
    const f = clamp(u) * N;
    const i = Math.min(N - 1, Math.floor(f));
    const t = f - i;
    return [lerp(LUT[i * 2], LUT[i * 2 + 2], t), lerp(LUT[i * 2 + 1], LUT[i * 2 + 3], t)];
  };
  const headingAt = (u) => {
    const a = at(u - 0.008), b = at(u + 0.008);
    return Math.atan2(b[1] - a[1], b[0] - a[0]);
  };
  const uAtX = (x) => {
    for (let k = 0; k <= N; k++) if (LUT[k * 2] >= x - 0.5) return k / N;
    return 1;
  };
  const candleU = candles.map((_, i) => (i > BREAK_I ? uAtX(cx(i)) : 0));
  const tpU = TP_I.map((i) => uAtX(cx(i)));

  // ---- car (top-down, facing +x)
  const car = qs('#m-car');
  const carInner = svgEl('g', { transform: 'scale(1.75)' }, car);
  const speedLines = [[-46, -8, 50], [-46, 0, 82], [-46, 8, 54]].map(([x1, yy, len]) => ({ el: svgEl('line', { class: 'car-speed', x1, x2: x1 - len, y1: yy, y2: yy }, carInner), x1, len }));
  // wheels (rear ones wider), then body, cockpit, rear wing, tail lights
  [[16, -17], [16, 11], [-26, -19], [-26, 12]].forEach(([wx, wy], i) => svgEl('rect', { class: 'car-wheel', x: wx, y: wy, width: i < 2 ? 12 : 15, height: i < 2 ? 6 : 7, rx: 1.5 }, carInner));
  svgEl('path', { class: 'car-body', d: 'M38 0 C38 -4 33 -8 24 -9 L8 -12 L-20 -14 C-30 -14 -33 -10 -33 0 C-33 10 -30 14 -20 14 L8 12 L24 9 C33 8 38 4 38 0 Z' }, carInner);
  svgEl('path', { class: 'car-glass', d: 'M10 -8 C17 -6 19 -3 19 0 C19 3 17 6 10 8 L-6 8 C-10 5 -10 -5 -6 -8 Z' }, carInner);
  svgEl('rect', { class: 'car-wing', x: -38, y: -16, width: 5, height: 32 }, carInner);
  svgEl('rect', { class: 'car-light', x: -34, y: -11, width: 2.5, height: 6 }, carInner);
  svgEl('rect', { class: 'car-light', x: -34, y: 5, width: 2.5, height: 6 }, carInner);
  car.style.opacity = 0;

  // ---- falcon (beak tip at the origin, flying toward +x)
  const fal = qs('#m-falcon');
  const falInner = svgEl('g', { transform: 'scale(-0.3 0.3) translate(-40 -150)' }, fal);
  const sym = qs('#falcon');
  [...sym.children].forEach((n) => falInner.appendChild(n.cloneNode(true)));
  fal.style.opacity = 0;

  // ---- checkered flag at TP3
  const fg = qs('#m-flag');
  const fx = cx(TP_I[2]);
  const flag = svgEl('g', {}, fg);
  svgEl('line', { x1: fx, x2: fx, y1: y(TPS[2]) - 6, y2: y(TPS[2]) - 92 }, flag);
  svgEl('rect', { class: 'flag', x: fx, y: y(TPS[2]) - 92, width: 64, height: 40 }, flag);
  flag.style.opacity = 0;

  // ---- "كما راهنا!" next to the flag (his words when the last target lands)
  const wolves = qs('#m-wolves');
  const wolvesText = svgEl('text', { x: fx - 34, y: y(TPS[2]) - 34, 'text-anchor': 'end' }, wolves);
  wolvesText.textContent = 'كما راهنا!';
  wolves.style.opacity = 0;

  // ---- dust / smoke behind the car (a small pool of soft circles)
  const dustG = qs('#m-dust');
  const dr = prng(4242);
  const dust = Array.from({ length: 70 }, () => ({ el: svgEl('circle', { r: 0, cx: -999, cy: -999 }, dustG), life: 0, max: 1, x: 0, y: 0, vx: 0, vy: 0, r: 0 }));
  let dustNext = 0;
  let spawnAcc = 0;

  // ---- captions
  const caps = qsa('#method-captions li');
  const summary = qs('#method-summary');

  // ===== state from run progress (fully reversible for scrub)
  let lastHits = 0;
  let lastVisible = 0;
  let lastTickAt = 0;
  const state = { run: 0, falcon: 0 };

  let shownRun = 0;
  let targetRun = 0;
  let shownAng = 0;
  let carX = 0, carY = 0;
  let raf = 0;
  let lastT = 0;
  let wolvesOn = false;

  function render(u, speed, now) {
    const [px, py] = at(u);
    const target = headingAt(u);
    let diff = target - shownAng;
    while (diff > Math.PI) diff -= Math.PI * 2;
    while (diff < -Math.PI) diff += Math.PI * 2;
    shownAng += diff * 0.25;
    carX = px; carY = py;
    const hum = Math.abs(speed) > 0.02 ? Math.sin(now * 0.06) * 0.7 : 0;
    car.setAttribute('transform', `translate(${px.toFixed(2)} ${(py - 2 + hum).toFixed(2)}) rotate(${((shownAng * 180) / Math.PI).toFixed(2)})`);
    const stretch = Math.min(1, Math.abs(speed) * 2.2);
    speedLines.forEach((l) => { l.el.setAttribute('x2', l.x1 - l.len * (0.35 + stretch)); l.el.style.opacity = 0.2 + stretch * 0.8; });
    runPath.style.strokeDashoffset = `${total * (1 - u)}`;

    // run candles appear as the car passes them
    for (let i = BREAK_I + 1; i < candles.length; i++) candleEls[i].style.opacity = u >= candleU[i] - 0.002 ? 1 : 0;
    const hits = tpU.filter((h) => u >= h - 0.002).length;
    tpEls.forEach((g, i) => g.classList.toggle('is-hit', i < hits));
    const secured = hits >= 1;
    stopG.classList.toggle('is-secured', secured);
    stopLine.setAttribute('y1', secured ? y(LEVEL) + 6 : y(SL));
    stopLine.setAttribute('y2', secured ? y(LEVEL) + 6 : y(SL));
    stopText.setAttribute('y', secured ? y(LEVEL) + 48 : y(SL) + 5);
    stopText.textContent = secured ? 'SL → الدخول' : `SL ${SL.toFixed(2)}`;
    if (hits > lastHits) {
      // his own voice from the stream on every target
      sound.target(hits, 0.35);
      sound.voice(['tp1', 'tp2', 'tp3'][hits - 1]);
    }
    lastHits = hits;
    const wantWolves = hits >= 3;
    if (wantWolves !== wolvesOn && window.gsap) {
      wolvesOn = wantWolves;
      if (wantWolves) window.gsap.fromTo(wolves, { opacity: 0, scale: 1.5, svgOrigin: `${fx - 34} ${y(TPS[2]) - 50}` }, { opacity: 1, scale: 1, duration: 0.5, ease: 'expo.out' });
      else window.gsap.to(wolves, { opacity: 0, duration: 0.2 });
    }
  }

  function spawnDust() {
    const p = dust[dustNext];
    dustNext = (dustNext + 1) % dust.length;
    const c = Math.cos(shownAng), sn = Math.sin(shownAng);
    const lat = (dr() - 0.5) * 34;
    p.x = carX - c * 62 - sn * lat;
    p.y = carY - sn * 62 + c * lat;
    const back = 40 + dr() * 70;
    p.vx = -c * back + (dr() - 0.5) * 30;
    p.vy = -sn * back + (dr() - 0.5) * 30 - 10;
    p.r = 5 + dr() * 7;
    p.max = 0.6 + dr() * 0.7;
    p.life = 1;
  }

  function updateDust(dt, speed) {
    const moving = Math.abs(speed) > 0.015 && shownRun > 0.003 && shownRun < 0.997;
    if (moving) spawnAcc += dt * Math.min(110, 30 + Math.abs(speed) * 260);
    while (spawnAcc >= 1) { spawnAcc -= 1; spawnDust(); }
    let alive = 0;
    dust.forEach((p) => {
      if (p.life <= 0) return;
      p.life -= dt / p.max;
      if (p.life <= 0) { p.el.setAttribute('cx', -999); return; }
      alive++;
      p.x += p.vx * dt; p.y += p.vy * dt;
      p.vx *= 0.96; p.vy = p.vy * 0.96 - 14 * dt;
      p.r += 42 * dt;
      p.el.setAttribute('cx', p.x.toFixed(1));
      p.el.setAttribute('cy', p.y.toFixed(1));
      p.el.setAttribute('r', p.r.toFixed(1));
      p.el.setAttribute('opacity', (p.life * 0.85).toFixed(3));
    });
    return alive;
  }

  function loop(now) {
    const dt = Math.min(0.05, lastT ? (now - lastT) / 1000 : 0.016);
    lastT = now;
    const prev = shownRun;
    shownRun += (targetRun - shownRun) * (1 - Math.exp(-dt * 7));
    if (Math.abs(targetRun - shownRun) < 0.0003) shownRun = targetRun;
    const speed = (shownRun - prev) / dt;
    render(shownRun, speed, now);
    const alive = updateDust(dt, speed);
    if (shownRun !== targetRun || alive > 0) raf = requestAnimationFrame(loop);
    else { raf = 0; lastT = 0; }
  }

  function kick() {
    if (!raf) raf = requestAnimationFrame(loop);
  }

  function placeCar() {
    targetRun = state.run;
    kick();
  }

  function placeFalcon() {
    const t = state.falcon;
    // dive from upper-left to the break point, then pull up and away to the right
    let px, py, rot;
    if (t <= 0.6) {
      const u = t / 0.6;
      const e = u * u;
      px = 380 + (bx - 380) * e;
      py = -120 + (by - 6 + 120) * e;
      rot = 38;
    } else {
      const u = (t - 0.6) / 0.4;
      px = bx + u * 520;
      py = by - 6 - u * u * 620;
      rot = -38 * u;
    }
    fal.setAttribute('transform', `translate(${px} ${py}) rotate(${rot})`);
  }

  function setVisibleCandles(n) {
    // n = how many of the pre-break candles (0..BREAK_I) are shown
    for (let i = 0; i < BREAK_I; i++) candleEls[i].style.opacity = i < n ? 1 : 0;
    if (n > lastVisible && performance.now() - lastTickAt > 45) {
      sound.tick(n % 3);
      lastTickAt = performance.now();
    }
    lastVisible = n;
  }

  // ===== reduced motion: show the finished story, no pin
  if (reduced || !window.gsap) {
    setVisibleCandles(BREAK_I);
    candleEls[BREAK_I].style.opacity = 1;
    shownRun = 1; render(1, 0, 0);
    car.style.opacity = 1;
    flag.style.opacity = 1;
    crack.style.strokeDasharray = '1'; crack.style.strokeDashoffset = '0';
    levR.style.opacity = 0.45;
    return;
  }

  const gsap = window.gsap;
  const levLen = CHART_R - 60;
  [levL, levR].forEach((l) => { l.style.strokeDasharray = `${levLen}`; });
  levL.style.strokeDashoffset = `${bx - 60}`;
  levR.style.strokeDashoffset = `${CHART_R - bx}`;
  crack.style.strokeDasharray = '1';
  crack.style.strokeDashoffset = '1';
  qsa('path', wm).forEach((p) => { p.style.strokeDasharray = '1'; p.style.strokeDashoffset = '1'; });
  gsap.set([tag, wt, ...tpEls, stopG, grid], { opacity: 0 });
  gsap.set(ring, { opacity: 0 });
  candleEls.forEach((g) => { g.style.opacity = 0; });
  gsap.set(caps, { autoAlpha: 0, y: 24 });

  const vis = { n: 0, brk: 0 };
  const tl = gsap.timeline({ defaults: { ease: 'none' } });

  const capIn = (i, at) => tl.to(caps[i], { autoAlpha: 1, y: 0, duration: 0.3, ease: 'power2.out' }, at);
  const capOut = (i, at) => tl.to(caps[i], { autoAlpha: 0, y: -18, duration: 0.25, ease: 'power2.in' }, at);

  // beat 0: the line
  tl.to(grid, { opacity: 1, duration: 0.4 }, 0)
    .to(levL, { strokeDashoffset: 0, duration: 0.7, ease: 'power2.inOut' }, 0.1)
    .to(levR, { strokeDashoffset: 0, duration: 0.5, ease: 'power2.out' }, 0.6)
    .to(tag, { opacity: 1, duration: 0.25 }, 0.9)
    .to([...tpEls, stopG], { opacity: 1, duration: 0.3, stagger: 0.06 }, 1.0);
  capIn(0, 0.15); capOut(0, 1.35);

  // beat 1: price approaches
  tl.to(vis, { n: 29, duration: 2.2, onUpdate: () => setVisibleCandles(Math.round(vis.n)) }, 1.4);
  capIn(1, 1.6); capOut(1, 3.45);

  // beat 2: the wick does not count
  tl.to(vis, { n: 30, duration: 0.3, onUpdate: () => setVisibleCandles(Math.round(vis.n)) }, 3.6)
    .to(qsa('path', wm), { strokeDashoffset: 0, duration: 0.3 }, 3.85)
    .to(wt, { opacity: 1, duration: 0.2 }, 3.95);
  capIn(2, 3.7); capOut(2, 4.75);
  tl.to(vis, { n: BREAK_I, duration: 0.6, onUpdate: () => setVisibleCandles(Math.round(vis.n)) }, 4.25)
    .to(wm, { opacity: 0.35, duration: 0.3 }, 4.6);

  // beat 3: the break (M1 close above) + falcon strike
  const breakCandle = candleEls[BREAK_I];
  const bBody = breakCandle.querySelector('rect');
  const bWick = breakCandle.querySelector('line');
  tl.set(breakCandle, { opacity: 1 }, 4.9)
    .fromTo(bBody, { scaleY: 0, transformOrigin: '50% 100%' }, { scaleY: 1, duration: 0.35, ease: 'power3.out' }, 4.9)
    .fromTo(bWick, { opacity: 0 }, { opacity: 1, duration: 0.2 }, 5.0)
    .to(fal, { opacity: 1, duration: 0.05 }, 4.85)
    .to(state, { falcon: 0.6, duration: 0.4, ease: 'power2.in', onUpdate: placeFalcon }, 4.85)
    .to(crack, { strokeDashoffset: 0, duration: 0.15 }, 5.25)
    .fromTo(ring, { attr: { r: 8 }, opacity: 1 }, { attr: { r: 120 }, opacity: 0, duration: 0.5, ease: 'power2.out', immediateRender: false }, 5.25)
    .to(levR, { opacity: 0.4, duration: 0.3 }, 5.3)
    .to(state, { falcon: 1, duration: 0.5, ease: 'power2.out', onUpdate: placeFalcon }, 5.25)
    .to(fal, { opacity: 0, duration: 0.15 }, 5.6);
  capIn(3, 5.2); capOut(3, 5.95);

  // beat 4-6: the run
  tl.to(car, { opacity: 1, duration: 0.15 }, 5.45)
    .to(state, { run: 1, duration: 3.2, onUpdate: placeCar }, 5.5);
  const tpTime = (k) => 5.5 + tpU[k] * 3.2;
  capIn(4, tpTime(0) - 0.05); capOut(4, tpTime(1) - 0.3);
  capIn(5, tpTime(1) - 0.05); capOut(5, tpTime(2) - 0.3);
  capIn(6, tpTime(2) - 0.05);
  tl.to(flag, { opacity: 1, duration: 0.2 }, tpTime(2))
    .fromTo(flag, { y: 40 }, { y: 0, duration: 0.35, ease: 'power3.out' }, tpTime(2));
  capOut(6, 9.0);

  // summary
  tl.to(summary, { autoAlpha: 1, duration: 0.4, ease: 'power2.out' }, 9.1)
    .fromTo(summary, { x: -40 }, { x: 0, duration: 0.5, ease: 'power3.out' }, 9.1)
    .to({}, { duration: 0.6 });

  // sound cues on forward crossings
  const cues = [
    { t: 5.22, fn: () => { sound.crack(); sound.screech(); } },
    { t: 5.45, fn: () => sound.rev(2.4, 42, 210, 0.55) },
    { t: 9.1, fn: () => sound.boom() },
  ];
  let prevT = 0;

  const ST = window.ScrollTrigger;
  ST.create({
    trigger: '.method__stage',
    start: 'top top',
    end: '+=520%',
    pin: true,
    scrub: 0.6,
    animation: tl,
    onUpdate: () => {
      const now = tl.time();
      if (now > prevT) cues.forEach((c) => { if (prevT < c.t && now >= c.t) c.fn(); });
      prevT = now;
    },
  });
}
