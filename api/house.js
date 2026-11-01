// GET /api/house -> the house address, only for people signed in.
// The address lives in the HOUSE_ADDRESS env var on Vercel, never in the page or the repo.
import { checkPassword } from '../lib/guests.js';

export default function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  if (!checkPassword(req)) return res.status(401).json({ error: 'Sign in first' });
  const address = String(process.env.HOUSE_ADDRESS || '').trim();
  if (!address) return res.status(200).json({ address: '' });
  return res.status(200).json({ address, maps: 'https://www.google.com/maps/search/?api=1&query=' + encodeURIComponent(address) });
}
