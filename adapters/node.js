import { DatabaseSync } from 'node:sqlite';
import { mkdirSync } from 'node:fs';
import { dirname } from 'node:path';

export function nodeAdapter(path = 'data/ledger.db') {
  if (path !== ':memory:') mkdirSync(dirname(path), { recursive: true });
  const db = new DatabaseSync(path);
  db.exec('PRAGMA journal_mode = WAL; PRAGMA foreign_keys = ON;');
  const one = (sql, args = []) => db.prepare(sql).get(...args);
  return {
    get: async (sql, args) => one(sql, args),
    all: async (sql, args = []) => db.prepare(sql).all(...args),
    run: async (sql, args = []) => ({ changes: db.prepare(sql).run(...args).changes }),
    exec: async (script) => db.exec(script),
    async batch(stmts) {
      db.exec('BEGIN IMMEDIATE');
      try {
        for (const [sql, args = []] of stmts) db.prepare(sql).run(...args);
        db.exec('COMMIT');
      } catch (e) {
        db.exec('ROLLBACK');
        throw e;
      }
    },
    close: () => db.close(),
  };
}
