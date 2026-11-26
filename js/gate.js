// The gate: the site opens by breaking the line it is standing on.
// It is also where the visitor picks sound on/off, and (if the device asks for less motion) full motion on/off.

import { qs, qsa, splitWords } from './util.js';
import { sound } from './audio.js';

export function initGate({ prefersReduced, onChoose, onOpen }) {
  const gate = qs('#gate');
  const withSound = qs('#enter-sound');
  const mute = qs('#enter-mute');
  const motionBox = qs('#gate-motion');
  const motionBtn = qs('#motion-toggle');
  let wantMotion = !prefersReduced;
  let opened = false;

  if (prefersReduced) {
    motionBox.classList.add('is-shown');
    motionBtn.addEventListener('click', () => {
      wantMotion = !wantMotion;
      motionBtn.setAttribute('aria-pressed', String(wantMotion));
      motionBtn.textContent = wantMotion ? 'الحركة الكاملة: شغّالة ✓' : 'شغّل الحركة الكاملة';
    });
  }

  const finish = () => {
    gate.classList.add('is-gone');
    gate.setAttribute('aria-hidden', 'true');
    document.body.classList.remove('is-locked');
    onOpen(wantMotion);
  };

  async function open(useSound) {
    if (opened) return;
    opened = true;
    onChoose(wantMotion);
    if (useSound) {
      await sound.enable();
      sound.crack();
      sound.rev(1.8, 40, 220, 0.6);
    }
    const gsap = window.gsap;
    if (!wantMotion || !gsap) { finish(); return; }
    const tl = gsap.timeline({ onComplete: finish });
    tl.to('.gate__inner--top', { opacity: 0, y: -24, duration: 0.25, ease: 'power2.in' }, 0)
      .to('.gate__inner--bottom', { opacity: 0, y: 24, duration: 0.25, ease: 'power2.in' }, 0)
      .to('.gate__line', { scaleY: 3, duration: 0.08 }, 0.05)
      .to('.gate__price', { opacity: 0, duration: 0.1 }, 0.05)
      .to('.gate__half--top', { yPercent: -100, duration: 0.9, ease: 'expo.inOut' }, 0.18)
      .to('.gate__half--bottom', { yPercent: 100, duration: 0.9, ease: 'expo.inOut' }, 0.18)
      .to('.gate__line', { scaleX: 0, transformOrigin: '50% 50%', duration: 0.6, ease: 'expo.in' }, 0.22);
  }

  withSound.addEventListener('click', () => open(true));
  mute.addEventListener('click', () => open(false));
  gate.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') open(false);
    if (e.key === 'Tab') {
      // keep focus inside the gate while it is open
      const f = [withSound, mute, ...(prefersReduced ? [motionBtn] : [])];
      const i = f.indexOf(document.activeElement);
      e.preventDefault();
      f[(i + (e.shiftKey ? f.length - 1 : 1)) % f.length].focus();
    }
  });
  withSound.focus({ preventScroll: true });

  // intro motion for the gate text (only when the device has not asked for less motion)
  if (!prefersReduced && window.gsap) {
    const words = qsa('.gate__title span').flatMap((s) => splitWords(s));
    window.gsap.from('.gate__line', { scaleX: 0, duration: 1.2, ease: 'expo.out' });
    window.gsap.from(words, { yPercent: 60, opacity: 0, duration: 0.7, stagger: 0.06, delay: 0.3, ease: 'power3.out' });
    window.gsap.from('.gate__actions, .gate__hint, .gate__eyebrow', { opacity: 0, y: 14, duration: 0.6, delay: 0.9, stagger: 0.08 });
  }
}
