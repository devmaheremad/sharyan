// HUD: New York clock + countdown to the open, sound button + cards, scroll progress, chart crosshair.

import { qs, finePointer } from './util.js';
import { sound, writePref } from './audio.js';
import { price } from './price.js';

const pad = (n) => String(n).padStart(2, '0');
const hms = (s) => `${pad(Math.floor(s / 3600))}:${pad(Math.floor((s % 3600) / 60))}:${pad(s % 60)}`;
const OPEN = 9 * 3600 + 30 * 60; // 09:30 New York

function nyNow() {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/New_York', weekday: 'short', hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23',
  }).formatToParts(new Date());
  const get = (t) => parts.find((p) => p.type === t)?.value;
  const day = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].indexOf(get('weekday'));
  const h = Number(get('hour')), m = Number(get('minute')), s = Number(get('second'));
  return { day, h, m, s, secs: h * 3600 + m * 60 + s };
}

export function initClock() {
  const timeEl = qs('#ny-time');
  const openEl = qs('#ny-open');
  const tick = () => {
    const n = nyNow();
    timeEl.textContent = `${pad(n.h)}:${pad(n.m)}:${pad(n.s)}`;
    const weekend = n.day === 6 || (n.day === 0 && n.secs < 18 * 3600) || (n.day === 5 && n.secs >= 17 * 3600);
    let label;
    if (weekend) label = 'السوق مسكّر · الويكند';
    else if (n.day >= 1 && n.day <= 5 && n.secs < OPEN) label = `افتتاح نيويورك بعد ${hms(OPEN - n.secs)}`;
    else if (n.day >= 1 && n.day <= 5 && n.secs < 10 * 3600) label = 'وقت الكسر · نيويورك فتحت';
    else if (n.day >= 1 && n.day <= 5 && n.secs < 17 * 3600) label = 'نيويورك مفتوحة';
    else label = `افتتاح نيويورك بعد ${hms(86400 - n.secs + OPEN)}`;
    openEl.textContent = label;
  };
  tick();
  setInterval(tick, 1000);
}

// Sound button, the cream "tap anywhere" card, and the reduced-motion offer.
export function initSoundUI() {
  const btn = qs('#sound-toggle');
  const card = qs('#sound-card');
  const cardText = qs('#sound-card-text');
  const off = qs('#sound-off');
  const sync = (on) => {
    btn.setAttribute('aria-pressed', String(on));
    btn.setAttribute('aria-label', on ? 'إيقاف الصوت' : 'تشغيل الصوت');
  };
  sound.onChange(sync);

  const hideCard = () => {
    if (card.hidden) return;
    card.style.transition = 'opacity .25s, transform .25s';
    card.style.opacity = '0';
    card.style.transform = 'translateY(-6px)';
    setTimeout(() => { card.hidden = true; card.removeAttribute('style'); }, 260);
  };

  let armed = false;
  const unlock = async (e) => {
    // the card's own "off" link and the sound button handle themselves
    if (e && e.target && e.target.closest && e.target.closest('#sound-off, #sound-toggle, #motion-on, [data-voice]')) return;
    disarm();
    if (await sound.enable()) {
      writePref('on');
      sound.chime();
      // first sound he hears on the site: Aboud introducing himself
      setTimeout(() => sound.voice('iam'), 500);
    }
    hideCard();
  };
  const arm = () => {
    if (armed) return;
    armed = true;
    window.addEventListener('pointerdown', unlock, true);
    window.addEventListener('keydown', unlock, true);
  };
  const disarm = () => {
    armed = false;
    window.removeEventListener('pointerdown', unlock, true);
    window.removeEventListener('keydown', unlock, true);
  };

  btn.addEventListener('click', async () => {
    disarm();
    hideCard();
    if (sound.enabled) { sound.disable(); writePref('off'); }
    else if (await sound.enable()) { writePref('on'); sound.chime(); }
  });
  off.addEventListener('click', (e) => {
    e.stopPropagation();
    disarm();
    sound.disable();
    writePref('off');
    hideCard();
  });

  sound.onChange((on) => { if (on) { disarm(); hideCard(); } });

  return {
    // After the intro: if sound is still blocked (and not turned off), show the card and arm "tap anywhere".
    afterIntro() {
      if (sound.enabled || sound.pref === 'off') return;
      const touch = window.matchMedia('(hover: none)').matches;
      cardText.textContent = touch ? 'المس أي مكان لتشغيل المؤثرات الصوتية' : 'اضغط في أي مكان لتشغيل المؤثرات الصوتية';
      card.hidden = false;
      arm();
    },
  };
}

export function initMotionCard({ prefersReduced, forced }) {
  const card = qs('#motion-card');
  const on = qs('#motion-on');
  return {
    afterIntro() {
      if (!prefersReduced || forced) return;
      card.hidden = false;
      on.addEventListener('click', (e) => {
        e.stopPropagation();
        writePref('on', 'sharyan.motion');
        window.location.reload();
      });
    },
  };
}

export function initProgress(lenis) {
  const fill = qs('#progress-fill');
  const set = () => {
    const max = document.documentElement.scrollHeight - window.innerHeight;
    const p = max > 0 ? window.scrollY / max : 0;
    fill.style.transform = `scaleX(${p})`;
  };
  if (lenis) lenis.on('scroll', set); else window.addEventListener('scroll', set, { passive: true });
  set();
}

export function initCrosshair() {
  if (!finePointer()) return;
  const root = qs('.crosshair');
  const line = qs('.crosshair__h', root);
  const tag = qs('.crosshair__tag', root);
  let y = -100, x = 0, raf = 0;
  // the tag shows the real gold price, live
  let label = 'XAUUSD …';
  price.onChange((p) => { label = `XAUUSD ${p.toFixed(2)}`; if (y > 0) tag.textContent = label; });
  const paint = () => {
    raf = 0;
    line.style.transform = `translateY(${y}px)`;
    tag.textContent = label;
    tag.style.transform = `translate(${Math.min(x + 14, window.innerWidth - 150)}px, ${y - 22}px)`;
  };
  window.addEventListener('pointermove', (e) => {
    x = e.clientX; y = e.clientY;
    root.classList.toggle('is-on', !e.target.closest('a, button, .intro, dialog, .crew, .outro, .credit'));
    if (!raf) raf = requestAnimationFrame(paint);
  }, { passive: true });
  document.addEventListener('pointerleave', () => root.classList.remove('is-on'));
}
