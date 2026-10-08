// Cloudflare D1. Schema is applied with `wrangler d1 execute` (D1's exec() needs one statement per line),
// so exec() is unsupported here; batch() is D1's atomic transaction.
export function d1Adapter(d1) {
  const bind = (sql, args = []) => d1.prepare(sql).bind(...args);
  return {
    get: async (sql, args) => (await bind(sql, args).first()) ?? undefined,
    all: async (sql, args) => (await bind(sql, args).all()).results,
    run: async (sql, args) => ({ changes: (await bind(sql, args).run()).meta.changes }),
    batch: async (stmts) => { await d1.batch(stmts.map(([sql, args]) => bind(sql, args))); },
    exec: async () => { throw new Error('Apply schema.sql with wrangler; the Worker does not migrate.'); },
  };
}
