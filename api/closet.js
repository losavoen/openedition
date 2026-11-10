// Your closet: each person's private log of looks and things to buy.
// GET    /api/closet?id=&token=   -> your closet
// POST   /api/closet              -> save { id?, token?, looks, buys } (no id = start a new closet)
// DELETE /api/closet              -> remove it { id, token }
// One JSON file per closet under closets/<id>-<random>.json. Look photos are sent as
// data URLs and stored as their own files under closet-photos/. Only the id + token
// (kept on the owner's device) can read or change a closet.
import { put, list, del } from '@vercel/blob';
import { checkPassword, newId, newToken, same } from '../lib/guests.js';

export const config = { maxDuration: 30 };

const DOCS = 'closets/';
const PHOTOS = 'closet-photos/';
const clip = (v, n) => String(v ?? '').trim().slice(0, n);
const okId = (v) => /^[a-f0-9]{12}$/.test(String(v || ''));


const OURS = /^https:\/\/[a-z0-9.-]+\.public\.blob\.vercel-storage\.com\/closet-photos\//;
const UA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36';
const host = (u) => { try { return new URL(u).hostname.replace(/^www\./, ''); } catch { return ''; } };
function timed(ms) { const c = new AbortController(); setTimeout(() => c.abort(), ms); return c.signal; }
const unent = (t) => String(t).replace(/&amp;/g, '&').replace(/&quot;/g, '"').replace(/&#39;|&#x27;/g, "'").replace(/&lt;/g, '<').replace(/&gt;/g, '>');
function metaTag(html, names) {
  for (const n of names) {
    const re = new RegExp('<meta[^>]+(?:property|name)=["\']' + n + '["\'][^>]*>', 'i');
    const tag = html.match(re);
    const c = tag && tag[0].match(/content=["']([^"']+)["']/i);
    if (c) return unent(c[1]).trim();
  }
  return '';
}
async function readProduct(link) {
  try {
    const r = await fetch(link, { headers: { 'user-agent': UA, accept: 'text/html' }, redirect: 'follow', signal: timed(5000) });
    if (!r.ok || !/html/i.test(r.headers.get('content-type') || '')) return {};
    const html = (await r.text()).slice(0, 600000);
    let image = metaTag(html, ['og:image:secure_url', 'og:image', 'twitter:image', 'twitter:image:src']);
    if (image) { try { image = new URL(image, r.url).href; } catch { image = ''; } }
    const title = metaTag(html, ['og:title', 'twitter:title']) || unent((html.match(/<title[^>]*>([^<]{1,200})/i) || [])[1] || '').trim();
    return { image, title };
  } catch { return {}; }
}
async function copyImage(url) {
  try {
    if (!/^https:\/\//i.test(url)) return '';
    const r = await fetch(url, { headers: { 'user-agent': UA }, signal: timed(5000) });
    const type = (r.headers.get('content-type') || '').split(';')[0];
    if (!r.ok || !/^image\/(jpeg|png|webp|avif|gif)$/.test(type)) return '';
    const buf = Buffer.from(await r.arrayBuffer());
    if (buf.length > 4_000_000) return '';
    const out = await put(`${PHOTOS}${newId()}.${type.split('/')[1].replace('jpeg', 'jpg')}`, buf, { access: 'public', addRandomSuffix: true, contentType: type });
    return out.url;
  } catch { return ''; }
}

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
  if (OURS.test(s)) return s;
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
    const link = clip(b.link, 400);
    return {
      id: okId(b.id) ? b.id : newId(),
      item: clip(b.item, 80),
      link: /^https?:\/\//i.test(link) ? link : '',
      image: OURS.test(String(b.image || '')) ? b.image : '',
      tried: !!b.tried,
      look: ids.has(b.look) ? b.look : '',
      bought: !!b.bought
    };
  }).filter((b) => b.item || b.link);
  // New links: read the product page for its picture (og:image) and, if no name was given, its title.
  await Promise.all(buys.filter((b) => b.link && !b.tried).slice(0, 6).map(async (b) => {
    b.tried = true;
    const meta = await readProduct(b.link);
    if (!b.item && meta.title) b.item = meta.title.slice(0, 80);
    if (meta.image) b.image = await copyImage(meta.image);
  }));
  for (const b of buys) if (!b.item) b.item = host(b.link);
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
        const pics = (d) => [...(d.looks || []).map((l) => l.photo), ...(d.buys || []).map((b) => b.image)].filter(Boolean);
        const keep = new Set(pics(doc));
        await Promise.all(pics(old).filter((u) => !keep.has(u)).map((u) => del(u).catch(() => {})));
      }
      return res.status(old ? 200 : 201).json({ closet: view(doc), id: doc.id, token: doc.token });
    }
    if (req.method === 'DELETE') {
      const doc = okId(body.id) ? await findDoc(body.id) : null;
      if (!owns(doc, body.token)) return res.status(403).json({ error: 'You can only remove your own closet' });
      await Promise.all([...doc._all, ...(doc.looks || []).map((l) => l.photo), ...(doc.buys || []).map((b) => b.image)].filter(Boolean).map((u) => del(u).catch(() => {})));
      return res.status(200).json({ ok: true });
    }
    res.setHeader('Allow', 'GET, POST, DELETE');
    return res.status(405).json({ error: 'Method not allowed' });
  } catch (e) {
    console.error(e);
    return res.status(500).json({ error: 'Something went wrong. Try again.' });
  }
}
