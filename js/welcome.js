// Private welcome card for Aboud. Shown once per visit, and only when the link carries ?for=aboud:
// the public link (no parameter) never shows it. Its main button is a real tap, so it also
// unlocks sound on phones that block autoplay, then he hears himself introduce the site.

import { qs } from './util.js';
import { sound, writePref } from './audio.js';

const SEEN = 'sharyan.welcome';

export function wantsWelcome() {
  try {
    if (new URLSearchParams(window.location.search).get('for') !== 'aboud') return false;
    return window.sessionStorage.getItem(SEEN) !== 'seen';
  } catch (e) {
    return false;
  }
}

export function showWelcome({ onClose }) {
  const root = qs('#welcome');
  const go = qs('#welcome-go');
  const skip = qs('#welcome-skip');
  if (!root || !go || !skip) { onClose(); return; }

  document.body.classList.add('is-locked');
  root.hidden = false;
  requestAnimationFrame(() => requestAnimationFrame(() => root.classList.add('is-open')));
  setTimeout(() => go.focus({ preventScroll: true }), 80);

  let closed = false;
  const onKey = (e) => {
    if (e.key === 'Escape') { e.preventDefault(); close(); return; }
    if (e.key === 'Tab') {
      // keep focus on the card's two buttons while it is open
      e.preventDefault();
      (document.activeElement === go ? skip : go).focus();
    }
  };
  function close() {
    if (closed) return;
    closed = true;
    try { window.sessionStorage.setItem(SEEN, 'seen'); } catch (e) { /* private mode */ }
    document.removeEventListener('keydown', onKey, true);
    root.classList.remove('is-open');
    root.classList.add('is-closing');
    setTimeout(() => {
      root.hidden = true;
      root.classList.remove('is-closing');
      document.body.classList.remove('is-locked');
      onClose();
    }, 450);
  }

  document.addEventListener('keydown', onKey, true);
  go.addEventListener('click', async () => {
    if (await sound.enable()) {
      writePref('on');
      sound.chime();
      setTimeout(() => sound.voice('iam'), 700);
    }
    close();
  });
  skip.addEventListener('click', close);
}
