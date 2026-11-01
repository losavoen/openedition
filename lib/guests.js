// Shared helpers for the guest-list API. Profiles are stored one JSON file per
// guest in Vercel Blob under guests/<id>-<random>.json. The random suffix keeps
// file URLs unguessable; only these functions read them, behind the password.
import { put, list, del } from '@vercel/blob';
import { timingSafeEqual, randomBytes, createHash } from 'node:crypto';

const PREFIX = 'guests/';

export function checkPassword(req) {
  const want = process.env.GUEST_PASSWORD || '';
  const got = String(req.headers['x-guest-password'] || '');
  if (!want) return false;
  const a = createHash('sha256').update(got).digest();
  const b = createHash('sha256').update(want).digest();
  return timingSafeEqual(a, b);
}

export async function readAll() {
  const out = [];
  let cursor;
  do {
    const page = await list({ prefix: PREFIX, cursor, limit: 1000 });
    cursor = page.hasMore ? page.cursor : undefined;
    const docs = await Promise.all(page.blobs.map(async (b) => {
      try {
        const r = await fetch(b.url, { cache: 'no-store' });
        return { ...(await r.json()), _url: b.url };
      } catch { return null; }
    }));
    out.push(...docs.filter(Boolean));
  } while (cursor);
  return out;
}

export function publicView(g) {
  return { id: g.id, name: g.name, line: g.line, from: g.from, ig: g.ig, status: g.status, photo: g.photo, updatedAt: g.updatedAt };
}

export async function save(doc, oldUrl) {
  const res = await put(`${PREFIX}${doc.id}.json`, JSON.stringify(doc), {
    access: 'public', addRandomSuffix: true, contentType: 'application/json', cacheControlMaxAge: 0
  });
  if (oldUrl) await del(oldUrl).catch(() => {});
  return res;
}

export async function remove(url) { await del(url); }

export const newId = () => randomBytes(6).toString('hex');
export const newToken = () => randomBytes(24).toString('hex');

const clip = (v, n) => String(v ?? '').trim().slice(0, n);
export function clean(body) {
  const photo = typeof body.photo === 'string' && /^data:image\/(jpeg|png|webp);base64,[A-Za-z0-9+/=]+$/.test(body.photo) && body.photo.length < 400000 ? body.photo : undefined;
  return {
    name: clip(body.name, 60),
    line: clip(body.line, 120),
    from: clip(body.from, 40),
    ig: clip(body.ig, 40).replace(/^@+/, '').replace(/[^A-Za-z0-9._]/g, ''),
    status: ['I’m in', 'Probably'].includes(body.status) ? body.status : 'I’m in',
    photo
  };
}
