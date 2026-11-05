// Fills the information pages on top of the current database. Pages edited by
// hand are kept: only placeholders and missing pages change.
// Usage: CMS_DB_PATH=<db> node scripts/fill-info-pages.js [--dry-run]
import { appendEvent, read, write } from '../src/core/store.js';
import { applyInfoPages } from './content/info-pages.js';

const pages = await read('pages');
const { changes, kept } = applyInfoPages(pages);

console.log(`Changed (${changes.length}):\n  ${changes.join('\n  ') || '-'}`);
console.log(`Kept as is (${kept.length}):\n  ${kept.join('\n  ') || '-'}`);

if (process.argv.includes('--dry-run')) {
  console.log('Dry run: nothing saved.');
} else if (changes.length) {
  await write('pages', pages);
  await appendEvent('pages.info_filled', { changes });
  console.log('Saved.');
}
