// GET  /api/guests            -> list of profiles (needs x-guest-password)
// POST /api/guests            -> create or update your profile
// DELETE /api/guests          -> remove your profile ({ id, token })
import { checkPassword, readAll, publicView, save, remove, newId, newToken, clean } from '../lib/guests.js';

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  if (!checkPassword(req)) return res.status(401).json({ error: 'Wrong password' });

  try {
    if (req.method === 'GET') {
      const all = await readAll();
      all.sort((a, b) => String(a.createdAt).localeCompare(String(b.createdAt)));
      return res.status(200).json({ guests: all.map(publicView) });
    }

    const body = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : (req.body || {});

    if (req.method === 'POST') {
      const fields = clean(body);
      if (!fields.name) return res.status(400).json({ error: 'Add your name' });
      const now = new Date().toISOString();
      if (body.id) {
        const all = await readAll();
        const mine = all.find((g) => g.id === body.id);
        if (!mine || !body.token || mine.token !== body.token) return res.status(403).json({ error: 'You can only edit your own profile' });
        const doc = { ...mine, ...fields, photo: fields.photo ?? (body.keepPhoto ? mine.photo : undefined), updatedAt: now };
        delete doc._url;
        await save(doc, mine._url);
        return res.status(200).json({ guest: publicView(doc), id: doc.id, token: doc.token });
      }
      const doc = { id: newId(), token: newToken(), ...fields, createdAt: now, updatedAt: now };
      await save(doc);
      return res.status(201).json({ guest: publicView(doc), id: doc.id, token: doc.token });
    }

    if (req.method === 'DELETE') {
      const all = await readAll();
      const mine = all.find((g) => g.id === body.id);
      if (!mine || !body.token || mine.token !== body.token) return res.status(403).json({ error: 'You can only remove your own profile' });
      await remove(mine._url);
      return res.status(200).json({ ok: true });
    }

    res.setHeader('Allow', 'GET, POST, DELETE');
    return res.status(405).json({ error: 'Method not allowed' });
  } catch (e) {
    console.error(e);
    return res.status(500).json({ error: 'Something went wrong. Try again.' });
  }
}
