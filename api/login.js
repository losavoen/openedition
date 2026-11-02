// POST /api/login (form) -> sets the site cookie and sends you on, or back to /login?e=1
import { siteToken, viewToken, same } from '../lib/guests.js';

export default async function handler(req, res) {
  if (req.method !== 'POST') { res.setHeader('Allow', 'POST'); return res.status(405).end(); }
  let body = req.body || {};
  if (typeof body === 'string') body = Object.fromEntries(new URLSearchParams(body));
  const want = process.env.GUEST_PASSWORD || '';
  const nextPath = typeof body.next === 'string' && body.next.startsWith('/') && !body.next.startsWith('//') ? body.next : '/';
  const given = String(body.password || '').trim();
  // Preview PIN: a look at the app with sample photos and people. No address, no real data, nothing posts.
  const pin = process.env.VIEW_PIN || '';
  if (pin && !(want && same(given, want)) && same(given, pin)) {
    res.setHeader('Set-Cookie', `oe_view=${viewToken(pin)}; Path=/; Max-Age=${60 * 60 * 24 * 30}; HttpOnly; Secure; SameSite=Lax`);
    res.setHeader('Location', '/app/?sample&at=fri-14:30');
    return res.status(303).end();
  }
  if (!want || !same(given, want)) {
    res.setHeader('Location', '/login?e=1' + (nextPath !== '/' ? '&next=' + encodeURIComponent(nextPath) : ''));
    return res.status(303).end();
  }
  res.setHeader('Set-Cookie', `oe_auth=${siteToken()}; Path=/; Max-Age=${60 * 60 * 24 * 60}; HttpOnly; Secure; SameSite=Lax`);
  res.setHeader('Location', nextPath);
  return res.status(303).end();
}
