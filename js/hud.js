// HUD: New York clock + countdown to the open, sound toggle, scroll progress, chart crosshair.

import { qs, finePointer } from './util.js';
import { sound } from './audio.js';

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
    if (weekend) {
      label = 'السوق مسكّر · الويكند';
    } else if (n.day >= 1 && n.day <= 5 && n.secs < OPEN) {
      label = `افتتاح نيويورك بعد ${hms(OPEN - n.secs)}`;
    } else if (n.day >= 1 && n.day <= 5 && n.secs < 10 * 3600) {
      label = 'وقت الكسر · نيويورك فتحت';
    } else if (n.day >= 1 && n.day <= 5 && n.secs < 17 * 3600) {
      label = 'نيويورك مفتوحة';
    } else {
      // after 17:00 Mon-Thu, or Sunday evening: next open is tomorrow 09:30
      label = `افتتاح نيويورك بعد ${hms(86400 - n.secs + OPEN)}`;
    }
    openEl.textContent = label;
  };
  tick();
  setInterval(tick, 1000);
}

export function initSoundToggle() {
  const btn = qs('#sound-toggle');
  const sync = (on) => {
    btn.setAttribute('aria-pressed', String(on));
    btn.setAttribute('aria-label', on ? 'إيقاف الصوت' : 'تشغيل الصوت');
  };
  sound.onChange(sync);
  btn.addEventListener('click', async () => {
    if (sound.enabled) sound.disable();
    else { await sound.enable(); sound.shift(); }
  });
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
  const paint = () => {
    raf = 0;
    const price = 3900 - (y / window.innerHeight) * 60;
    line.style.transform = `translateY(${y}px)`;
    tag.textContent = price.toFixed(2);
    tag.style.transform = `translate(${Math.min(x + 14, window.innerWidth - 80)}px, ${y - 22}px)`;
  };
  window.addEventListener('pointermove', (e) => {
    x = e.clientX; y = e.clientY;
    root.classList.toggle('is-on', !e.target.closest('a, button, .gate, dialog'));
    if (!raf) raf = requestAnimationFrame(paint);
  }, { passive: true });
  document.addEventListener('pointerleave', () => root.classList.remove('is-on'));
}
