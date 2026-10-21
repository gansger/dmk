// Full-text index over the knowledge base (SQLite FTS5), used to give the AI
// assistant only the records relevant to the visitor's question.

const stopWords = new Set([
  'а', 'в', 'во', 'вы', 'где', 'да', 'для', 'до', 'же', 'за', 'и', 'из', 'или', 'как', 'какая', 'какие', 'какой',
  'когда', 'ли', 'мне', 'можно', 'мы', 'на', 'не', 'но', 'о', 'об', 'от', 'по', 'с', 'со', 'то', 'у', 'что', 'это',
  'я', 'есть', 'нужно', 'надо', 'ваш', 'ваша', 'ваши', 'вас', 'вам', 'the', 'and', 'for', 'what', 'how', 'is', 'are'
]);

// unicode61 folds case but not "ё", so both indexed text and queries go through this.
export function normalizeSearchText(value) {
  return String(value ?? '').toLowerCase().replaceAll('ё', 'е');
}

// Crude stemming for Russian: drop the ending so "общежития" finds "общежитие",
// then search by prefix.
function stem(word) {
  if (word.length >= 7) return word.slice(0, -2);
  if (word.length >= 5) return word.slice(0, -1);
  return word;
}

export function knowledgeMatchQuery(text) {
  const words = normalizeSearchText(text).match(/[\p{L}\p{N}]+/gu) || [];
  const terms = [...new Set(words.filter((word) => word.length >= 2 && !stopWords.has(word)).map(stem))];
  return terms.map((term) => `"${term}"*`).join(' OR ');
}

export function createKnowledgeIndex(db) {
  db.exec(`
    CREATE VIRTUAL TABLE IF NOT EXISTS knowledge_fts USING fts5(
      id UNINDEXED,
      title,
      content,
      tags,
      tokenize = 'unicode61 remove_diacritics 2'
    );
  `);
}

// Called inside the transaction that writes the knowledge collection, so the
// index can never drift from the records.
export function rebuildKnowledgeIndex(db, records = []) {
  db.prepare('DELETE FROM knowledge_fts').run();
  const insert = db.prepare('INSERT INTO knowledge_fts (id, title, content, tags) VALUES (?, ?, ?, ?)');
  for (const record of records) {
    insert.run(
      String(record.id),
      normalizeSearchText(record.title),
      normalizeSearchText(record.content),
      normalizeSearchText(Array.isArray(record.tags) ? record.tags.join(' ') : record.tags)
    );
  }
}

// Returns matching record ids, best first. Title matches weigh most, then tags.
export function searchKnowledgeIds(db, text, limit) {
  const match = knowledgeMatchQuery(text);
  if (!match) return [];
  return db
    .prepare('SELECT id FROM knowledge_fts WHERE knowledge_fts MATCH ? ORDER BY bm25(knowledge_fts, 0, 5.0, 1.0, 2.0) LIMIT ?')
    .all(match, limit)
    .map((row) => row.id);
}
