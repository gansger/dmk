import { appendEvent, read, write } from '../core/store.js';
import { syncPublishedPostPages } from './posts.js';

export const galleryPageId = 'fotogalereya';

function galleryPage() {
  return {
    id: galleryPageId,
    title: 'Фотогалерея',
    updatedAt: new Date().toISOString(),
    seo: { title: '', description: 'Фотографии из жизни колледжа: события, учёба, практика.', image: '', noIndex: false },
    blocks: [
      { id: 'slider', type: 'slider', enabled: false, order: 10, fields: {} },
      { id: 'posts', type: 'posts', enabled: false, order: 20, fields: {} },
      // limit 0: every photo, grouped by month.
      { id: 'gallery', type: 'gallery', enabled: true, order: 30, fields: { titleHtml: 'Фотогалерея', limit: 0 } }
    ]
  };
}

// Content every site needs, created once and editable afterwards: post photos
// in the media library (also for posts imported before the library existed)
// and the full-gallery page the home page links to.
export async function prepareContent() {
  await syncPublishedPostPages(await read('posts'));

  const pages = await read('pages');
  if (!pages[galleryPageId]) {
    pages[galleryPageId] = galleryPage();
    await write('pages', pages);
    await appendEvent('page.created', { id: galleryPageId, title: 'Фотогалерея' });
  }
}
