// SHARYAN concept — entry point.
// The page is static by default. After the gate, "motion" mode adds the pinned, scroll-driven film.

import { qs, qsa, reducedMotion } from './util.js';
import { sound } from './audio.js';
import { initGate } from './gate.js';
import { initHeroChart } from './hero.js';
import { initMethod } from './method.js';
import { initCrew } from './crew.js';
import { initStatements, initLife, initGauges, initTower, initWall, initGears, initOutro } from './sections.js';
import { initClock, initSoundToggle, initProgress, initCrosshair } from './hud.js';

const { gsap, ScrollTrigger, Lenis } = window;
let lenis = null;
let heroChart = null;

function heroIntro() {
  const tl = gsap.timeline();
  tl.from('.hero__photo img', { scale: 1.18, filter: 'grayscale(1) contrast(1.25) brightness(0)', duration: 1.6, ease: 'expo.out', clearProps: 'filter,transform' }, 0)
    .from('.hero__title .word', { yPercent: 105, opacity: 0, duration: 1, ease: 'expo.out', stagger: 0.12 }, 0.15)
    .from('.hero__slogan', { opacity: 0, letterSpacing: '0.6em', duration: 1.1, ease: 'expo.out', clearProps: 'letterSpacing' }, 0.45)
    .from('.hero .eyebrow, .hero__lede, .hero__chips li, .hero__cta > *', { opacity: 0, y: 18, duration: 0.6, ease: 'power3.out', stagger: 0.06 }, 0.6)
    .from('.hud', { opacity: 0, y: -12, duration: 0.6 }, 0.5);
}

// Build every section, in motion or static mode.
function boot(motion) {
  const reduced = !motion || !gsap || !ScrollTrigger;
  if (!reduced) {
    document.documentElement.classList.add('motion');
    gsap.registerPlugin(ScrollTrigger);
    ScrollTrigger.config({ ignoreMobileResize: true });
    if (Lenis) {
      lenis = new Lenis({ lerp: 0.1, smoothWheel: true });
      lenis.on('scroll', ScrollTrigger.update);
      gsap.ticker.add((time) => lenis.raf(time * 1000));
      gsap.ticker.lagSmoothing(0);
      lenis.stop();
      lenis.on('scroll', (e) => sound.energy(Math.abs(e.velocity) / 60));
    }
  }

  heroChart = initHeroChart(qs('#hero-chart'), { reduced });
  initMethod({ reduced });
  initStatements({ reduced });
  initLife({ reduced });
  initGauges({ reduced });
  initTower({ reduced });
  initWall({ reduced });
  initGears({ reduced });
  initCrew({ reduced });
  initOutro({ reduced });
  initProgress(lenis);
  if (!reduced) initCrosshair();
  if (!reduced) gsap.set('.hero__content, .hero__photo', { opacity: 0 });
  return reduced;
}

function start() {
  document.documentElement.classList.add('js');
  const heroImg = qs('#hero-img');
  const failImg = () => heroImg.closest('.hero__photo').classList.add('is-failed');
  heroImg.addEventListener('error', failImg);
  if (heroImg.complete && heroImg.naturalWidth === 0) failImg();

  // in-page links glide with Lenis
  qsa('a[href^="#"]').forEach((a) => {
    a.addEventListener('click', (e) => {
      const target = qs(a.getAttribute('href'));
      if (!target) return;
      e.preventDefault();
      if (lenis) lenis.scrollTo(target, { offset: 0, duration: 1.6 });
      else target.scrollIntoView({ behavior: 'auto' });
      if (a.getAttribute('href') === '#method') sound.whoosh(0.9, 0.35);
    });
  });

  initClock();
  initSoundToggle();

  let reduced = true;
  initGate({
    prefersReduced: reducedMotion(),
    onChoose: (motion) => {
      try { reduced = boot(motion); } catch (err) { console.error(err); reduced = true; }
    },
    onOpen: () => {
      if (!reduced) {
        gsap.set('.hero__content, .hero__photo', { opacity: 1 });
        heroIntro();
        heroChart.start();
        if (lenis) lenis.start();
        ScrollTrigger.refresh();
        // fonts change metrics: re-measure the pins once they are in
        if (document.fonts) document.fonts.ready.then(() => ScrollTrigger.refresh());
      }
    },
  });
}

try {
  start();
} catch (err) {
  // never leave visitors stuck behind the gate
  console.error(err);
  qs('#gate')?.classList.add('is-gone');
  document.body.classList.remove('is-locked');
}
