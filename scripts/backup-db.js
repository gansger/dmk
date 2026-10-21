// Consistent copy of the SQLite database, safe while the site is running.
// Usage: node scripts/backup-db.js [target.sqlite]
// Without a target, writes <db folder>/backups/cms-YYYY-MM-DD-HHMM.sqlite.
import { mkdirSync, existsSync } from 'node:fs';
import path from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { getRootDir } from '../src/core/config.js';

const source = path.resolve(getRootDir(), process.env.CMS_DB_PATH || path.join('data', 'cms.sqlite'));
const stamp = new Date().toISOString().slice(0, 16).replace('T', '-').replace(':', '');
const target = path.resolve(process.argv[2] || path.join(path.dirname(source), 'backups', `cms-${stamp}.sqlite`));

if (!existsSync(source)) {
  console.error(`Database not found: ${source}`);
  process.exit(1);
}
if (existsSync(target)) {
  console.error(`Target already exists: ${target}`);
  process.exit(1);
}

mkdirSync(path.dirname(target), { recursive: true });
// VACUUM INTO writes a complete, compacted copy inside one read transaction,
// so it is consistent even while the server keeps writing (WAL mode).
new DatabaseSync(source, { readOnly: true }).exec(`VACUUM INTO '${target.replaceAll("'", "''")}'`);
console.log(`Backup written: ${target}`);
