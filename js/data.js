// Facts shown on the page, with their sources.

// Levels Aboud announced in the live stream, logged day by day by Maher (17-25 Nov 2026).
// "hits" lists what the log records as reached; "extra" marks a price he called beyond the plan.
export const LEDGER = [
  { day: '١٧ نوف', dir: 'buy', level: '3870.00', time: '10:34', hits: ['TP1', 'TP2', 'TP3'] },
  { day: '١٨ نوف', dir: 'sell', level: '3779.06', time: '09:15', hits: ['TP1', 'TP2', 'TP3'] },
  { day: '١٩ نوف', dir: 'sell', level: '3703.00', time: '10:20', hits: ['TP1', 'TP2'] },
  { day: '٢٠ نوف', dir: 'buy', level: '3570.00', time: '—', hits: ['TP1', 'TP2'] },
  { day: '٢٣ نوف', dir: 'sell', level: '3670.00', time: '09:35', hits: ['TP1', 'TP2', 'TP3'] },
  { day: '٢٤ نوف', dir: 'sell', level: '3610.00', time: '10:06', hits: ['TP1', 'TP2', 'TP3'] },
  // Log: TP1 + TP2, then he called 3440, also hit (broker M1 data shows TP3 3448 passed on the way).
  { day: '٢٥ نوف', dir: 'sell', level: '3460.00', time: '09:40', hits: ['TP1', 'TP2', 'TP3'], extra: '3440' },
];

// Result screenshots published on sharyan.io (hot-linked from his Shopify CDN, nothing copied).
const CDN = 'https://cdn.shopify.com/s/files/1/0655/6080/5481/files/';
export const WALL = [
  'IMG_8761.jpg?v=1792437346', 'IMG_8762.jpg?v=1792437346', 'IMG_4966.jpg?v=1783311269',
  'IMG_8766.jpg?v=1792437347', 'IMG_4970.jpg?v=1783311270', 'IMG_8758.jpg?v=1792437346',
  'IMG_4973.jpg?v=1783311270', 'IMG_8764.jpg?v=1792437347', 'IMG_4969.jpg?v=1783311270',
  'IMG_8768.jpg?v=1792437347', 'IMG_4967.jpg?v=1783311270', 'IMG_8759.jpg?v=1792437347',
  'IMG_4980.jpg?v=1783311270', 'IMG_8757.jpg?v=1792437347', 'IMG_8760.jpg?v=1792437347',
].map((f) => CDN + f);

export const img = (url, width) => `${url}&width=${width}`;
