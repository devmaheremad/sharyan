// Intro loader: the price ticks up to the level while the page loads, then the line breaks open.
// Opens on its own (no click). Plays sound only if the browser already allows it.

import { qs, clamp } from './util.js';
import { sound } from './audio.js';
import { price } from './price.js';

export function runIntro({ motion, onDone }) {
  const intro = qs('#intro');
  const priceEl = qs('#intro-price');
  const fillEl = qs('#intro-fill');
  const pctEl = qs('#intro-pct');
  const start = performance.now();
  const MIN = motion ? 2400 : 300;   // the counter never finishes before this
  const MAX = 7000;                  // and never waits longer than this

  // Real loading signals.
  let loaded = 0.15;
  const add = (w) => { loaded = Math.min(1, loaded + w); };
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(() => add(0.3)); else add(0.3);
  const hero = qs('#hero-img');
  if (hero) {
    if (hero.complete) add(0.3);
    else { hero.addEventListener('load', () => add(0.3), { once: true }); hero.addEventListener('error', () => add(0.3), { once: true }); }
  } else add(0.3);
  if (document.readyState === 'complete') add(0.25); else window.addEventListener('load', () => add(0.25), { once: true });

  let shown = 0;
  let lastStep = -1;
  let finished = false;
  // The counter climbs to the live gold price (3870.00, his 17 Nov level, if the market feed is slow).
  let target = 3870;
  const levelEl = qs('.intro__level');
  const tagEl = qs('.intro__tag');
  let gotPrice = false;
  const usePrice = (p) => {
    if (!p || gotPrice || shown > 0.6) return;
    gotPrice = true;
    target = p;
    levelEl.textContent = p.toFixed(2);
    tagEl.innerHTML = '<span dir="ltr">XAUUSD</span> · سعر الذهب الآن';
  };
  price.first(1800).then(usePrice);

  function paint() {
    const value = target - 70 + shown * 70;
    priceEl.textContent = value.toFixed(2);
    fillEl.style.transform = `scaleX(${shown})`;
    pctEl.textContent = `${String(Math.round(shown * 100)).padStart(2, '0')}%`;
  }

  function frame(now) {
    const elapsed = now - start;
    const goal = elapsed > MAX ? 1 : Math.min(loaded, elapsed / MIN);
    shown += (goal - shown) * 0.12;
    if (goal >= 1 && shown > 0.995) shown = 1;
    paint();
    const step = Math.floor(shown * 24);
    if (step !== lastStep) { lastStep = step; sound.introTick(shown); }
    if (shown >= 1) { finish(); return; }
    requestAnimationFrame(frame);
  }

  function finish() {
    if (finished) return;
    finished = true;
    const done = () => {
      intro.classList.add('is-gone');
      document.body.classList.remove('is-locked');
      onDone();
    };
    const gsap = window.gsap;
    if (!motion || !gsap) {
      if (gsap) gsap.to(intro, { opacity: 0, duration: 0.3, onComplete: done }); else done();
      return;
    }
    sound.crack();
    sound.rev(1.6, 40, 210, 0.45);
    gsap.timeline({ onComplete: done })
      .to('.intro__price', { color: '#f1d488', duration: 0.12 }, 0)
      .to('.intro__line', { scaleY: 3, duration: 0.08 }, 0.05)
      .to('.intro__top', { y: -30, opacity: 0, duration: 0.35, ease: 'power2.in' }, 0.15)
      .to('.intro__bottom', { y: 30, opacity: 0, duration: 0.35, ease: 'power2.in' }, 0.15)
      .to('.intro__half--top', { yPercent: -100, duration: 0.95, ease: 'expo.inOut' }, 0.3)
      .to('.intro__half--bottom', { yPercent: 100, duration: 0.95, ease: 'expo.inOut' }, 0.3)
      .to('.intro__line', { scaleX: 0, transformOrigin: '50% 50%', duration: 0.6, ease: 'expo.in' }, 0.32);
  }

  // entrance of the loader itself
  if (motion && window.gsap) {
    window.gsap.from('.intro__brand, .intro__price, .intro__tag', { y: 16, opacity: 0, duration: 0.7, stagger: 0.08, ease: 'power3.out' });
    window.gsap.from('.intro__slogan, .intro__pct', { y: -12, opacity: 0, duration: 0.7, stagger: 0.08, delay: 0.2, ease: 'power3.out' });
  }
  paint();
  requestAnimationFrame(frame);
  return { skip: () => { loaded = 1; shown = clamp(shown, 0.98, 1); } };
}
