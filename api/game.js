// Spotted: the trip game.
// GET  /api/game                       -> leaderboard, every player's card, and the tallies
// POST /api/game { action: 'spot', name, id, photo? }   -> mark a square on your card
// POST /api/game { action: 'unspot', name, id }         -> unmark it
// POST /api/game { action: 'tally', counter }           -> +1 on a shared counter
// POST /api/game { action: 'untally', counter, key }    -> undo your own +1
import { put, list, del } from '@vercel/blob';
import { checkPassword } from '../lib/guests.js';

const SQUARES = 16;
const COUNTERS = ['giving', 'lost', 'lambo', 'uber', 'skip', 'banana'];
const LINES = (() => {
  const L = [];
  for (let r = 0; r < 4; r++) L.push([0, 1, 2, 3].map((c) => r * 4 + c));
  for (let c = 0; c < 4; c++) L.push([0, 1, 2, 3].map((r) => r * 4 + c));
  L.push([0, 5, 10, 15], [3, 6, 9, 12]);
  return L;
})();
const clip = (v, n) => String(v ?? '').trim().slice(0, n);
const slug = (s) => clip(s, 60).toLowerCase().normalize('NFKD').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'guest';

async function listAll(prefix) {
  const out = []; let cursor;
  do { const p = await list({ prefix, cursor, limit: 1000 }); cursor = p.hasMore ? p.cursor : undefined; out.push(...p.blobs); } while (cursor);
  return out;
}
function score(spotted) {
  const ids = Object.keys(spotted || {}).map(Number);
  const has = new Set(ids);
  const bingos = LINES.filter((l) => l.every((i) => has.has(i))).length;
  return { squares: ids.length, bingos, points: ids.length + bingos * 3 };
}

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  if (!checkPassword(req)) return res.status(401).json({ error: 'Wrong password' });
  try {
    if (req.method === 'GET') {
      const cards = await listAll('game/cards/');
      const latest = new Map();
      for (const b of cards.sort((a, c) => new Date(a.uploadedAt) - new Date(c.uploadedAt))) latest.set(b.pathname.split('/')[2].replace(/--[^/]*$/, ''), b);
      const players = (await Promise.all([...latest.values()].map(async (b) => { try { return await (await fetch(b.url, { cache: 'no-store' })).json(); } catch { return null; } }))).filter(Boolean)
        .map((p) => ({ name: p.name, spotted: p.spotted || {}, ...score(p.spotted) }))
        .sort((a, b) => b.points - a.points || a.name.localeCompare(b.name));
      const tallyBlobs = await listAll('game/tally/');
      const tallies = {};
      COUNTERS.forEach((c) => { tallies[c] = 0; });
      tallyBlobs.forEach((b) => { const c = b.pathname.split('/')[2]; if (c in tallies) tallies[c]++; });
      return res.status(200).json({ players, tallies });
    }
    if (req.method !== 'POST') { res.setHeader('Allow', 'GET, POST'); return res.status(405).json({ error: 'Method not allowed' }); }

    const body = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : (req.body || {});
    if (body.action === 'tally' || body.action === 'untally') {
      const c = String(body.counter || '');
      if (!COUNTERS.includes(c)) return res.status(400).json({ error: 'Unknown counter' });
      if (body.action === 'tally') {
        const b = await put(`game/tally/${c}/tap.json`, '{}', { access: 'public', addRandomSuffix: true, contentType: 'application/json' });
        return res.status(201).json({ key: b.url });
      }
      const key = String(body.key || '');
      if (!key.includes(`/game/tally/${c}/`)) return res.status(400).json({ error: 'Nothing to undo' });
      await del(key).catch(() => {});
      return res.status(200).json({ ok: true });
    }

    if (body.action === 'spot' || body.action === 'unspot') {
      const name = clip(body.name, 60);
      const id = Number(body.id);
      if (!name || !(id >= 0 && id < SQUARES)) return res.status(400).json({ error: 'Add your name and pick a square' });
      const key = slug(name);
      const old = (await list({ prefix: `game/cards/${key}--` })).blobs.sort((a, c) => new Date(a.uploadedAt) - new Date(c.uploadedAt));
      let doc = { name, spotted: {} };
      if (old.length) { try { doc = await (await fetch(old[old.length - 1].url, { cache: 'no-store' })).json(); } catch {} }
      doc.name = name; doc.spotted = doc.spotted || {};
      if (body.action === 'spot') {
        const photo = typeof body.photo === 'string' && /^https:\/\/[^/]+\.blob\.vercel-storage\.com\/album\//.test(body.photo) ? body.photo : (doc.spotted[id] && doc.spotted[id].photo) || '';
        doc.spotted[id] = { at: new Date().toISOString(), photo };
      } else delete doc.spotted[id];
      await put(`game/cards/${key}--.json`, JSON.stringify(doc), { access: 'public', addRandomSuffix: true, contentType: 'application/json', cacheControlMaxAge: 0 });
      await Promise.all(old.map((b) => del(b.url).catch(() => {})));
      return res.status(200).json({ ok: true, ...score(doc.spotted) });
    }
    return res.status(400).json({ error: 'Unknown action' });
  } catch (e) {
    console.error(e);
    return res.status(500).json({ error: 'Something went wrong. Try again.' });
  }
}
