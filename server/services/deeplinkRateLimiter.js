const { createClient } = require('redis');

const WINDOW_MS = 60 * 1000;
const DEEPLINK_MAX_REQUESTS_PER_MIN = Math.max(
  1,
  parseInt(process.env.DEEPLINK_MAX_REQUESTS_PER_MIN || '42', 10) || 42,
);
const DEEPLINK_LOCAL_COOLDOWN_MS = Math.max(
  15000,
  parseInt(process.env.DEEPLINK_LOCAL_COOLDOWN_MS || '60000', 10) || 60000,
);
const REDIS_URL = (process.env.REDIS_URL || '').trim();
const REDIS_PREFIX = (process.env.REDIS_PREFIX || 'lapprice').trim() || 'lapprice';
const REDIS_ENABLED = REDIS_URL.length > 0;

const redisKeys = {
  bucket: `${REDIS_PREFIX}:deeplink:bucket`,
  cooldownUntil: `${REDIS_PREFIX}:deeplink:cooldown_until`,
};

const localState = {
  cooldownUntil: 0,
  windowStartAt: Date.now(),
  windowCount: 0,
};

let redisClientPromise = null;
let redisErrorLoggedAt = 0;

function toIso(value) {
  if (!value || Number.isNaN(value)) return null;
  return new Date(value).toISOString();
}

function shouldLogRedisError() {
  const now = Date.now();
  if (now - redisErrorLoggedAt < 60000) return false;
  redisErrorLoggedAt = now;
  return true;
}

async function getRedisClient() {
  if (!REDIS_ENABLED) return null;
  if (redisClientPromise) return redisClientPromise;

  redisClientPromise = (async () => {
    const client = createClient({ url: REDIS_URL });
    client.on('error', (err) => {
      if (shouldLogRedisError()) {
        console.error('[DeeplinkRateLimiter] Redis client error:', err?.message || err);
      }
    });
    await client.connect();
    return client;
  })().catch((err) => {
    if (shouldLogRedisError()) {
      console.error('[DeeplinkRateLimiter] Redis connection failed. Fallback to local limiter:', err?.message || err);
    }
    redisClientPromise = null;
    return null;
  });

  return redisClientPromise;
}

function consumeLocalToken() {
  const now = Date.now();
  if (now < localState.cooldownUntil) {
    return {
      allowed: false,
      reason: 'cooldown',
      retryAt: toIso(localState.cooldownUntil),
      retryAtMs: localState.cooldownUntil,
    };
  }

  if (now - localState.windowStartAt >= WINDOW_MS) {
    localState.windowStartAt = now;
    localState.windowCount = 0;
  }

  if (localState.windowCount >= DEEPLINK_MAX_REQUESTS_PER_MIN) {
    const retryAtMs = localState.windowStartAt + WINDOW_MS;
    return {
      allowed: false,
      reason: 'rate_limited',
      retryAt: toIso(retryAtMs),
      retryAtMs,
    };
  }

  localState.windowCount += 1;
  return {
    allowed: true,
    reason: 'ok',
    retryAt: null,
    retryAtMs: 0,
  };
}

async function takeToken() {
  const client = await getRedisClient();
  if (!client) return consumeLocalToken();

  const nowMs = Date.now();
  const lua = `
    local now = tonumber(ARGV[1])
    local windowMs = tonumber(ARGV[2])
    local maxPerMin = tonumber(ARGV[3])

    local cooldownUntil = tonumber(redis.call('GET', KEYS[2]) or '0')
    if cooldownUntil > now then
      return {0, 'cooldown', cooldownUntil}
    end

    local count = tonumber(redis.call('INCR', KEYS[1]) or '0')
    if count == 1 then
      redis.call('PEXPIRE', KEYS[1], windowMs)
    end

    local ttl = tonumber(redis.call('PTTL', KEYS[1]) or '0')
    if count > maxPerMin then
      local retryAt = now + math.max(ttl, 1)
      return {0, 'rate_limited', retryAt}
    end

    return {1, 'ok', 0}
  `;

  try {
    const result = await client.eval(lua, {
      keys: [redisKeys.bucket, redisKeys.cooldownUntil],
      arguments: [
        String(nowMs),
        String(WINDOW_MS),
        String(DEEPLINK_MAX_REQUESTS_PER_MIN),
      ],
    });

    const allowed = Number(result?.[0]) === 1;
    const reason = String(result?.[1] || (allowed ? 'ok' : 'rate_limited'));
    const retryAtMs = Number(result?.[2] || 0);

    return {
      allowed,
      reason,
      retryAt: toIso(retryAtMs),
      retryAtMs: Number.isFinite(retryAtMs) ? retryAtMs : 0,
    };
  } catch (err) {
    if (shouldLogRedisError()) {
      console.error('[DeeplinkRateLimiter] Redis eval failed. Fallback to local limiter:', err?.message || err);
    }
    return consumeLocalToken();
  }
}

async function setCooldownUntil(untilMs) {
  const numericUntil = Number(untilMs || 0);
  if (!Number.isFinite(numericUntil) || numericUntil <= Date.now()) return null;

  const client = await getRedisClient();
  if (!client) {
    localState.cooldownUntil = Math.max(localState.cooldownUntil, numericUntil);
    return toIso(localState.cooldownUntil);
  }

  try {
    const lua = `
      local current = tonumber(redis.call('GET', KEYS[1]) or '0')
      local incoming = tonumber(ARGV[1])
      if incoming > current then
        redis.call('SET', KEYS[1], incoming, 'PXAT', incoming)
        return incoming
      end
      return current
    `;
    const storedUntil = await client.eval(lua, {
      keys: [redisKeys.cooldownUntil],
      arguments: [String(numericUntil)],
    });
    const until = Number(storedUntil || 0);
    return toIso(until);
  } catch (err) {
    if (shouldLogRedisError()) {
      console.error('[DeeplinkRateLimiter] setCooldownUntil failed. Fallback to local limiter:', err?.message || err);
    }
    localState.cooldownUntil = Math.max(localState.cooldownUntil, numericUntil);
    return toIso(localState.cooldownUntil);
  }
}

async function getCooldownUntil() {
  const client = await getRedisClient();
  if (!client) {
    return localState.cooldownUntil > Date.now() ? toIso(localState.cooldownUntil) : null;
  }

  try {
    const raw = await client.get(redisKeys.cooldownUntil);
    const numeric = Number(raw || 0);
    if (!Number.isFinite(numeric) || numeric <= Date.now()) return null;
    return toIso(numeric);
  } catch (err) {
    if (shouldLogRedisError()) {
      console.error('[DeeplinkRateLimiter] getCooldownUntil failed. Fallback to local limiter:', err?.message || err);
    }
    return localState.cooldownUntil > Date.now() ? toIso(localState.cooldownUntil) : null;
  }
}

module.exports = {
  takeToken,
  setCooldownUntil,
  getCooldownUntil,
};
