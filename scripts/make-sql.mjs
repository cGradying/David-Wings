// Writes worker/schema.sql and worker/seed.sql for D1.  node scripts/make-sql.mjs [--demo]
// seed.sql = menu + settings; --demo adds ~2 weeks of fake sales.
import { writeFileSync } from 'node:fs';
import { SCHEMA, exportData, migrate } from '../core/core.js';
import { seed } from '../core/seed.js';
import { nodeAdapter } from '../adapters/node.js';

const one = (s) => s.replace(/\s+/g, ' ').trim();
writeFileSync('worker/schema.sql', SCHEMA.split(';').map(one).filter(Boolean).map((s) => s + ';').join('\n') + '\n');

const demo = process.argv.includes('--demo');
const db = nodeAdapter(':memory:');
await migrate(db);
await seed(db);
const dump = await exportData(db);
const q = (v) => (v == null ? 'NULL' : typeof v === 'number' ? String(v) : `'${String(v).replaceAll("'", "''")}'`);
const lines = [];
for (const t of ['settings', 'menu_items', ...(demo ? ['orders', 'order_items'] : [])]) {
  for (const r of dump.tables[t]) {
    if (t === 'settings' && r.key === 'last_backup') continue;
    lines.push(`INSERT OR REPLACE INTO ${t} (${Object.keys(r).join(', ')}) VALUES (${Object.values(r).map(q).join(', ')});`);
  }
}
writeFileSync('worker/seed.sql', lines.join('\n') + '\n');
console.log(`worker/schema.sql, worker/seed.sql (${lines.length} statements${demo ? ', with demo sales' : ''})`);
