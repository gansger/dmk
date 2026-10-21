import { clampNumber } from './slider.js';

export function normalizeGalleryItem(input = {}, previous = {}) {
  const now = new Date().toISOString();
  const url = String(input.url ?? previous.url ?? '').trim().slice(0, 2000);
  return {
    id: previous.id || crypto.randomUUID(),
    url,
    caption: String(input.caption ?? previous.caption ?? '').trim().slice(0, 220),
    alt: String(input.alt ?? previous.alt ?? input.caption ?? previous.caption ?? '').trim().slice(0, 220),
    order: clampNumber(input.order ?? previous.order, 0, 10000, 0),
    enabled: Boolean(input.enabled ?? previous.enabled ?? true),
    createdAt: previous.createdAt || now,
    updatedAt: now
  };
}

export function sortedGalleryItems(items = []) {
  return [...items].sort(
    (a, b) =>
      Number(a.order || 0) - Number(b.order || 0) ||
      String(b.createdAt || '').localeCompare(String(a.createdAt || ''))
  );
}
