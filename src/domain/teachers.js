import { clampNumber } from './slider.js';

// The "teachers" collection: people shown on the teachers page, in the order set in the admin panel.

export function normalizeTeacher(input = {}, previous = {}) {
  const now = new Date().toISOString();
  return {
    id: previous.id || crypto.randomUUID(),
    name: String(input.name ?? previous.name ?? '').trim().slice(0, 180),
    position: String(input.position ?? previous.position ?? '').trim().slice(0, 180),
    url: String(input.url ?? previous.url ?? '').trim().slice(0, 2000),
    thumbUrl: String(input.thumbUrl ?? previous.thumbUrl ?? '').trim().slice(0, 2000),
    order: clampNumber(input.order ?? previous.order, 0, 100000, 0),
    enabled: Boolean(input.enabled ?? previous.enabled ?? true),
    createdAt: previous.createdAt || now,
    updatedAt: now
  };
}

export function sortedTeachers(items = []) {
  return [...items].sort(
    (a, b) => Number(a.order || 0) - Number(b.order || 0) || String(a.createdAt || '').localeCompare(String(b.createdAt || ''))
  );
}

export function nextTeacherOrder(items = []) {
  return items.reduce((max, item) => Math.max(max, Number(item.order || 0) + 1), 0);
}

// Applies an order chosen in the admin panel; people not listed keep their place after the listed ones.
export function reorderTeachers(items, ids) {
  const position = new Map(ids.map((id, index) => [id, index]));
  return sortedTeachers(items).map((item, index) => ({ ...item, order: position.get(item.id) ?? ids.length + index }));
}

export function publicTeachers(items = []) {
  return sortedTeachers(items)
    .filter((item) => item.enabled)
    .map((item) => ({ id: item.id, name: item.name, position: item.position, photoUrl: item.thumbUrl || item.url }));
}
