// GET    /api/memories  -> everything in the album (needs x-guest-password)
// POST   /api/memories  -> add a memory: { name, day, note, media: [{ url, type }] }
// DELETE /api/memories  -> remove your own memory: { id, token }
import { put, list, del } from '@vercel/blob';
import { checkPassword, newId, newToken } from '../lib/guests.js';

const PREFIX = 'memories/';
const DAYS = ['Friday', 'Saturday', 'Sunday', 'Monday'];
const clip = (v, n) => String(v ?? '').trim().slice(0, n);

async function readAll() {
  const out = []; let cursor;
  do {
    const page = await list({ prefix: PREFIX, cursor, limit: 1000 });
    cursor = page.hasMore ? page.cursor : undefined;
    const docs = await Promise.all(page.blobs.map(async (b) => {
      try { return { ...(await (await fetch(b.url, { cache: 'no-store' })).json()), _url: b.url }; } catch { return null; }
    }));
    out.push(...docs.filter(Boolean));
  } while (cursor);
  return out;
}
const view = (m) => ({ id: m.id, name: m.name, day: m.day, note: m.note, media: m.media, createdAt: m.createdAt });

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  if (!checkPassword(req)) return res.status(401).json({ error: 'Wrong password' });
  try {
    if (req.method === 'GET') {
      const all = await readAll();
      all.sort((a, b) => DAYS.indexOf(a.day) - DAYS.indexOf(b.day) || String(a.createdAt).localeCompare(String(b.createdAt)));
      return res.status(200).json({ memories: all.map(view) });
    }
    const body = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : (req.body || {});
    if (req.method === 'POST') {
      const host = (u) => { try { return new URL(u).hostname; } catch { return ''; } };
      const media = (Array.isArray(body.media) ? body.media : []).slice(0, 30)
        .filter((m) => m && /\.blob\.vercel-storage\.com$/.test(host(m.url)) && new URL(m.url).pathname.startsWith('/album/'))
        .map((m) => ({ url: m.url, type: /^video\//.test(m.type) ? 'video' : 'image' }));
      const note = clip(body.note, 600);
      if (!media.length && !note) return res.status(400).json({ error: 'Add a photo or a few words' });
      const doc = { id: newId(), token: newToken(), name: clip(body.name, 60) || 'Someone', day: DAYS.includes(body.day) ? body.day : '', note, media, createdAt: new Date().toISOString() };
      await put(`${PREFIX}${doc.id}.json`, JSON.stringify(doc), { access: 'public', addRandomSuffix: true, contentType: 'application/json', cacheControlMaxAge: 0 });
      return res.status(201).json({ memory: view(doc), id: doc.id, token: doc.token });
    }
    if (req.method === 'DELETE') {
      const mine = (await readAll()).find((m) => m.id === body.id);
      if (!mine || !body.token || mine.token !== body.token) return res.status(403).json({ error: 'You can only remove your own memories' });
      await Promise.all([del(mine._url), ...mine.media.map((m) => del(m.url).catch(() => {}))]);
      return res.status(200).json({ ok: true });
    }
    res.setHeader('Allow', 'GET, POST, DELETE');
    return res.status(405).json({ error: 'Method not allowed' });
  } catch (e) {
    console.error(e);
    return res.status(500).json({ error: 'Something went wrong. Try again.' });
  }
}
