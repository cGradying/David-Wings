import { localDay, makeApi } from './core.js';

// HTTP face of the core, shared by the Node dev server and the Cloudflare Worker.
export async function handleApi(db, method, path, q, body) {
  const api = makeApi(db);
  const ok = (b, type = 'application/json') => ({ status: 200, body: b, type });
  try {
    let m;
    if (method === 'GET') {
      if (path === '/api/menu') return ok(await api.menu());
      if (path === '/api/cards') return ok(await api.cards());
      if (path === '/api/orders') return ok(await api.queue());
      if (path === '/api/stats') return ok(await api.stats(q.get('range')));
      if (path === '/api/ledger') return ok(await api.ledger(q.get('date') || localDay(Date.now(), (await api.settings()).tz)));
      if (path === '/api/settings') return ok(await api.settings());
      if (path === '/api/backup') return ok(await api.backup());
      if (path === '/api/export.csv') return ok(await api.csv(), 'text/csv');
    } else if (method === 'POST') {
      if (path === '/api/orders') return ok(await api.createOrder(body));
      if (path === '/api/restore') return ok(await api.restore(body));
      if ((m = path.match(/^\/api\/orders\/(\d+)\/done$/))) return ok(await api.finishOrder(Number(m[1])));
      if ((m = path.match(/^\/api\/orders\/(\d+)\/void$/))) return ok(await api.voidOrder(Number(m[1]), body.reason));
      if ((m = path.match(/^\/api\/close\/(\d{4}-\d{2}-\d{2})$/))) return ok(await api.saveClose(m[1], body));
    } else if (method === 'PUT') {
      if (path === '/api/settings') return ok(await api.saveSettings(body));
      if ((m = path.match(/^\/api\/menu\/(\d+)$/))) { await api.updateMenuItem(Number(m[1]), body); return ok({ ok: true }); }
    }
    return { status: 404, body: { error: 'Not found' } };
  } catch (e) {
    if (!e.status) console.error(e);
    return { status: e.status ?? 500, body: { error: e.status ? e.message : 'Server error' } };
  }
}
