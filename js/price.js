// Live gold price (XAU/USD spot). gold-api.com first, Binance PAXG/USDT as a fallback.
// Polls every 15 s while the tab is visible.

const SOURCES = [
  async () => {
    const r = await fetch('https://api.gold-api.com/price/XAU', { cache: 'no-store' });
    const j = await r.json();
    return Number(j.price);
  },
  async () => {
    const r = await fetch('https://api.binance.com/api/v3/ticker/price?symbol=PAXGUSDT', { cache: 'no-store' });
    const j = await r.json();
    return Number(j.price);
  },
];

let last = null;
let timer = 0;
const listeners = new Set();

async function poll() {
  for (const src of SOURCES) {
    try {
      const p = await src();
      if (Number.isFinite(p) && p > 100) {
        last = p;
        listeners.forEach((fn) => fn(p));
        return p;
      }
    } catch (e) { /* try the next source */ }
  }
  return last;
}

export const price = {
  get value() { return last; },
  onChange(fn) { listeners.add(fn); if (last) fn(last); },
  start() {
    if (timer) return;
    poll();
    timer = window.setInterval(() => { if (!document.hidden) poll(); }, 15000);
  },
  // Resolves with the first price, or null after `ms`.
  first(ms = 1500) {
    if (last) return Promise.resolve(last);
    return Promise.race([
      new Promise((res) => listeners.add(function once(p) { listeners.delete(once); res(p); })),
      new Promise((res) => setTimeout(() => res(null), ms)),
    ]);
  },
};
