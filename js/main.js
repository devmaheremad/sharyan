// SHARYAN — entry point.
// The page is static by default; "motion" mode adds the pinned, scroll-driven film.
// Devices that ask for reduced motion get the static page plus an offer to turn motion on (remembered).

import { qs, qsa, reducedMotion } from './util.js';
import { sound, readPref, writePref } from './audio.js';
import { price } from './price.js';
import { runIntro } from './intro.js';
import { initHeroChart } from './hero.js';
import { initMethod } from './method.js';
import { initCrew } from './crew.js';
import { initStatements, initLife, initGauges, initTower, initWall } from './sections.js';
import { initServices, initQuotes, initOutro, initVoices, initReels } from './sections2.js';
import { initClock, initSoundUI, initMotionCard, initProgress, initCrosshair } from './hud.js';

const { gsap, ScrollTrigger, Lenis } = window;
let lenis = null;

function heroIntro() {
  const tl = gsap.timeline();
  tl.from('.hero__photo img', { scale: 1.16, filter: 'saturate(.85) contrast(1.08) brightness(0)', duration: 1.7, ease: 'expo.out', clearProps: 'filter,transform' }, 0)
    .from('.hero__title .word', { yPercent: 60, opacity: 0, duration: 1.1, ease: 'expo.out', stagger: 0.14 }, 0.15)
    .from('.hero__slogan', { opacity: 0, letterSpacing: '0.5em', duration: 1.1, ease: 'expo.out', clearProps: 'letterSpacing' }, 0.5)
    .from('.hero .eyebrow, .hero__lede, .hero__chips li, .hero__cta > *', { opacity: 0, y: 18, duration: 0.6, ease: 'power3.out', stagger: 0.06 }, 0.65)
    .from('.hud', { opacity: 0, y: -12, duration: 0.6 }, 0.55);
}

function boot(motion) {
  const reduced = !motion;
  if (motion) {
    document.documentElement.classList.add('motion');
    gsap.registerPlugin(ScrollTrigger);
    ScrollTrigger.config({ ignoreMobileResize: true });
    if (Lenis) {
      lenis = new Lenis({ lerp: 0.09, smoothWheel: true });
      lenis.on('scroll', ScrollTrigger.update);
      gsap.ticker.add((time) => lenis.raf(time * 1000));
      gsap.ticker.lagSmoothing(0);
      lenis.stop();
      lenis.on('scroll', (e) => sound.energy(Math.abs(e.velocity) / 60));
    }
  }
  const heroChart = initHeroChart(qs('#hero-chart'), { reduced });
  initMethod({ reduced });
  initStatements({ reduced });
  initLife({ reduced });
  initGauges({ reduced });
  initTower({ reduced });
  initWall({ reduced });
  initServices({ reduced });
  initQuotes({ reduced });
  initReels({ reduced });
  initCrew({ reduced });
  initOutro({ reduced });
  initProgress(lenis);
  if (motion) initCrosshair();
  if (motion) gsap.set('.hero__content, .hero__photo', { opacity: 0 });
  return heroChart;
}

function start() {
  document.documentElement.classList.add('js');
  const prefersReduced = reducedMotion();
  const forced = readPref('sharyan.motion') === 'on';
  const motion = (!prefersReduced || forced) && !!gsap && !!ScrollTrigger;

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
  price.start();
  const soundUI = initSoundUI();
  initVoices({ onEnable: () => writePref('on') });
  sound.onChange((on) => { if (on) sound.preloadVoices(['tp1', 'tp2', 'tp3', 'iam', 'inside']); });
  const motionCard = initMotionCard({ prefersReduced, forced });

  // Try to start sound straight away (works when the browser allows autoplay).
  if (sound.pref !== 'off') sound.tryAutoplay();

  let heroChart = null;
  try { heroChart = boot(motion); } catch (err) { console.error(err); }
  // the hero chart's labels sit at the live gold price
  if (heroChart) price.first(4000).then((p) => heroChart.setPrice(p));

  runIntro({
    motion,
    onDone: () => {
      if (motion) {
        gsap.set('.hero__content, .hero__photo', { opacity: 1 });
        heroIntro();
        if (lenis) lenis.start();
        ScrollTrigger.refresh();
        if (document.fonts) document.fonts.ready.then(() => ScrollTrigger.refresh());
      }
      if (heroChart) heroChart.start();
      setTimeout(() => { soundUI.afterIntro(); motionCard.afterIntro(); }, motion ? 900 : 200);
    },
  });
}

try {
  start();
} catch (err) {
  // never leave visitors stuck behind the intro
  console.error(err);
  qs('#intro')?.classList.add('is-gone');
  document.body.classList.remove('is-locked');
}
