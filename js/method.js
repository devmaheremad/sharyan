// Section 01 — the method, told on his 17 Nov 2026 call: BUY above 3870.00.
// Pinned and scrubbed by scroll: line -> price leans -> wick does not count -> M1 close above = break
// -> the falcon strikes the break -> the car runs the price path through TP1 (secure all), TP2, TP3.

import { svgEl, qs, qsa, prng, clamp } from './util.js';
import { sound } from './audio.js';

const LEVEL = 3870;
const SL = 3867.4;
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

  // ---- run path (polyline through the closes from the break on)
  const pts = [];
  for (let i = BREAK_I; i < candles.length; i++) pts.push([cx(i), y(candles[i].c)]);
  const segs = [];
  let total = 0;
  for (let i = 1; i < pts.length; i++) {
    const len = Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]);
    segs.push({ a: pts[i - 1], b: pts[i], len, start: total });
    total += len;
  }
  const runPath = qs('#m-run');
  runPath.setAttribute('d', 'M' + pts.map((p) => p.join(' ')).join(' L'));
  runPath.style.strokeDasharray = `${total}`;
  runPath.style.strokeDashoffset = `${total}`;
  const lenAtIndex = (ci) => {
    const k = ci - BREAK_I;
    return k <= 0 ? 0 : segs[Math.min(k, segs.length) - 1].start + segs[Math.min(k, segs.length) - 1].len;
  };
  const tpLen = TP_I.map(lenAtIndex);

  // ---- car (top-down, facing +x)
  const car = qs('#m-car');
  const carInner = svgEl('g', { transform: 'scale(1.75)' }, car);
  [[-46, -8, -96], [-46, 0, -128], [-46, 8, -100]].forEach(([x1, yy, x2]) => svgEl('line', { class: 'car-speed', x1, x2, y1: yy, y2: yy }, carInner));
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

  // ---- captions
  const caps = qsa('#method-captions li');
  const summary = qs('#method-summary');

  // ===== state from run progress (fully reversible for scrub)
  let lastHits = 0;
  let lastVisible = 0;
  let lastTickAt = 0;
  const state = { run: 0, falcon: 0 };

  function placeCar() {
    const L = state.run * total;
    let s = segs[0];
    for (const sg of segs) { if (L >= sg.start) s = sg; }
    const t = clamp((L - s.start) / s.len);
    const px = s.a[0] + (s.b[0] - s.a[0]) * t;
    const py = s.a[1] + (s.b[1] - s.a[1]) * t;
    const ang = (Math.atan2(s.b[1] - s.a[1], s.b[0] - s.a[0]) * 180) / Math.PI;
    car.setAttribute('transform', `translate(${px} ${py - 2}) rotate(${ang})`);
    runPath.style.strokeDashoffset = `${total - L}`;

    // run candles appear as the car passes them
    for (let i = BREAK_I + 1; i < candles.length; i++) {
      candleEls[i].style.opacity = L >= lenAtIndex(i) - 1 ? 1 : 0;
    }
    const hits = tpLen.filter((l) => L >= l - 0.5).length;
    tpEls.forEach((g, i) => g.classList.toggle('is-hit', i < hits));
    const secured = hits >= 1;
    stopG.classList.toggle('is-secured', secured);
    stopLine.setAttribute('y1', secured ? y(LEVEL) + 6 : y(SL));
    stopLine.setAttribute('y2', secured ? y(LEVEL) + 6 : y(SL));
    stopText.setAttribute('y', secured ? y(LEVEL) + 48 : y(SL) + 5);
    stopText.textContent = secured ? 'SL → الدخول' : `SL ${SL.toFixed(2)}`;
    if (hits > lastHits) sound.target(hits);
    lastHits = hits;
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
    state.run = 1; placeCar();
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
  const tpTime = (k) => 5.5 + (tpLen[k] / total) * 3.2;
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
      if (now < prevT) lastHits = Math.min(lastHits, tpLen.filter((l) => state.run * total >= l - 0.5).length);
      prevT = now;
    },
  });
}
