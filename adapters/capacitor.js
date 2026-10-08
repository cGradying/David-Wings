// Native SQLite on the tablet, through @capacitor-community/sqlite.
import { CapacitorSQLite, SQLiteConnection } from '@capacitor-community/sqlite';

export async function capacitorAdapter(name = 'david_wings') {
  const sqlite = new SQLiteConnection(CapacitorSQLite);
  const exists = (await sqlite.isConnection(name, false)).result;
  const db = exists ? await sqlite.retrieveConnection(name, false) : await sqlite.createConnection(name, false, 'no-encryption', 1, false);
  await db.open();
  await db.execute('PRAGMA foreign_keys = ON;', false);
  return {
    get: async (sql, args = []) => (await db.query(sql, args)).values?.[0],
    all: async (sql, args = []) => (await db.query(sql, args)).values ?? [],
    run: async (sql, args = []) => ({ changes: (await db.run(sql, args, false)).changes?.changes ?? 0 }),
    exec: async (script) => { await db.execute(script, false); },
    // executeSet runs inside one transaction and rolls back if any statement fails.
    batch: async (stmts) => { await db.executeSet(stmts.map(([statement, values = []]) => ({ statement, values })), true); },
  };
}
