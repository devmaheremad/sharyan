// Hero background: a live-looking M1 gold chart that keeps playing Aboud's setup on a loop:
// a level, price leans on it, a candle closes beyond it, then TP1 / TP2 / TP3.

import { prng, clamp, lerp } from './util.js';
import { sound } from './audio.js';

const GOLD = '#d4a94f';
const GOLD_HI = '#f1d488';
const BEAR = '#5f5c55';
const STOP = '#e5484d';
const CANDLE_MS = 420;   // one simulated M1 candle
const STEP = 15;         // css px between candles
const TP = [5, 9, 12];   // dollars from the level (50 / 90 / 120 pips)

export function initHeroChart(canvas, { reduced }) {
  const c2d = canvas.getContext('2d');
  const rnd = prng(20261126);
  let W = 0, H = 0, dpr = 1;

  const candles = [];
  let price = 3866.2;
  let cur = null;           // forming candle
  let curStart = 0;
  let cycle = null;
  let view = { min: 3855, max: 3885 };
  let running = false;
  let inView = true;
  let raf = 0;
  let flash = 0;            // break flash 0..1
  let flashX = 0;

  function newCycle(prevDir) {
    const dir = prevDir === 1 ? -1 : 1;
    const level = Math.round((price + dir * (3 + rnd() * 3)) * 100) / 100;
    cycle = { dir, level, phase: 'approach', n: 0, need: 9 + Math.floor(rnd() * 6), hits: 0, breakAt: -1, cool: 0 };
  }

  function targetClose() {
    const { dir, level } = cycle;
    if (cycle.phase === 'approach') {
      cycle.n++;
      if (cycle.n >= cycle.need) {
        cycle.phase = 'break';
        return level + dir * (0.6 + rnd() * 1.1);
      }
      // Lean on the level but stay on the near side.
      const goal = level - dir * (0.5 + rnd() * 2.2);
      return clamp(lerp(price, goal, 0.35) + (rnd() - 0.5) * 1.6, dir === 1 ? -Infinity : level + 0.15, dir === 1 ? level - 0.15 : Infinity);
    }
    if (cycle.phase === 'run') {
      const pull = rnd() < 0.22 ? -0.9 : 1;
      return price + dir * pull * (0.7 + rnd() * 1.3);
    }
    // cooldown chop
    return price + (rnd() - 0.5) * 1.8;
  }

  function startCandle(now) {
    const o = price;
    const tc = targetClose();
    const wick = cycle.phase === 'approach' && cycle.n === cycle.need - 2;
    cur = { o, c: o, h: o, l: o, tc, wick, isBreak: cycle.phase === 'break' };
    curStart = now;
  }

  function finishCandle() {
    cur.c = cur.tc;
    cur.h = Math.max(cur.h, cur.c);
    cur.l = Math.min(cur.l, cur.c);
    price = cur.c;
    candles.push(cur);
    if (candles.length > 400) candles.shift();
    const { dir, level } = cycle;

    if (cur.isBreak) {
      cycle.phase = 'run';
      cycle.breakAt = candles.length - 1;
      flash = 1;
      if (inView) sound.crack(0.35);
    } else if (cycle.phase === 'run') {
      const ext = dir === 1 ? cur.h : cur.l;
      while (cycle.hits < 3 && (ext - level) * dir >= TP[cycle.hits]) {
        cycle.hits++;
        if (inView) sound.target(cycle.hits, 0.45);
      }
      if (cycle.hits >= 3) { cycle.phase = 'cool'; cycle.cool = 0; }
    } else if (cycle.phase === 'cool') {
      cycle.cool++;
      if (cycle.cool > 7) newCycle(dir);
    }
  }

  function updateForming(now) {
    const t = clamp((now - curStart) / CANDLE_MS);
    // Path inside the candle: wander, then settle on the close.
    const wobble = Math.sin(t * 9 + cur.o) * 0.35 * (1 - t);
    let p = lerp(cur.o, cur.tc, t * t) + wobble;
    if (cur.wick && t > 0.35 && t < 0.7) {
      // Poke through the level, then get rejected: a wick, not a close.
      p = cycle.level + cycle.dir * 0.8;
    }
    cur.c = p;
    cur.h = Math.max(cur.h, p);
    cur.l = Math.min(cur.l, p);
    if (t >= 1) { finishCandle(); startCandle(now); }
  }

  function resize() {
    const r = canvas.getBoundingClientRect();
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    W = Math.max(1, r.width);
    H = Math.max(1, r.height);
    canvas.width = Math.round(W * dpr);
    canvas.height = Math.round(H * dpr);
    c2d.setTransform(dpr, 0, 0, dpr, 0, 0);
  }

  function draw() {
    c2d.clearRect(0, 0, W, H);
    c2d.direction = 'ltr';
    c2d.textAlign = 'left';
    const count = Math.floor((W * 0.94) / STEP);
    const list = candles.slice(-(count - 1)).concat(cur ? [cur] : []);
    let mn = Infinity, mx = -Infinity;
    list.forEach((k) => { mn = Math.min(mn, k.l); mx = Math.max(mx, k.h); });
    if (cycle) {
      mn = Math.min(mn, cycle.level - 2); mx = Math.max(mx, cycle.level + 2);
      if (cycle.phase !== 'approach') {
        const far = cycle.level + cycle.dir * TP[2];
        mn = Math.min(mn, far - 1); mx = Math.max(mx, far + 1);
      }
    }
    view.min = lerp(view.min, mn - 1.5, 0.08);
    view.max = lerp(view.max, mx + 1.5, 0.08);
    const top = H * 0.16, bot = H * 0.86;
    const y = (p) => top + ((view.max - p) / (view.max - view.min)) * (bot - top);
    const x0 = W * 0.97 - list.length * STEP;

    // grid
    c2d.strokeStyle = 'rgba(244,241,234,0.05)';
    c2d.lineWidth = 1;
    for (let gy = Math.ceil(view.min); gy <= view.max; gy += 2) {
      c2d.beginPath(); c2d.moveTo(0, Math.round(y(gy)) + 0.5); c2d.lineTo(W, Math.round(y(gy)) + 0.5); c2d.stroke();
    }

    // targets
    if (cycle && cycle.phase !== 'approach' && cycle.phase !== 'break') {
      TP.forEach((d, i) => {
        const py = y(cycle.level + cycle.dir * d);
        const hit = i < cycle.hits;
        c2d.setLineDash(hit ? [] : [5, 7]);
        c2d.strokeStyle = hit ? GOLD_HI : 'rgba(244,241,234,0.3)';
        c2d.beginPath(); c2d.moveTo(0, py); c2d.lineTo(W, py); c2d.stroke();
        c2d.setLineDash([]);
        c2d.fillStyle = hit ? GOLD_HI : 'rgba(244,241,234,0.45)';
        c2d.font = '700 11px "JB Mono", monospace';
        c2d.fillText(`TP${i + 1}${hit ? ' ✓' : ''}`, 14, py - 6);
      });
      if (cycle.hits >= 3) {
        // his call when the last target lands
        c2d.fillStyle = GOLD_HI;
        c2d.font = '800 20px Alexandria, Cairo, sans-serif';
        c2d.fillText('اضرب يا ذياب 🐺', 14, y(cycle.level + cycle.dir * TP[2]) - (cycle.dir === 1 ? 30 : -42));
      }
    }

    // candles
    const bw = Math.max(3, STEP * 0.56);
    list.forEach((k, i) => {
      const cx = x0 + i * STEP + STEP / 2;
      const bull = k.c >= k.o;
      c2d.strokeStyle = bull ? GOLD : BEAR;
      c2d.fillStyle = bull ? GOLD : '#141414';
      c2d.beginPath(); c2d.moveTo(cx, y(k.h)); c2d.lineTo(cx, y(k.l)); c2d.stroke();
      const yt = y(Math.max(k.o, k.c)), yb = y(Math.min(k.o, k.c));
      const hgt = Math.max(1.5, yb - yt);
      c2d.fillRect(cx - bw / 2, yt, bw, hgt);
      if (!bull) c2d.strokeRect(cx - bw / 2 + 0.5, yt + 0.5, bw - 1, hgt - 1);
      if (k.isBreak && k !== cur) flashX = cx;
    });

    // level
    if (cycle) {
      const ly = y(cycle.level);
      c2d.lineWidth = 2;
      c2d.strokeStyle = cycle.phase === 'approach' || cycle.phase === 'break' ? GOLD : 'rgba(212,169,79,0.55)';
      c2d.beginPath(); c2d.moveTo(0, ly); c2d.lineTo(W, ly); c2d.stroke();
      c2d.lineWidth = 1;
      const label = `${cycle.dir === 1 ? 'BUY ▲' : 'SELL ▼'} ${cycle.level.toFixed(2)}`;
      c2d.font = '700 12px "JB Mono", monospace';
      const tw = c2d.measureText(label).width + 16;
      c2d.fillStyle = GOLD;
      c2d.fillRect(W - tw - 10, ly - 11, tw, 22);
      c2d.fillStyle = '#050505';
      c2d.fillText(label, W - tw - 2, ly + 4);
      if (cycle.phase === 'run' || cycle.phase === 'cool') {
        // stop sits on the entry once TP1 is in
        const sy = cycle.hits >= 1 ? ly : y(cycle.level - cycle.dir * 2.6);
        c2d.setLineDash([3, 6]);
        c2d.strokeStyle = cycle.hits >= 1 ? 'rgba(212,169,79,0.7)' : STOP;
        c2d.beginPath(); c2d.moveTo(0, sy + (cycle.hits >= 1 ? 4 : 0)); c2d.lineTo(W, sy + (cycle.hits >= 1 ? 4 : 0)); c2d.stroke();
        c2d.setLineDash([]);
      }
    }

    // break flash
    if (flash > 0.01 && cycle) {
      const ly = y(cycle.level);
      c2d.strokeStyle = `rgba(241,212,136,${flash})`;
      c2d.lineWidth = 2;
      c2d.beginPath();
      c2d.arc(flashX, ly, (1 - flash) * 90 + 6, 0, Math.PI * 2);
      c2d.stroke();
      c2d.lineWidth = 1;
      c2d.fillStyle = `rgba(241,212,136,${flash})`;
      c2d.font = '400 18px "Anton", sans-serif';
      c2d.fillText('BREAK', flashX + 12, ly - 14);
      flash *= 0.965;
    }
  }

  function frame(now) {
    if (!running) return;
    if (!cur) startCandle(now);
    updateForming(now);
    draw();
    raf = requestAnimationFrame(frame);
  }

  function start() {
    if (running || reduced) return;
    running = true;
    raf = requestAnimationFrame(frame);
  }
  function stop() { running = false; cancelAnimationFrame(raf); }

  // Warm up: build history so the chart is full on first paint.
  newCycle(-1);
  for (let i = 0; i < 70; i++) { startCandle(0); finishCandle(); }
  // make the first visible cycle a fresh one
  newCycle(cycle.dir);
  cur = null;
  flash = 0;
  resize();
  if (reduced) { draw(); }

  const io = new IntersectionObserver(([e]) => {
    inView = e.isIntersecting;
    if (inView && !document.hidden) start(); else stop();
  });
  io.observe(canvas);
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) stop(); else if (inView) start();
  });
  let rt = 0;
  window.addEventListener('resize', () => { clearTimeout(rt); rt = setTimeout(() => { resize(); draw(); }, 120); });

  return { start, stop };
}
