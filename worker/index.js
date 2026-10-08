import { handleApi } from '../core/routes.js';
import { d1Adapter } from '../adapters/d1.js';
import { verifyAccess } from './access.js';

const SECURITY = { 'X-Content-Type-Options': 'nosniff', 'X-Frame-Options': 'DENY', 'Referrer-Policy': 'no-referrer', 'Cache-Control': 'no-store' };

export default {
  async fetch(request, env) {
    if (!(await verifyAccess(request, env))) return new Response('Sign in through Cloudflare Access.', { status: 401, headers: SECURITY });
    const url = new URL(request.url);
    if (!url.pathname.startsWith('/api/')) {
      const r = await env.ASSETS.fetch(request);
      const h = new Headers(r.headers); for (const [k, v] of Object.entries(SECURITY)) h.set(k, v);
      return new Response(r.body, { status: r.status, headers: h });
    }
    let body = {};
    if (request.method !== 'GET') {
      const raw = await request.text();
      if (raw.length > 3e6) return Response.json({ error: 'Too large' }, { status: 413, headers: SECURITY });
      try { body = raw ? JSON.parse(raw) : {}; } catch { return Response.json({ error: 'Bad JSON' }, { status: 400, headers: SECURITY }); }
    }
    const r = await handleApi(d1Adapter(env.DB), request.method, url.pathname, url.searchParams, body);
    const headers = { ...SECURITY, 'Content-Type': r.type ?? 'application/json' };
    return new Response(typeof r.body === 'string' ? r.body : JSON.stringify(r.body), { status: r.status, headers });
  },
};
