import { Redis } from "@upstash/redis";
import fs from "fs";
import path from "path";

// Vercel's Redis (Upstash) marketplace integration injects either KV_REST_API_*
// (legacy Vercel KV naming, still widely used) or UPSTASH_REDIS_REST_* env vars
// depending on how it was added — support both so setup doesn't hinge on which
// name shows up in the dashboard.
const REST_URL = process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL;
const REST_TOKEN = process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN;

const redis = REST_URL && REST_TOKEN ? new Redis({ url: REST_URL, token: REST_TOKEN }) : null;

// Local dev fallback: when no cloud Redis is configured (e.g. running `npm run
// dev` without a Vercel KV/Upstash integration attached), all data is kept in
// a single local JSON file instead. This is NOT used in production — once
// KV_REST_API_URL/TOKEN are set (which Vercel does automatically once you add
// the integration), storage transparently switches to real persisted Redis.
const LOCAL_STORE_PATH = path.join(process.cwd(), "data", "store.local.json");

function readLocalStore(): Record<string, unknown> {
  try {
    if (!fs.existsSync(LOCAL_STORE_PATH)) return {};
    return JSON.parse(fs.readFileSync(LOCAL_STORE_PATH, "utf-8"));
  } catch (err) {
    console.error("Failed to read local store, starting fresh:", err);
    return {};
  }
}

function writeLocalStore(data: Record<string, unknown>) {
  fs.mkdirSync(path.dirname(LOCAL_STORE_PATH), { recursive: true });
  fs.writeFileSync(LOCAL_STORE_PATH, JSON.stringify(data, null, 2), "utf-8");
}

export async function kvGet<T>(key: string): Promise<T | null> {
  if (redis) {
    const value = await redis.get<T>(key);
    return value ?? null;
  }
  const store = readLocalStore();
  return (store[key] as T) ?? null;
}

export async function kvSet<T>(key: string, value: T): Promise<void> {
  if (redis) {
    await redis.set(key, value);
    return;
  }
  const store = readLocalStore();
  store[key] = value;
  writeLocalStore(store);
}

export async function kvDelete(key: string): Promise<void> {
  if (redis) {
    await redis.del(key);
    return;
  }
  const store = readLocalStore();
  delete store[key];
  writeLocalStore(store);
}

/** Lists keys starting with `prefix`. Fine at this app's scale (single coach, a
 *  few dozen keys); not intended for large datasets. */
export async function kvKeysWithPrefix(prefix: string): Promise<string[]> {
  if (redis) {
    return await redis.keys(`${prefix}*`);
  }
  const store = readLocalStore();
  return Object.keys(store).filter((k) => k.startsWith(prefix));
}

export function isUsingCloudKV(): boolean {
  return Boolean(redis);
}
