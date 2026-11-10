// Your closet: each person's private log of looks and things to buy.
// GET    /api/closet?id=&token=   -> your closet
// POST   /api/closet              -> save { id?, token?, looks, buys } (no id = start a new closet)
// DELETE /api/closet              -> remove it { id, token }
// One JSON file per closet under closets/<id>-<random>.json. Look photos are sent as
// data URLs and stored as their own files under closet-photos/. Only the id + token
// (kept on the owner's device) can read or change a closet.
import { put, list, del } from '@vercel/blob';
import { checkPassword, newId, newToken, same } from '../lib/guests.js';

const DOCS = 'closets/';
const PHOTOS = 'closet-photos/';
const clip = (v, n) => String(v ?? '').trim().slice(0, n);
const okId = (v) => /^[a-f0-9]{12}$/.test(String(v || ''));

async function findDoc(id) {
  const page = await list({ prefix: `${DOCS}${id}`, limit: 10 });
  const blob = page.blobs.sort((a, b) => String(b.uploadedAt).localeCompare(String(a.uploadedAt)))[0];
  if (!blob) return null;
  try { return { ...(await (await fetch(blob.url, { cache: 'no-store' })).json()), _url: blob.url, _all: page.blobs.map((b) => b.url) }; } catch { return null; }
}

function owns(doc, token) { return doc && token && same(doc.token, token); }

async function storePhoto(v) {
  const s = String(v || '');
  if (!s) return '';
  if (/^https:\/\/[a-z0-9.-]+\.public\.blob\.vercel-storage\.com\/closet-photos\//.test(s)) return s;
  const m = s.match(/^data:image\/(jpeg|png|webp);base64,([A-Za-z0-9+/=]+)$/);
  if (!m || m[2].length > 1_500_000) return '';
  const r = await put(`${PHOTOS}${newId()}.${m[1] === 'jpeg' ? 'jpg' : m[1]}`, Buffer.from(m[2], 'base64'), { access: 'public', addRandomSuffix: true, contentType: `image/${m[1]}` });
  return r.url;
}

async function clean(body) {
  const looks = [];
  for (const l of (Array.isArray(body.looks) ? body.looks : []).slice(0, 40)) {
    const title = clip(l.title, 60);
    if (!title) continue;
    looks.push({
      id: okId(l.id) ? l.id : newId(),
      title,
      when: clip(l.when, 40),
      pieces: (Array.isArray(l.pieces) ? l.pieces : []).map((p) => clip(p, 80)).filter(Boolean).slice(0, 20),
      note: clip(l.note, 300),
      photo: await storePhoto(l.photo)
    });
  }
  const ids = new Set(looks.map((l) => l.id));
  const buys = (Array.isArray(body.buys) ? body.buys : []).slice(0, 80).map((b) => {
    const price = Math.round(Number(b.price) * 100) / 100;
    const link = clip(b.link, 400);
    return {
      id: okId(b.id) ? b.id : newId(),
      item: clip(b.item, 80),
      price: price > 0 && price < 100000 ? price : null,
      link: /^https?:\/\//i.test(link) ? link : '',
      look: ids.has(b.look) ? b.look : '',
      bought: !!b.bought
    };
  }).filter((b) => b.item);
  return { looks, buys };
}

const view = (d) => ({ id: d.id, looks: d.looks || [], buys: d.buys || [], updatedAt: d.updatedAt });

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  if (!checkPassword(req)) return res.status(401).json({ error: 'Wrong password' });
  try {
    if (req.method === 'GET') {
      const { id, token } = req.query || {};
      if (!okId(id)) return res.status(404).json({ error: 'No closet yet' });
      const doc = await findDoc(id);
      if (!owns(doc, token)) return res.status(404).json({ error: 'No closet yet' });
      return res.status(200).json({ closet: view(doc) });
    }
    const body = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : (req.body || {});
    if (req.method === 'POST') {
      let old = null;
      if (body.id) {
        old = okId(body.id) ? await findDoc(body.id) : null;
        if (!owns(old, body.token)) return res.status(403).json({ error: 'This closet belongs to another device. Use your closet link to open it.' });
      }
      const fields = await clean(body);
      const now = new Date().toISOString();
      const doc = old
        ? { id: old.id, token: old.token, createdAt: old.createdAt, ...fields, updatedAt: now }
        : { id: newId(), token: newToken(), createdAt: now, ...fields, updatedAt: now };
      await put(`${DOCS}${doc.id}.json`, JSON.stringify(doc), { access: 'public', addRandomSuffix: true, contentType: 'application/json', cacheControlMaxAge: 0 });
      if (old) {
        await Promise.all(old._all.map((u) => del(u).catch(() => {})));
        const keep = new Set(doc.looks.map((l) => l.photo));
        await Promise.all((old.looks || []).map((l) => l.photo).filter((u) => u && !keep.has(u)).map((u) => del(u).catch(() => {})));
      }
      return res.status(old ? 200 : 201).json({ closet: view(doc), id: doc.id, token: doc.token });
    }
    if (req.method === 'DELETE') {
      const doc = okId(body.id) ? await findDoc(body.id) : null;
      if (!owns(doc, body.token)) return res.status(403).json({ error: 'You can only remove your own closet' });
      await Promise.all([...doc._all, ...(doc.looks || []).map((l) => l.photo).filter(Boolean)].map((u) => del(u).catch(() => {})));
      return res.status(200).json({ ok: true });
    }
    res.setHeader('Allow', 'GET, POST, DELETE');
    return res.status(405).json({ error: 'Method not allowed' });
  } catch (e) {
    console.error(e);
    return res.status(500).json({ error: 'Something went wrong. Try again.' });
  }
}
