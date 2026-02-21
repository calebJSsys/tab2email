// Simple in-memory cache with TTL
const cache = new Map();

const DEFAULT_TTL = 24 * 60 * 60 * 1000; // 24 hours

function get(key) {
  const entry = cache.get(key);
  if (!entry) return null;
  if (Date.now() > entry.expires) {
    cache.delete(key);
    return null;
  }
  return entry.value;
}

function set(key, value, ttl = DEFAULT_TTL) {
  cache.set(key, { value, expires: Date.now() + ttl });
}

function clear() {
  cache.clear();
}

module.exports = { get, set, clear };
