// Sections 05-06 and the outro: engine START buttons, the stream dictionary, the falcon and the gold light.

import { qs, qsa, splitWords } from './util.js';
import { sound } from './audio.js';

const gsap = () => window.gsap;

// ---------- 05: services as engine START buttons ----------
const MODES = { 1: 'MODE 01 · LIVE STREAM', 2: 'MODE 02 · PERSONAL TRAINING', 3: 'MODE 03 · SHARYAN FUNDED' };

export function initServices({ reduced }) {
  const tabs = qsa('.dash__buttons [role="tab"]');
  const box = qs('#dash-panels');
  const modeEl = qs('#dash-mode');
  const rpm = qsa('.dash__rpm i');
  let gear = 1;
  let busy = false;
  let typing = 0;
  const modulesDone = new WeakSet();

  const unlockModules = (panel) => {
    const items = qsa('.modules li', panel);
    if (!items.length || modulesDone.has(panel)) return;
    modulesDone.add(panel);
    items.forEach((li, i) => setTimeout(() => { li.classList.add('is-open'); sound.tick(i % 3); }, reduced ? 0 : 420 + i * 110));
  };
  const paintRpm = (v) => rpm.forEach((el, k) => {
    const on = k < Math.round(v);
    el.classList.toggle('is-on', on && k < 6);
    el.classList.toggle('is-red', on && k >= 6);
  });
  const revBar = () => {
    if (reduced || !window.gsap) { paintRpm(3); return; }
    const st = { v: 0 };
    gsap().timeline()
      .to(st, { v: 8, duration: 0.55, ease: 'power2.out', onUpdate: () => paintRpm(st.v) })
      .to(st, { v: 3, duration: 0.8, ease: 'power2.inOut', onUpdate: () => paintRpm(st.v) });
  };
  const typeMode = (text) => {
    clearInterval(typing);
    if (reduced) { modeEl.textContent = text; return; }
    let i = 0;
    typing = setInterval(() => {
      modeEl.textContent = text.slice(0, ++i);
      if (i >= text.length) clearInterval(typing);
    }, 22);
  };
  const press = (btn) => {
    btn.classList.add('is-pressed');
    setTimeout(() => btn.classList.remove('is-pressed'), 180);
  };

  function select(next, { focus = false, demo = false } = {}) {
    if (busy) return;
    const btn = qs(`#tab-${next}`);
    press(btn);
    sound.ignition();
    revBar();
    typeMode(MODES[next]);
    if (next === gear) { if (demo) unlockModules(qs(`#gear-${next}`)); return; }
    const oldPanel = qs(`#gear-${gear}`);
    const newPanel = qs(`#gear-${next}`);
    tabs.forEach((t) => {
      const on = Number(t.dataset.gear) === next;
      t.setAttribute('aria-selected', String(on));
      t.tabIndex = on ? 0 : -1;
    });
    if (focus) btn.focus();
    gear = next;
    if (reduced || !window.gsap) {
      oldPanel.hidden = true;
      newPanel.hidden = false;
      unlockModules(newPanel);
      return;
    }
    busy = true;
    // the screen powers down to a line, the panel changes, and it powers back up
    gsap().timeline({ onComplete: () => { busy = false; } })
      .to(box, { scaleY: 0.012, opacity: 0.6, duration: 0.2, ease: 'power3.in' })
      .add(() => { oldPanel.hidden = true; newPanel.hidden = false; })
      .to(box, { scaleY: 1, opacity: 1, duration: 0.45, ease: 'expo.out' })
      .fromTo([...newPanel.children], { opacity: 0, y: 18 }, { opacity: 1, y: 0, duration: 0.45, stagger: 0.05, ease: 'power3.out' }, '-=0.3')
      .add(() => unlockModules(newPanel));
  }

  tabs.forEach((t) => {
    t.addEventListener('click', () => select(Number(t.dataset.gear)));
    t.addEventListener('keydown', (e) => {
      const order = [1, 2, 3];
      const i = order.indexOf(gear);
      if (e.key === 'ArrowDown' || e.key === 'ArrowLeft') { e.preventDefault(); select(order[(i + 1) % 3], { focus: true }); }
      if (e.key === 'ArrowUp' || e.key === 'ArrowRight') { e.preventDefault(); select(order[(i + 2) % 3], { focus: true }); }
      if (e.key === 'Home') { e.preventDefault(); select(1, { focus: true }); }
      if (e.key === 'End') { e.preventDefault(); select(3, { focus: true }); }
    });
  });
  paintRpm(3);
  if (reduced || !window.ScrollTrigger) return;
  // first view: button 1 presses itself, so it is obvious these are buttons
  window.ScrollTrigger.create({ trigger: '.dash', start: 'top 70%', once: true, onEnter: () => setTimeout(() => select(1, { demo: true }), 300) });
}

// ---------- 06: the stream dictionary ----------
const LINES = ['بكره الفقر… والفقراء.', 'وبدي غيّره.', 'بديش فقراء العرب.', 'اضرب يا ذياب!'];
const FX = {
  scratch: () => sound.scratch(),
  rise: () => sound.rise(),
  cash: () => sound.cash(),
  wolf: () => {
    sound.wolf();
    [1, 2, 3].forEach((n, i) => setTimeout(() => sound.target(n, 0.8), 250 + i * 260));
  },
};

export function initQuotes({ reduced }) {
  const track = qs('#quotes-track');
  const half = LINES.concat(LINES);
  half.concat(half).forEach((text) => {
    const span = document.createElement('span');
    span.textContent = text;
    span.dir = 'rtl';
    track.appendChild(span);
  });
  if (!reduced && window.gsap) gsap().to(track, { xPercent: -50, duration: 40, ease: 'none', repeat: -1 });

  qsa('.pad').forEach((pad) => {
    const words = splitWords(qs('.pad__quote', pad));
    if (!reduced && window.gsap) {
      gsap().set(words, { yPercent: 60, opacity: 0 });
      window.ScrollTrigger.create({
        trigger: pad,
        start: 'top 86%',
        once: true,
        onEnter: () => gsap().to(words, { yPercent: 0, opacity: 1, duration: 0.75, stagger: 0.07, ease: 'power3.out' }),
      });
    }
    pad.addEventListener('click', () => {
      const fx = pad.dataset.fx;
      if (FX[fx]) FX[fx]();
      if (reduced || !window.gsap) {
        pad.classList.add('is-playing');
        setTimeout(() => pad.classList.remove('is-playing'), 1200);
        return;
      }
      gsap().killTweensOf(pad);
      pad.classList.add('is-playing');
      gsap().timeline({ onComplete: () => pad.classList.remove('is-playing') })
        .fromTo(pad, { '--fill': 0 }, { '--fill': 1, duration: 0.32, ease: 'power3.out' })
        .fromTo(words, { scale: 1.35, opacity: 0 }, { scale: 1, opacity: 1, duration: 0.55, stagger: 0.08, ease: 'expo.out' }, 0.05)
        .to(pad, { '--fill': 0, duration: 0.5, ease: 'power2.in' }, fx === 'wolf' ? 2 : 1.3);
    });
  });
}

// ---------- outro: falcon in flight + "Faith over everything." under a light that follows the pointer ----------
export function initOutro({ reduced }) {
  const svg = qs('#outro-falcon');
  const use = svg.querySelector('use');
  const sym = qs('#falcon');
  use.remove();
  [...sym.children].forEach((n) => svg.appendChild(n.cloneNode(true)));
  const sky = qs('#outro-sky');
  const title = qs('#outro-title');
  const words = qsa(':scope > span', title);

  // the gold light, in each word's own coordinates
  let mx = window.innerWidth / 2;
  let my = window.innerHeight / 2;
  let raf = 0;
  let onScreen = false;
  const paint = () => {
    raf = 0;
    words.forEach((w) => {
      const r = w.getBoundingClientRect();
      w.style.setProperty('--mx', `${(mx - r.left).toFixed(1)}px`);
      w.style.setProperty('--my', `${(my - r.top).toFixed(1)}px`);
    });
  };
  new IntersectionObserver(([e]) => { onScreen = e.isIntersecting; }).observe(qs('.outro'));

  const hasGsap = !reduced && !!window.gsap;
  const magnet = hasGsap
    ? words.map((w) => ({ w, x: gsap().quickTo(w, 'x', { duration: 0.6, ease: 'power3.out' }), y: gsap().quickTo(w, 'y', { duration: 0.6, ease: 'power3.out' }) }))
    : [];
  const tilt = hasGsap
    ? { r: gsap().quickTo(svg, 'rotation', { duration: 0.9, ease: 'power3.out' }), x: gsap().quickTo(svg, 'x', { duration: 1.2, ease: 'power3.out' }) }
    : null;

  const touch = window.matchMedia('(hover: none)').matches;
  if (!touch) {
    window.addEventListener('pointermove', (e) => {
      if (!onScreen) return;
      mx = e.clientX;
      my = e.clientY;
      if (!raf) raf = requestAnimationFrame(paint);
      magnet.forEach(({ w, x, y }) => {
        const r = w.getBoundingClientRect();
        const dx = mx - (r.left + r.width / 2);
        const dy = my - (r.top + r.height / 2);
        const pull = Math.max(0, 1 - Math.hypot(dx, dy) / 420);
        x(dx * 0.06 * pull);
        y(dy * 0.08 * pull);
      });
      if (tilt) {
        const sr = sky.getBoundingClientRect();
        const nx = (mx - (sr.left + sr.width / 2)) / window.innerWidth;
        tilt.r(nx * 10);
        tilt.x(nx * 60);
      }
    }, { passive: true });
  } else if (hasGsap) {
    // phones: the light sweeps across on its own
    gsap().ticker.add((time) => {
      if (!onScreen) return;
      const r = title.getBoundingClientRect();
      mx = r.left + r.width * (0.5 + Math.sin(time * 0.8) * 0.45);
      my = r.top + r.height * 0.5;
      paint();
    });
  }
  paint();

  if (!hasGsap) return;
  // a soaring bob, separate from the pointer tilt
  gsap().to(sky, { y: -16, duration: 2.4, yoyo: true, repeat: -1, ease: 'sine.inOut' });
  gsap().set(svg, { xPercent: -140, yPercent: -50, opacity: 0, transformOrigin: '50% 50%' });
  gsap().set(words, { yPercent: 80, opacity: 0 });
  window.ScrollTrigger.create({
    trigger: '.outro',
    start: 'top 70%',
    once: true,
    onEnter: () => {
      sound.whoosh(0.8, 0.4);
      setTimeout(() => sound.screech(), 260);
      gsap().to(svg, { xPercent: 0, yPercent: 0, opacity: 1, duration: 1.2, ease: 'power3.out' });
      gsap().to(words, { yPercent: 0, opacity: 1, duration: 0.85, stagger: 0.09, delay: 0.35, ease: 'power3.out', onUpdate: paint });
    },
  });
}
