// GET /api/kit -> the kit contents, but only from Friday, December 4 (Miami time).
// Set KIT_ITEMS on Vercel as one item per line, e.g. "Film camera\nSilk scarf\nSunglasses".
import { checkPassword } from '../lib/guests.js';

export default function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  if (!checkPassword(req)) return res.status(401).json({ error: 'Wrong password' });
  const opens = Date.parse('2026-12-04T12:00:00-05:00');
  const items = String(process.env.KIT_ITEMS || '').split(/\r?\n|\|/).map((s) => s.trim()).filter(Boolean);
  if (Date.now() < opens || !items.length) return res.status(200).json({ open: false, opens: '2026-12-04' });
  return res.status(200).json({ open: true, items });
}
