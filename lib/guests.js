// Shared helpers for the guest-list API. Profiles are stored one JSON file per
// guest in Vercel Blob under guests/<id>-<random>.json. The random suffix keeps
// file URLs unguessable; only these functions read them, behind the password.
import { put, list, del } from '@vercel/blob';
import { timingSafeEqual, randomBytes, createHash, createHmac } from 'node:crypto';

const PREFIX = 'guests/';

// Site cookie: HMAC of the password, so changing GUEST_PASSWORD signs everyone out.
export function siteToken(password = process.env.GUEST_PASSWORD || '') {
  return createHmac('sha256', password).update('openedition-site-v1').digest('hex');
}

export function hasSiteCookie(req) {
  if (!process.env.GUEST_PASSWORD) return false;
  const m = String(req.headers.cookie || '').match(/(?:^|;\s*)oe_auth=([a-f0-9]{64})/);
  return !!m && same(m[1], siteToken());
}

export function same(a, b) {
  return timingSafeEqual(createHash('sha256').update(String(a)).digest(), createHash('sha256').update(String(b)).digest());
}

// Signed in to the site (cookie) or sent the password in a header.
export function checkPassword(req) {
  const want = process.env.GUEST_PASSWORD || '';
  if (!want) return false;
  if (hasSiteCookie(req)) return true;
  return same(String(req.headers['x-guest-password'] || ''), want);
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
