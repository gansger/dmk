import { createReadStream } from 'node:fs';
import { stat } from 'node:fs/promises';
import path from 'node:path';

const mimeTypes = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.gif': 'image/gif',
  '.ico': 'image/x-icon'
};

export function sendJson(response, statusCode, payload, headers = {}) {
  response.writeHead(statusCode, {
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'no-store',
    ...headers
  });
  response.end(JSON.stringify(payload));
}

export function sendText(response, statusCode, body, headers = {}) {
  response.writeHead(statusCode, {
    'Content-Type': 'text/plain; charset=utf-8',
    'Cache-Control': 'no-store',
    ...headers
  });
  response.end(body);
}

export function sendHtml(response, statusCode, html, headers = {}) {
  response.writeHead(statusCode, {
    'Content-Type': 'text/html; charset=utf-8',
    'Cache-Control': 'no-store',
    ...headers
  });
  response.end(html);
}

export function sendRedirect(response, location, statusCode = 302) {
  response.writeHead(statusCode, {
    Location: location,
    'Cache-Control': 'no-store'
  });
  response.end();
}

export function sendNoContent(response) {
  response.writeHead(204, { 'Cache-Control': 'no-store' });
  response.end();
}

export async function readBody(request) {
  const chunks = [];
  let size = 0;
  for await (const chunk of request) {
    size += chunk.length;
    if (size > 1024 * 1024) {
      const error = new Error('Request body is too large');
      error.statusCode = 413;
      throw error;
    }
    chunks.push(chunk);
  }
  const raw = Buffer.concat(chunks).toString('utf8');
  if (!raw) return {};

  try {
    return JSON.parse(raw);
  } catch {
    const error = new Error('Invalid JSON body');
    error.statusCode = 400;
    throw error;
  }
}

export async function serveFile(response, publicDir, fileName, options = {}) {
  const fullPath = path.resolve(publicDir, fileName);
  const publicPrefix = `${path.resolve(publicDir)}${path.sep}`;

  if (!fullPath.startsWith(publicPrefix)) {
    sendJson(response, 403, { error: 'Forbidden' });
    return true;
  }

  try {
    const info = await stat(fullPath);
    if (!info.isFile()) return false;

    response.writeHead(200, {
      'Content-Type': mimeTypes[path.extname(fullPath)] || 'application/octet-stream',
      'Cache-Control': options.cacheControl || 'no-store'
    });
    createReadStream(fullPath).pipe(response);
    return true;
  } catch {
    return false;
  }
}

export async function serveStatic(request, response, publicDir) {
  const url = new URL(request.url, `http://${request.headers.host}`);
  const cleanPath = decodeURIComponent(url.pathname).replace(/^\/+/, '');
  const extension = path.extname(cleanPath);
  const cacheControl = extension && extension !== '.html'
    ? 'public, max-age=31536000, immutable'
    : 'no-store';
  return serveFile(response, publicDir, cleanPath || 'site.html', { cacheControl });
}

export function routeParams(pattern, pathname) {
  const patternParts = pattern.split('/').filter(Boolean);
  const pathParts = pathname.split('/').filter(Boolean);
  if (patternParts.length !== pathParts.length) return null;

  const params = {};
  for (let index = 0; index < patternParts.length; index += 1) {
    const patternPart = patternParts[index];
    const pathPart = pathParts[index];

    if (patternPart.startsWith(':')) {
      params[patternPart.slice(1)] = pathPart;
      continue;
    }

    if (patternPart !== pathPart) return null;
  }

  return params;
}
