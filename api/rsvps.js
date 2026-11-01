// GET  /api/rsvps -> arrivals board + song requests (no private notes)
// POST /api/rsvps -> save or update an RSVP (keyed by name, latest wins)
import { put, list, del } from '@vercel/blob';
import { checkPassword } from '../lib/guests.js';

const PREFIX = 'rsvps/';
const clip = (v, n) => String(v ?? '').trim().slice(0, n);
const slug = (s) => clip(s, 60).toLowerCase().normalize('NFKD').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'guest';
const FIELDS = { name: 60, attending: 30, airport: 10, arriveDay: 12, landing: 12, inFlight: 20, inTime: 20, houseTime: 40, leaving: 12, leaveTime: 12, outFlight: 20, outTime: 20, monday: 30, songs: 200 };

async function all() {
  const out = []; let cursor;
  do {
    const page = await list({ prefix: PREFIX, cursor, limit: 1000 });
    cursor = page.hasMore ? page.cursor : undefined;
    out.push(...page.blobs);
  } while (cursor);
  return out;
}

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  if (!checkPassword(req)) return res.status(401).json({ error: 'Wrong password' });
  try {
    if (req.method === 'GET') {
      const blobs = await all();
      // newest file per person wins
      const latest = new Map();
      for (const b of blobs.sort((a, c) => new Date(a.uploadedAt) - new Date(c.uploadedAt))) latest.set(b.pathname.split('/')[1].replace(/--[^/]*$/, ''), b);
      const rows = (await Promise.all([...latest.values()].map(async (b) => { try { return await (await fetch(b.url, { cache: 'no-store' })).json(); } catch { return null; } }))).filter(Boolean);
      const coming = rows.filter((r) => r.attending !== 'Can’t make it');
      return res.status(200).json({
        arrivals: coming.map((r) => ({ name: r.name, airport: r.airport, arriveDay: r.arriveDay, landing: r.landing, inTime: r.inTime, inFlight: r.inFlight, houseTime: r.houseTime, leaving: r.leaving, leaveTime: r.leaveTime, outTime: r.outTime })),
        songs: coming.filter((r) => r.songs).map((r) => ({ name: r.name, songs: r.songs }))
      });
    }
    if (req.method === 'POST') {
      const body = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : (req.body || {});
      const doc = {};
      for (const [k, n] of Object.entries(FIELDS)) doc[k] = clip(body[k], n);
      if (!doc.name) return res.status(400).json({ error: 'Add your name' });
      doc.updatedAt = new Date().toISOString();
      const key = slug(doc.name);
      const old = (await list({ prefix: `${PREFIX}${key}--` })).blobs;
      // Edition number: kept from your first RSVP, otherwise the next number in line.
      let edition = 0;
      if (old.length) { try { edition = (await (await fetch(old[old.length - 1].url, { cache: 'no-store' })).json()).edition || 0; } catch {} }
      if (!edition) {
        const people = new Set((await all()).map((b) => b.pathname.split('/')[1].replace(/--[^/]*$/, '')));
        people.delete(key);
        edition = people.size + 1;
      }
      doc.edition = edition;
      await put(`${PREFIX}${key}--.json`, JSON.stringify(doc), { access: 'public', addRandomSuffix: true, contentType: 'application/json', cacheControlMaxAge: 0 });
      await Promise.all(old.map((b) => del(b.url).catch(() => {})));
      return res.status(201).json({ ok: true, edition });
    }
    res.setHeader('Allow', 'GET, POST');
    return res.status(405).json({ error: 'Method not allowed' });
  } catch (e) {
    console.error(e);
    return res.status(500).json({ error: 'Something went wrong. Try again.' });
  }
}
