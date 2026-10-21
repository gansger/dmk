import { sendJson } from '../core/http.js';
import { clientIp, createRateLimiter, envLimit } from '../core/rate-limit.js';

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
