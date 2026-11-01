// GET    /api/tab -> everything on the shared tab
// POST   /api/tab -> add { what, amount, paidBy, split: [names] } (empty split = everyone)
// DELETE /api/tab -> remove your own item { id, token }
import { put, list, del } from '@vercel/blob';
import { checkPassword, newId, newToken } from '../lib/guests.js';

const PREFIX = 'tab/';
const clip = (v, n) => String(v ?? '').trim().slice(0, n);

async function readAll() {
  const out = []; let cursor;
  do {
    const page = await list({ prefix: PREFIX, cursor, limit: 1000 });
    cursor = page.hasMore ? page.cursor : undefined;
    const docs = await Promise.all(page.blobs.map(async (b) => { try { return { ...(await (await fetch(b.url, { cache: 'no-store' })).json()), _url: b.url }; } catch { return null; } }));
    out.push(...docs.filter(Boolean));
  } while (cursor);
  return out.sort((a, b) => String(a.createdAt).localeCompare(String(b.createdAt)));
}

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  if (!checkPassword(req)) return res.status(401).json({ error: 'Wrong password' });
  try {
    if (req.method === 'GET') {
      const items = (await readAll()).map(({ id, what, amount, paidBy, split, createdAt }) => ({ id, what, amount, paidBy, split, createdAt }));
      return res.status(200).json({ items });
    }
    const body = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : (req.body || {});
    if (req.method === 'POST') {
      const amount = Math.round(Number(body.amount) * 100) / 100;
      const doc = {
        id: newId(), token: newToken(),
        what: clip(body.what, 60), paidBy: clip(body.paidBy, 60), amount,
        split: (Array.isArray(body.split) ? body.split : []).map((n) => clip(n, 60)).filter(Boolean).slice(0, 40),
        createdAt: new Date().toISOString()
      };
      if (!doc.what || !doc.paidBy || !(amount > 0) || amount > 100000) return res.status(400).json({ error: 'Add what it was for, who paid and the amount' });
      await put(`${PREFIX}${doc.id}.json`, JSON.stringify(doc), { access: 'public', addRandomSuffix: true, contentType: 'application/json', cacheControlMaxAge: 0 });
      return res.status(201).json({ id: doc.id, token: doc.token });
    }
    if (req.method === 'DELETE') {
      const mine = (await readAll()).find((x) => x.id === body.id);
      if (!mine || !body.token || mine.token !== body.token) return res.status(403).json({ error: 'You can only remove items you added' });
      await del(mine._url);
      return res.status(200).json({ ok: true });
    }
    res.setHeader('Allow', 'GET, POST, DELETE');
    return res.status(405).json({ error: 'Method not allowed' });
  } catch (e) {
    console.error(e);
    return res.status(500).json({ error: 'Something went wrong. Try again.' });
  }
}
