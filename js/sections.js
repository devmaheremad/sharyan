// Sections 02-05 and the outro.

import { qs, qsa, svgEl, splitWords, fmtInt } from './util.js';
import { sound } from './audio.js';
import { LEDGER, WALL, img } from './data.js';

const gsap = () => window.gsap;

// ---------- 02: statements, word by word (never letter by letter: Arabic joins) ----------
export function initStatements({ reduced }) {
  qsa('[data-split]').forEach((el) => {
    const words = splitWords(el);
    if (reduced) return;
    gsap().set(words, { yPercent: 70, opacity: 0 });
    window.ScrollTrigger.create({
      trigger: el,
      start: 'top 82%',
      once: true,
      onEnter: () => {
        gsap().to(words, { yPercent: 0, opacity: 1, duration: 0.7, ease: 'power3.out', stagger: 0.055 });
        sound.whoosh(0.5, 0.18);
      },
    });
  });
}

// ---------- 02: lifestyle track (horizontal on desktop) ----------
export function initLife({ reduced }) {
  // Inline the line-art symbols so every stroke can be drawn.
  qsa('.life-card__art').forEach((svg) => {
    const use = svg.querySelector('use');
    const sym = use && qs(use.getAttribute('href'));
    if (!sym) return;
    use.remove();
    [...sym.children].forEach((n) => svg.appendChild(n.cloneNode(true)));
    qsa('path, rect, circle', svg).forEach((s) => s.setAttribute('pathLength', '1'));
  });
  if (reduced) return;

  const track = qs('#life-track');
  const cards = qsa('.life-card', track).filter((c) => c.querySelector('.life-card__art'));
  const strokes = (card) => qsa('.life-card__art path, .life-card__art rect, .life-card__art circle', card);
  cards.forEach((c) => gsap().set(strokes(c), { strokeDasharray: 1, strokeDashoffset: 1 }));

  const drawn = new WeakSet();
  const draw = (card) => {
    if (drawn.has(card)) return;
    drawn.add(card);
    gsap().to(strokes(card), { strokeDashoffset: 0, duration: 1.3, ease: 'power2.inOut', stagger: 0.05 });
    sound.tick(2);
  };
  // Draw each card once most of it is on screen (works for the RTL track moving right).
  const check = () => {
    const vw = window.innerWidth;
    cards.forEach((card) => {
      const r = card.getBoundingClientRect();
      if (r.top < window.innerHeight * 0.85 && r.bottom > 0 && r.right > vw * 0.3 && r.left < vw * 0.85) draw(card);
    });
  };

  const mm = gsap().matchMedia();
  mm.add('(min-width: 801px)', () => {
    const dist = () => Math.max(0, track.scrollWidth - window.innerWidth);
    // RTL: the track overflows to the left, so it slides to the right.
    gsap().to(track, {
      x: () => dist(),
      ease: 'none',
      onUpdate: check, // runs on every scrubbed frame, so it follows the lagging track
      scrollTrigger: {
        trigger: '#life',
        start: 'top top+=70',
        end: () => `+=${dist()}`,
        pin: true,
        scrub: 0.6,
        invalidateOnRefresh: true,
      },
    });
    window.ScrollTrigger.create({ trigger: '#life', start: 'top 75%', onEnter: check });
  });
  mm.add('(max-width: 800px)', () => {
    cards.forEach((card) => window.ScrollTrigger.create({ trigger: card, start: 'top 80%', once: true, onEnter: () => draw(card) }));
  });
}

// ---------- 03: tachometers ----------
const START = 210; // degrees, math orientation
const SWEEP = 240;
const CX = 120, CY = 120, R = 90;
const polar = (deg, r) => {
  const a = (deg * Math.PI) / 180;
  return [CX + r * Math.cos(a), CY - r * Math.sin(a)];
};
const arc = (from, to, r) => {
  const a = START - SWEEP * from;
  const b = START - SWEEP * to;
  const [x1, y1] = polar(a, r);
  const [x2, y2] = polar(b, r);
  const large = (to - from) * SWEEP > 180 ? 1 : 0;
  return `M${x1} ${y1} A${r} ${r} 0 ${large} 1 ${x2} ${y2}`;
};

function formatGauge(v, fmt) {
  if (fmt === 'k') return `${(v / 1000).toFixed(1)}K`;
  if (fmt === 'plus') return `${fmtInt(v)}+`;
  return fmtInt(v);
}

export function initGauges({ reduced }) {
  const gauges = qsa('.gauge');
  gauges.forEach((fig) => {
    const svg = qs('.gauge__svg', fig);
    const max = Number(fig.dataset.max);
    svgEl('path', { class: 'g-track', d: arc(0, 1, R) }, svg);
    svgEl('path', { class: 'g-red', d: arc(0.86, 1, R) }, svg);
    const fill = svgEl('path', { class: 'g-fill', d: arc(0, 1, R), pathLength: 1 }, svg);
    for (let i = 0; i <= 20; i++) {
      const f = i / 20;
      const major = i % 5 === 0;
      const [x1, y1] = polar(START - SWEEP * f, R - 10);
      const [x2, y2] = polar(START - SWEEP * f, R - (major ? 24 : 17));
      svgEl('line', { class: `g-tick${major ? ' is-major' : ''}`, x1, y1, x2, y2 }, svg);
      if (major) {
        const [lx, ly] = polar(START - SWEEP * f, R - 38);
        const t = svgEl('text', { class: 'g-label', x: lx, y: ly + 3 }, svg);
        t.textContent = max >= 10000 ? `${Math.round((max * f) / 1000)}K` : `${Math.round(max * f)}`;
      }
    }
    const [nx, ny] = polar(START, R - 14);
    const needle = svgEl('line', { class: 'g-needle', x1: CX, y1: CY, x2: nx, y2: ny }, svg);
    svgEl('circle', { class: 'g-hub', cx: CX, cy: CY, r: 7 }, svg);
    fig._g = { fill, needle, max };
  });

  const setGauge = (fig, v) => {
    const { fill, needle, max } = fig._g;
    const f = Math.min(1, v / max);
    fill.style.strokeDasharray = '1';
    fill.style.strokeDashoffset = `${1 - f}`;
    needle.setAttribute('transform', `rotate(${SWEEP * f} ${CX} ${CY})`);
  };

  if (reduced || !window.gsap) {
    gauges.forEach((fig) => setGauge(fig, Number(fig.dataset.value)));
    return;
  }
  gauges.forEach((fig) => setGauge(fig, 0));

  window.ScrollTrigger.create({
    trigger: '.gauges',
    start: 'top 75%',
    once: true,
    onEnter: () => {
      sound.rev(1.6, 40, 230, 0.6);
      gauges.forEach((fig, i) => {
        const target = Number(fig.dataset.value);
        const num = qs('.gauge__num', fig);
        const st = { v: 0 };
        // ignition self-test: sweep to the redline, drop, then settle on the value
        gsap().timeline({ delay: i * 0.12 })
          .to(st, { v: fig._g.max, duration: 0.55, ease: 'power2.out', onUpdate: () => setGauge(fig, st.v) })
          .to(st, { v: 0, duration: 0.45, ease: 'power2.in', onUpdate: () => setGauge(fig, st.v) })
          .to(st, {
            v: target, duration: 1.3, ease: 'back.out(0.9)',
            onUpdate: () => { setGauge(fig, st.v); num.textContent = formatGauge(Math.max(0, st.v), fig.dataset.format); },
            onComplete: () => { num.textContent = formatGauge(target, fig.dataset.format); },
          });
      });
    },
  });
}

// ---------- 04: timing tower ----------
export function initTower({ reduced }) {
  const body = qs('#tower-body');
  LEDGER.forEach((r) => {
    const row = document.createElement('div');
    row.className = 'tower__row';
    row.setAttribute('role', 'row');
    const hits = ['TP1', 'TP2', 'TP3'].map((t) => `<span class="${r.hits.includes(t) ? 'is-hit' : ''}">${t}</span>`).join('');
    const extra = r.extra ? `<span class="is-extra">${r.extra} ✓</span>` : '';
    row.innerHTML = `
      <span role="cell" class="t-day">${r.day}</span>
      <span role="cell" class="t-dir ${r.dir === 'buy' ? 'is-buy' : 'is-sell'}">${r.dir === 'buy' ? 'شراء ▲' : 'بيع ▼'}</span>
      <span role="cell" class="t-level" dir="ltr">${r.level}</span>
      <span role="cell" class="t-time" dir="ltr">${r.time}</span>
      <span role="cell" class="t-hits" dir="ltr">${hits}${extra}</span>`;
    body.appendChild(row);
  });
  if (reduced || !window.gsap) return;

  const rows = qsa('.tower__row', body);
  rows.forEach((row) => {
    const lit = qsa('.t-hits span.is-hit, .t-hits span.is-extra', row);
    lit.forEach((s) => s.classList.add('pending'));
    gsap().set(row, { opacity: 0, x: 60 });
    window.ScrollTrigger.create({
      trigger: row,
      start: 'top 88%',
      once: true,
      onEnter: () => {
        const tl = gsap().timeline();
        tl.to(row, { opacity: 1, x: 0, duration: 0.6, ease: 'power3.out' });
        lit.forEach((s, i) => {
          s.classList.remove('is-hit', 'is-extra');
          const cls = s.textContent.startsWith('TP') ? 'is-hit' : 'is-extra';
          tl.add(() => { s.classList.add(cls); sound.tick(i + 1); }, 0.35 + i * 0.16);
        });
      },
    });
  });
}

// ---------- 04: proof wall ----------
export function initWall({ reduced }) {
  const rowsEl = qs('#wall-rows');
  const half = Math.ceil(WALL.length / 2);
  const groups = [WALL.slice(0, half), WALL.slice(half - 1)];
  const box = qs('#lightbox');
  const big = qs('#lightbox-img');
  const open = (url, i) => {
    big.src = img(url, 1000);
    big.alt = `نتيجة متابع منشورة على sharyan.io، صورة ${i + 1} من ${WALL.length}`;
    if (typeof box.showModal === 'function') box.showModal(); else box.setAttribute('open', '');
    sound.tick(3);
  };
  qs('#lightbox-close').addEventListener('click', () => box.close());
  box.addEventListener('click', (e) => { if (e.target === box) box.close(); });

  const rows = groups.map((list, gi) => {
    const row = document.createElement('div');
    row.className = 'wall__row';
    // twice for a seamless loop; the copy is hidden from assistive tech
    [0, 1].forEach((copy) => {
      list.forEach((url) => {
        const idx = WALL.indexOf(url);
        const b = document.createElement('button');
        b.type = 'button';
        if (copy) { b.tabIndex = -1; b.setAttribute('aria-hidden', 'true'); }
        b.setAttribute('aria-label', `كبّر الصورة ${idx + 1}`);
        const im = document.createElement('img');
        im.src = img(url, 420);
        im.alt = copy ? '' : `نتيجة متابع منشورة على sharyan.io، صورة ${idx + 1}`;
        im.loading = 'lazy';
        im.decoding = 'async';
        im.width = 420; im.height = 747;
        b.appendChild(im);
        b.addEventListener('click', () => open(url, idx));
        row.appendChild(b);
      });
    });
    rowsEl.appendChild(row);
    return { row, dir: gi ? 1 : -1 };
  });
  if (reduced || !window.gsap) {
    rowsEl.style.overflowX = 'auto';
    return;
  }

  const tweens = rows.map(({ row, dir }) => {
    const tw = gsap().fromTo(row, { xPercent: dir === -1 ? 0 : -50 }, { xPercent: dir === -1 ? -50 : 0, duration: 60, ease: 'none', repeat: -1 });
    row.addEventListener('mouseenter', () => gsap().to(tw, { timeScale: 0.05, duration: 0.5 }));
    row.addEventListener('mouseleave', () => gsap().to(tw, { timeScale: 1, duration: 0.5 }));
    return tw;
  });
  // scroll speed pushes the wall
  window.ScrollTrigger.create({
    trigger: rowsEl,
    start: 'top bottom',
    end: 'bottom top',
    onUpdate: (self) => {
      const boost = 1 + Math.min(6, Math.abs(self.getVelocity()) / 400);
      tweens.forEach((tw) => gsap().to(tw, { timeScale: boost, duration: 0.2, overwrite: true }));
    },
    onToggle: (self) => tweens.forEach((tw) => (self.isActive ? tw.play() : tw.pause())),
  });
  gsap().fromTo(rowsEl, { rotateX: 14 }, {
    rotateX: 0, ease: 'none',
    scrollTrigger: { trigger: rowsEl, start: 'top bottom', end: 'center center', scrub: true },
  });
}

// ---------- 05: gear shifter ----------
const KNOB = { 1: [40, 40], 2: [40, 200], 3: [110, 40] };
export function initGears({ reduced }) {
  const tabs = qsa('.shifter__buttons [role="tab"]');
  const knob = qs('#shifter-knob');
  let gear = 1;
  let busy = false;
  const modulesDone = new WeakSet();

  const unlockModules = (panel) => {
    const items = qsa('.modules li', panel);
    if (!items.length || modulesDone.has(panel)) return;
    modulesDone.add(panel);
    items.forEach((li, i) => setTimeout(() => { li.classList.add('is-open'); sound.tick(i % 3); }, reduced ? 0 : 380 + i * 110));
  };

  function select(next, focus) {
    if (next === gear || busy) return;
    const from = KNOB[gear], to = KNOB[next];
    const oldPanel = qs(`#gear-${gear}`);
    const newPanel = qs(`#gear-${next}`);
    tabs.forEach((t) => {
      const on = Number(t.dataset.gear) === next;
      t.setAttribute('aria-selected', String(on));
      t.tabIndex = on ? 0 : -1;
    });
    if (focus) qs(`#tab-${next}`).focus();
    gear = next;
    sound.shift();

    if (reduced || !window.gsap) {
      knob.setAttribute('cx', to[0]); knob.setAttribute('cy', to[1]);
      oldPanel.hidden = true; newPanel.hidden = false; unlockModules(newPanel);
      return;
    }
    busy = true;
    // through neutral: out of the slot, across, into the new slot
    gsap().timeline({ onComplete: () => { busy = false; } })
      .to(knob, { attr: { cy: 120 }, duration: 0.14, ease: 'power2.in' })
      .to(knob, { attr: { cx: to[0] }, duration: 0.14, ease: 'power1.inOut' })
      .to(knob, { attr: { cy: to[1] }, duration: 0.18, ease: 'power3.out' });
    // outgoing text leaves first, incoming arrives after (separate timings)
    const outKids = [...oldPanel.children];
    gsap().to(outKids, {
      opacity: 0, y: -16, duration: 0.22, stagger: 0.03, ease: 'power2.in',
      onComplete: () => {
        oldPanel.hidden = true;
        gsap().set(outKids, { clearProps: 'opacity,transform' });
        newPanel.hidden = false;
        gsap().fromTo([...newPanel.children], { opacity: 0, y: 22 }, { opacity: 1, y: 0, duration: 0.45, stagger: 0.05, ease: 'power3.out' });
        unlockModules(newPanel);
      },
    });
    void from;
  }

  tabs.forEach((t) => {
    t.addEventListener('click', () => select(Number(t.dataset.gear)));
    t.addEventListener('keydown', (e) => {
      const order = [1, 2, 3];
      const i = order.indexOf(gear);
      if (e.key === 'ArrowDown') { e.preventDefault(); select(order[(i + 1) % 3], true); }
      if (e.key === 'ArrowUp') { e.preventDefault(); select(order[(i + 2) % 3], true); }
      if (e.key === 'Home') { e.preventDefault(); select(1, true); }
      if (e.key === 'End') { e.preventDefault(); select(3, true); }
    });
  });
  // keyboard shortcuts 1 / 2 / 3 while the section is on screen
  let onScreen = false;
  new IntersectionObserver(([e]) => { onScreen = e.isIntersecting; }).observe(qs('.shifter'));
  window.addEventListener('keydown', (e) => {
    if (!onScreen || e.target.closest('input, textarea')) return;
    if (['1', '2', '3'].includes(e.key)) select(Number(e.key));
  });
}

// ---------- outro ----------
export function initOutro({ reduced }) {
  const fal = qs('.outro__falcon');
  // inline the falcon so it can be animated as one shape
  const use = fal.querySelector('use');
  const sym = qs('#falcon');
  use.remove();
  [...sym.children].forEach((n) => fal.appendChild(n.cloneNode(true)));
  if (reduced || !window.gsap) return;
  gsap().set(fal, { xPercent: -140, yPercent: -60, rotate: 18, opacity: 0 });
  window.ScrollTrigger.create({
    trigger: '.outro',
    start: 'top 70%',
    once: true,
    onEnter: () => {
      sound.whoosh(0.8, 0.4);
      setTimeout(() => sound.screech(), 260);
      gsap().to(fal, { xPercent: 0, yPercent: 0, rotate: 0, opacity: 1, duration: 1.1, ease: 'power3.out' });
      const words = splitWords(qs('.outro__title'));
      gsap().fromTo(words, { yPercent: 80, opacity: 0 }, { yPercent: 0, opacity: 1, duration: 0.8, stagger: 0.08, delay: 0.35, ease: 'power3.out' });
    },
  });
}
