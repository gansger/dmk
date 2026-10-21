import { createHash } from 'node:crypto';
import { createReadStream } from 'node:fs';
import { readFile, stat } from 'node:fs/promises';
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

const contentSecurityPolicy = [
  "default-src 'self'",
  "script-src 'self'",
  // Page builder blocks rely on style attributes.
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob: https:",
  "media-src 'self' blob: https:",
  "font-src 'self' data:",
  "connect-src 'self'",
  'frame-src https://drive.google.com',
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "frame-ancestors 'none'"
].join('; ');

export function applySecurityHeaders(request, response) {
  response.setHeader('Content-Security-Policy', contentSecurityPolicy);
  response.setHeader('X-Content-Type-Options', 'nosniff');
  response.setHeader('X-Frame-Options', 'DENY');
  response.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  response.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=(), payment=()');
  response.setHeader('Cross-Origin-Opener-Policy', 'same-origin');
  if (request.socket.encrypted || request.headers['x-forwarded-proto'] === 'https') {
    response.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
  }
}

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

export async function readBody(request, { maxBytes = 1024 * 1024 } = {}) {
  const chunks = [];
  let size = 0;
  for await (const chunk of request) {
    size += chunk.length;
    if (size > maxBytes) {
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

function resolvePublicPath(publicDir, fileName) {
  const fullPath = path.resolve(publicDir, fileName);
  const publicPrefix = `${path.resolve(publicDir)}${path.sep}`;
  return fullPath.startsWith(publicPrefix) ? fullPath : null;
}

// Content hash per file, recomputed only when the file changes on disk.
const assetHashes = new Map();

async function assetInfo(fullPath) {
  const info = await stat(fullPath);
  if (!info.isFile()) return null;

  const cached = assetHashes.get(fullPath);
  if (cached && cached.mtimeMs === info.mtimeMs && cached.size === info.size) return cached;

  const hash = createHash('sha256').update(await readFile(fullPath)).digest('hex').slice(0, 12);
  const next = { mtimeMs: info.mtimeMs, size: info.size, hash, etag: `"${hash}"` };
  assetHashes.set(fullPath, next);
  return next;
}

const versionedAssetPattern = /(\s(?:src|href)=")(\/[^"?#]+\.(?:js|css|png|jpe?g|webp|gif|svg|ico))(?:\?[^"#]*)?(")/g;

// Rewrites local asset links in HTML to "/file.js?v=<content hash>", so a deploy
// never serves stale cached JS/CSS and nobody has to bump ?v= by hand.
export async function versionAssetUrls(html, publicDir) {
  const versions = new Map();
  for (const [, , assetPath] of html.matchAll(versionedAssetPattern)) {
    if (versions.has(assetPath)) continue;
    let info = null;
    try {
      const fullPath = resolvePublicPath(publicDir, decodeURIComponent(assetPath.slice(1)));
      if (fullPath) info = await assetInfo(fullPath);
    } catch {
      // Broken or missing asset link: leave it as written.
    }
    versions.set(assetPath, info);
  }
  return html.replace(versionedAssetPattern, (match, prefix, assetPath, suffix) => {
    const info = versions.get(assetPath);
    return info ? `${prefix}${assetPath}?v=${info.hash}${suffix}` : match;
  });
}

export async function serveFile(response, publicDir, fileName, options = {}) {
  const fullPath = resolvePublicPath(publicDir, fileName);
  if (!fullPath) {
    sendJson(response, 403, { error: 'Forbidden' });
    return true;
  }

  let info;
  try {
    info = await assetInfo(fullPath);
  } catch {
    return false;
  }
  if (!info) return false;

  const contentType = mimeTypes[path.extname(fullPath)] || 'application/octet-stream';
  if (path.extname(fullPath) === '.html') {
    const html = await versionAssetUrls(await readFile(fullPath, 'utf8'), publicDir);
    sendHtml(response, 200, html);
    return true;
  }

  // Only a URL carrying the current hash may be cached forever; anything else is
  // revalidated with ETag, which is a cheap 304 when the file has not changed.
  const immutable = options.version === info.hash;
  const headers = {
    'Content-Type': contentType,
    'Cache-Control': immutable ? 'public, max-age=31536000, immutable' : 'no-cache',
    ETag: info.etag
  };
  if (options.request?.headers['if-none-match'] === info.etag) {
    response.writeHead(304, headers);
    response.end();
    return true;
  }

  response.writeHead(200, headers);
  createReadStream(fullPath).pipe(response);
  return true;
}

export async function serveStatic(request, response, publicDir) {
  const url = new URL(request.url, `http://${request.headers.host}`);
  const cleanPath = decodeURIComponent(url.pathname).replace(/^\/+/, '');
  return serveFile(response, publicDir, cleanPath || 'site.html', {
    request,
    version: url.searchParams.get('v')
  });
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
