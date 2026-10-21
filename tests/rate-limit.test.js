import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createRateLimiter, envLimit } from '../src/core/rate-limit.js';

test('allows up to max hits per key, then reports retry time', () => {
  const limiter = createRateLimiter({ windowMs: 60_000, max: 2 });
  assert.equal(limiter.hit('a').allowed, true);
  assert.equal(limiter.hit('a').allowed, true);
  const blocked = limiter.hit('a');
  assert.equal(blocked.allowed, false);
  assert.ok(blocked.retryAfterSeconds > 0 && blocked.retryAfterSeconds <= 60);
  assert.equal(limiter.hit('b').allowed, true, 'keys are independent');
});

test('window resets after it expires', async () => {
  const limiter = createRateLimiter({ windowMs: 20, max: 1 });
  assert.equal(limiter.hit('a').allowed, true);
  assert.equal(limiter.hit('a').allowed, false);
  await new Promise((resolve) => setTimeout(resolve, 30));
  assert.equal(limiter.hit('a').allowed, true);
});

test('envLimit accepts only positive integers', () => {
  process.env.TEST_LIMIT = '7';
  assert.equal(envLimit('TEST_LIMIT', 3), 7);
  for (const value of ['0', '-1', '1.5', 'abc', '']) {
    process.env.TEST_LIMIT = value;
    assert.equal(envLimit('TEST_LIMIT', 3), 3);
  }
  delete process.env.TEST_LIMIT;
});
