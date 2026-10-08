import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { extname, join, normalize } from 'node:path';
import { fileURLToPath } from 'node:url';
import { handleApi } from './core/routes.js';
import { migrate } from './core/core.js';
import { seed } from './core/seed.js';
import { nodeAdapter } from './adapters/node.js';

const PUB = join(fileURLToPath(new URL('.', import.meta.url)), 'public');
const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.svg': 'image/svg+xml', '.png': 'image/png', '.webmanifest': 'application/manifest+json' };

export function makeHandler(db) {
  return async (req, res) => {
    const url = new URL(req.url, 'http://x');
    const send = (code, body, type = 'application/json') => {
      res.writeHead(code, { 'Content-Type': type, 'Cache-Control': 'no-cache' });
      res.end(typeof body === 'string' || Buffer.isBuffer(body) ? body : JSON.stringify(body));
    };
    try {
      if (url.pathname.startsWith('/api/')) {
        let raw = '';
        for await (const c of req) { raw += c; if (raw.length > 3e6) throw Object.assign(new Error('Too large'), { status: 413 }); }
        const r = await handleApi(db, req.method, url.pathname, url.searchParams, raw ? JSON.parse(raw) : {});
        return send(r.status, r.body, r.type);
      }
      const rel = normalize(url.pathname === '/' ? '/index.html' : url.pathname);
      if (rel.includes('..')) return send(403, 'Forbidden', 'text/plain');
      send(200, await readFile(join(PUB, rel)), TYPES[extname(rel)] ?? 'application/octet-stream');
    } catch (e) {
      if (e.code === 'ENOENT') return send(404, 'Not found', 'text/plain');
      send(e.status ?? 500, { error: e.status ? e.message : 'Server error' });
      if (!e.status) console.error(e);
    }
  };
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const db = nodeAdapter(process.env.DB ?? 'data/ledger.db');
  await migrate(db);
  await seed(db);
  const port = Number(process.env.PORT ?? 3000);
  createServer(makeHandler(db)).listen(port, () => console.log(`David Wings Ledger on http://localhost:${port}`));
}
