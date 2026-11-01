// Issues short-lived tokens so the browser can upload photos and videos straight
// to Vercel Blob (no size limit from the function). Needs the shared password.
import { handleUpload } from '@vercel/blob/client';
import { createHash, timingSafeEqual } from 'node:crypto';

const same = (a, b) => timingSafeEqual(createHash('sha256').update(String(a)).digest(), createHash('sha256').update(String(b)).digest());

export default async function handler(req, res) {
  if (req.method !== 'POST') { res.setHeader('Allow', 'POST'); return res.status(405).json({ error: 'Method not allowed' }); }
  const body = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : (req.body || {});
  try {
    const result = await handleUpload({
      body,
      request: req,
      onBeforeGenerateToken: async (pathname, clientPayload) => {
        let pw = '';
        try { pw = JSON.parse(clientPayload || '{}').password || ''; } catch {}
        if (!process.env.GUEST_PASSWORD || !same(pw, process.env.GUEST_PASSWORD)) throw new Error('Wrong password');
        if (!pathname.startsWith('album/')) throw new Error('Bad path');
        return {
          allowedContentTypes: ['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif', 'image/gif', 'video/mp4', 'video/quicktime', 'video/webm'],
          maximumSizeInBytes: 300 * 1024 * 1024,
          addRandomSuffix: true
        };
      },
      onUploadCompleted: async () => {}
    });
    return res.status(200).json(result);
  } catch (e) {
    return res.status(e.message === 'Wrong password' ? 401 : 400).json({ error: e.message });
  }
}
