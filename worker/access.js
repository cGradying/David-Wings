// Verifies the Cloudflare Access JWT so the API stays closed even if someone reaches the
// Worker URL directly instead of through the Access login.
const b64 = (s) => Uint8Array.from(atob(s.replace(/-/g, '+').replace(/_/g, '/')), (c) => c.charCodeAt(0));
let keys = { at: 0, jwks: [] };

export async function verifyAccess(request, env) {
  if (env.DEV === '1') return true; // local `wrangler dev` only; never set in production
  if (!env.ACCESS_TEAM || !env.ACCESS_AUD) return false;
  const jwt = request.headers.get('Cf-Access-Jwt-Assertion');
  const [h, p, sig] = jwt?.split('.') ?? [];
  if (!sig) return false;
  try {
    const header = JSON.parse(new TextDecoder().decode(b64(h))), claims = JSON.parse(new TextDecoder().decode(b64(p)));
    if (Date.now() - keys.at > 3600e3) {
      const r = await fetch(`https://${env.ACCESS_TEAM}.cloudflareaccess.com/cdn-cgi/access/certs`);
      keys = { at: Date.now(), jwks: (await r.json()).keys };
    }
    const jwk = keys.jwks.find((k) => k.kid === header.kid);
    if (!jwk || header.alg !== 'RS256') return false;
    const key = await crypto.subtle.importKey('jwk', jwk, { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' }, false, ['verify']);
    const ok = await crypto.subtle.verify('RSASSA-PKCS1-v1_5', key, b64(sig), new TextEncoder().encode(`${h}.${p}`));
    const aud = [].concat(claims.aud);
    return ok && aud.includes(env.ACCESS_AUD) && claims.exp * 1000 > Date.now() && claims.iss === `https://${env.ACCESS_TEAM}.cloudflareaccess.com`;
  } catch { return false; }
}
