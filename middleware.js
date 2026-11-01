// Password page for the whole site. Anyone without the oe_auth cookie is sent to
// /login. The cookie is an HMAC of GUEST_PASSWORD, so changing the password on
// Vercel signs everyone out.
import { next } from '@vercel/functions/middleware';

export const config = {
  // Public: the login page, its fonts, the share image and the two endpoints that check the password themselves.
  matcher: ['/((?!login|api/login|api/upload|assets/fonts/|assets/og\\.jpg|favicon).*)']
};

async function siteToken(password) {
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey('raw', enc.encode(password), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const sig = await crypto.subtle.sign('HMAC', key, enc.encode('openedition-site-v1'));
  return [...new Uint8Array(sig)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

export default async function middleware(request) {
  const password = process.env.GUEST_PASSWORD || '';
  const m = (request.headers.get('cookie') || '').match(/(?:^|;\s*)oe_auth=([a-f0-9]{64})/);
  if (password && m && m[1] === (await siteToken(password))) return next();

  const url = new URL(request.url);
  if (url.pathname.startsWith('/api/')) {
    return new Response(JSON.stringify({ error: 'Wrong password' }), { status: 401, headers: { 'content-type': 'application/json' } });
  }
  const login = new URL('/login', url);
  if (url.pathname !== '/') login.searchParams.set('next', url.pathname + url.search);
  return Response.redirect(login, 302);
}
