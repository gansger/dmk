import { read } from '../core/store.js';
import { sendJson } from '../core/http.js';

// Problems in the server setup that the site owner should fix.
export function configurationWarnings() {
  const warnings = [];
  if (!String(process.env.CMS_SITE_URL || '').trim()) {
    warnings.push({
      id: 'site-url',
      title: 'Не задан адрес сайта (CMS_SITE_URL)',
      text: 'Без него ссылки в sitemap.xml, robots.txt и canonical строятся из адреса, по которому открыт сайт, и могут получиться с http:// или внутренним адресом. Укажите в .env.local, например: CMS_SITE_URL="https://example.ru".'
    });
  }
  return warnings;
}

export async function handleSystemApi({ response, method, pathname }) {
  if (method === 'GET' && pathname === '/api/health') {
    sendJson(response, 200, { ok: true, name: 'CMS Engine Starter', version: '0.1.0' });
    return true;
  }

  if (method === 'GET' && pathname === '/api/dashboard') {
    const [posts, integrations, knowledge, events, gallery] = await Promise.all([
      read('posts'),
      read('integrations'),
      read('knowledge'),
      read('events'),
      read('gallery')
    ]);
    sendJson(response, 200, {
      totals: {
        posts: posts.length,
        published: posts.filter((post) => post.status === 'published').length,
        drafts: posts.filter((post) => post.status === 'draft').length,
        slider: posts.filter((post) => post.showInSlider).length,
        gallery: gallery.length,
        knowledge: knowledge.length
      },
      integrations: {
        telegram: Boolean(integrations.telegram?.enabled),
        bitrix: Boolean(integrations.bitrix?.enabled),
        ai: Boolean(integrations.ai?.enabled)
      },
      events: events.slice(0, 8),
      warnings: configurationWarnings()
    });
    return true;
  }

  return false;
}
