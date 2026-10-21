import http from 'node:http';
import { getPublicDir } from './core/config.js';
import { ensureDataFiles } from './core/store.js';
import { applySecurityHeaders, sendJson, serveStatic } from './core/http.js';
import { allowPublicApiRequest, isPublicApi, isSameOriginRequest, requiresSameOrigin } from './routes/access.js';
import { handleAiApi } from './routes/ai.js';
import { handleAuthApi } from './routes/auth.js';
import { handleGalleryApi } from './routes/gallery.js';
import { handleIntegrationsApi } from './routes/integrations.js';
import { handlePagesApi } from './routes/pages.js';
import { handlePostsApi } from './routes/posts.js';
import { handleSiteRoute } from './routes/site.js';
import { configurationWarnings, handleSystemApi } from './routes/system.js';
import { handleUploadsApi } from './routes/uploads.js';
import { sessionUser } from './services/auth.js';
import { startTelegramScheduler } from './services/scheduler.js';

const publicDir = getPublicDir();
const port = Number(process.env.PORT || 3003);

// Each handler returns true when it has answered the request. Route paths do not
// overlap between modules, so the order only matters for readability.
const apiHandlers = [
  handleSystemApi,
  handleUploadsApi,
  handleGalleryApi,
  handlePostsApi,
  handlePagesApi,
  handleIntegrationsApi,
  handleAiApi
];

async function handleApi(context) {
  const { request, response, method, pathname } = context;
  if (requiresSameOrigin(method, pathname) && !isSameOriginRequest(request)) {
    sendJson(response, 403, { error: 'Cross-origin request is not allowed.' });
    return;
  }
  if (await handleAuthApi(context)) return;

  const user = sessionUser(request);
  if (!isPublicApi(method, pathname) && !user) {
    sendJson(response, 401, { error: 'Требуется авторизация администратора.' });
    return;
  }
  if (!user && method === 'POST' && !allowPublicApiRequest(request, response, pathname)) return;

  for (const handler of apiHandlers) {
    if (await handler(context)) return;
  }
  sendJson(response, 404, { error: 'API route not found' });
}

async function handleRequest(request, response) {
  applySecurityHeaders(request, response);
  try {
    const url = new URL(request.url, `http://${request.headers.host}`);
    const context = { request, response, url, method: request.method || 'GET', pathname: url.pathname };

    if (request.url.startsWith('/api/')) {
      await handleApi(context);
      return;
    }

    if (await handleSiteRoute(context)) return;
    const served = await serveStatic(request, response, publicDir);
    if (!served) sendJson(response, 404, { error: 'Not found' });
  } catch (error) {
    const statusCode = error.statusCode || 500;
    if (statusCode >= 500) console.error(error);
    sendJson(response, statusCode, { error: statusCode >= 500 ? 'Server error' : error.message || 'Request failed' });
  }
}

await ensureDataFiles();
startTelegramScheduler();

http.createServer(handleRequest).listen(port, () => {
  console.log(`CMS Engine Starter is running at http://localhost:${port}`);
  for (const warning of configurationWarnings()) console.warn(`Warning: ${warning.title}`);
});
