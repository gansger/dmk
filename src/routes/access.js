import { sendJson } from '../core/http.js';
import { clientIp, createRateLimiter, envLimit, isProxyTrusted } from '../core/rate-limit.js';

const minuteMs = 60 * 1000;
const hourMs = 60 * minuteMs;
// Public endpoints cost money (AI tokens) or create CRM records, so cap them per IP and in total.
const publicApiLimits = {
  '/api/ai/assistant': [
    { scope: 'ip', limiter: createRateLimiter({ windowMs: 10 * minuteMs, max: envLimit('CMS_AI_LIMIT_PER_IP', 20) }) },
    { scope: 'global', limiter: createRateLimiter({ windowMs: hourMs, max: envLimit('CMS_AI_LIMIT_PER_HOUR', 300) }) }
  ],
  '/api/integrations/bitrix/lead': [
    { scope: 'ip', limiter: createRateLimiter({ windowMs: hourMs, max: envLimit('CMS_LEAD_LIMIT_PER_IP', 5) }) },
    { scope: 'global', limiter: createRateLimiter({ windowMs: hourMs, max: envLimit('CMS_LEAD_LIMIT_PER_HOUR', 100) }) }
  ]
};

export function isPublicApi(method, pathname) {
  if (pathname.startsWith('/api/auth/')) return true;
  if (method === 'GET' && pathname === '/api/health') return true;
  if (method === 'GET' && pathname.startsWith('/api/public/')) return true;
  if (method === 'POST' && pathname === '/api/ai/assistant') return true;
  if (method === 'POST' && pathname === '/api/integrations/bitrix/lead') return true;
  if (method === 'POST' && pathname === '/api/integrations/telegram/webhook') return true;
  return false;
}

// Endpoints that other sites legitimately call (the chat widget, lead forms,
// Telegram) are exempt; every other state-changing API call must come from this site.
const crossOriginEndpoints = new Set(['/api/ai/assistant', '/api/integrations/bitrix/lead', '/api/integrations/telegram/webhook']);

export function requiresSameOrigin(method, pathname) {
  return ['POST', 'PUT', 'PATCH', 'DELETE'].includes(method) && !crossOriginEndpoints.has(pathname);
}

// Browsers send Origin with cross-site POSTs; a forged form on another site is refused.
export function isSameOriginRequest(request) {
  const origin = request.headers.origin;
  if (!origin) return true;
  try {
    const protocol = isProxyTrusted()
      ? String(request.headers['x-forwarded-proto'] || 'http').split(',')[0].trim()
      : request.socket.encrypted
        ? 'https'
        : 'http';
    return new URL(origin).origin === `${protocol}://${request.headers.host}`;
  } catch {
    return false;
  }
}

export function allowPublicApiRequest(request, response, pathname) {
  const limits = publicApiLimits[pathname];
  if (!limits) return true;

  const ip = clientIp(request);
  for (const { scope, limiter } of limits) {
    const result = limiter.hit(scope === 'ip' ? ip : 'global');
    if (!result.allowed) {
      sendJson(
        response,
        429,
        { error: 'Слишком много запросов. Попробуйте позже.' },
        { 'Retry-After': String(result.retryAfterSeconds) }
      );
      return false;
    }
  }
  return true;
}
