// Password page for the whole site. Anyone without the oe_auth cookie is sent to
// /login. The cookie is an HMAC of GUEST_PASSWORD, so changing the password on
// Vercel signs everyone out.
import { next } from '@vercel/functions/middleware';

export const config = {
  // Public: the login page, its fonts, the share image and the two endpoints that check the password themselves.
  matcher: ['/((?!login|api/login|api/upload|assets/fonts/|assets/og\\.jpg|favicon|app/manifest\\.webmanifest|app/sw\\.js|app/icons/).*)']
};

async function hmac(secret, label) {
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey('raw', enc.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const sig = await crypto.subtle.sign('HMAC', key, enc.encode(label));
  return [...new Uint8Array(sig)].map((b) => b.toString(16).padStart(2, '0')).join('');
}
const siteToken = (password) => hmac(password, 'openedition-site-v1');
const DEMO = '/app/?sample&at=sat-16:45';

// Preview PIN holders see the app in sample mode only: no site, no API, no address.
async function previewOnly(request, url) {
  const pin = process.env.VIEW_PIN || '';
  const v = (request.headers.get('cookie') || '').match(/(?:^|;\s*)oe_view=([a-f0-9]{64})/);
  if (!pin || !v || v[1] !== (await hmac(pin, 'openedition-view-v1'))) return null;
  const p = url.pathname;
  if (p.startsWith('/api/')) return new Response(JSON.stringify({ error: 'Preview only' }), { status: 401, headers: { 'content-type': 'application/json' } });
  if (p === '/app' || p === '/app/') return url.searchParams.has('sample') ? next() : Response.redirect(new URL(DEMO, url), 302);
  if (p.startsWith('/app/') || p.startsWith('/assets/')) return next();
  if (p === '/tape') return url.searchParams.has('sample') ? next() : Response.redirect(new URL('/tape?sample', url), 302);
  return Response.redirect(new URL(DEMO, url), 302);
}

export default async function middleware(request) {
  const password = process.env.GUEST_PASSWORD || '';
  const m = (request.headers.get('cookie') || '').match(/(?:^|;\s*)oe_auth=([a-f0-9]{64})/);
  if (password && m && m[1] === (await siteToken(password))) return next();

  const url = new URL(request.url);
  const preview = await previewOnly(request, url);
  if (preview) return preview;
  if (url.pathname.startsWith('/api/')) {
    return new Response(JSON.stringify({ error: 'Wrong password' }), { status: 401, headers: { 'content-type': 'application/json' } });
  }
  const login = new URL('/login', url);
  if (url.pathname !== '/') login.searchParams.set('next', url.pathname + url.search);
  return Response.redirect(login, 302);
}
