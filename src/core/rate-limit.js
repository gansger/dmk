const trustProxy = ['1', 'true', 'yes'].includes(String(process.env.CMS_TRUST_PROXY || '').toLowerCase());

export function clientIp(request) {
  if (trustProxy) {
    const forwarded = String(request.headers['x-forwarded-for'] || '').split(',')[0].trim();
    if (forwarded) return forwarded;
  }
  return request.socket.remoteAddress || 'unknown';
}

export function envLimit(name, fallback) {
  const value = Number(process.env[name]);
  return Number.isInteger(value) && value > 0 ? value : fallback;
}

// Fixed-window counter: cheap, in-memory, good enough for a single-process server.
export function createRateLimiter({ windowMs, max, maxKeys = 10000 }) {
  const buckets = new Map();

  function prune(now) {
    for (const [key, bucket] of buckets) {
      if (bucket.resetAt <= now) buckets.delete(key);
    }
  }

  return {
    hit(key = 'global') {
      const now = Date.now();
      if (buckets.size >= maxKeys) prune(now);

      let bucket = buckets.get(key);
      if (!bucket || bucket.resetAt <= now) {
        bucket = { count: 0, resetAt: now + windowMs };
        buckets.set(key, bucket);
      }
      if (bucket.count >= max) {
        return { allowed: false, retryAfterSeconds: Math.max(1, Math.ceil((bucket.resetAt - now) / 1000)) };
      }
      bucket.count += 1;
      return { allowed: true, retryAfterSeconds: 0 };
    }
  };
}
