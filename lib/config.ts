import fs from "fs";
import path from "path";
import { AppConfig, DEFAULT_CONFIG } from "./types";

const CONFIG_DIR = path.join(process.cwd(), "data");
const CONFIG_PATH = path.join(CONFIG_DIR, "config.local.json");

function ensureConfigDir() {
  if (!fs.existsSync(CONFIG_DIR)) {
    fs.mkdirSync(CONFIG_DIR, { recursive: true });
  }
}

function deepMerge<T>(base: T, patch: Partial<T>): T {
  const result: any = Array.isArray(base) ? [...(base as any)] : { ...base };
  for (const key of Object.keys(patch as any)) {
    const patchValue = (patch as any)[key];
    const baseValue = (base as any)[key];
    if (
      patchValue &&
      typeof patchValue === "object" &&
      !Array.isArray(patchValue) &&
      baseValue &&
      typeof baseValue === "object" &&
      !Array.isArray(baseValue)
    ) {
      result[key] = deepMerge(baseValue, patchValue);
    } else if (patchValue !== undefined) {
      result[key] = patchValue;
    }
  }
  return result;
}

/** Reads the local config file, falling back to defaults for anything missing. */
export function readConfig(): AppConfig {
  ensureConfigDir();
  if (!fs.existsSync(CONFIG_PATH)) {
    return { ...DEFAULT_CONFIG };
  }
  try {
    const raw = fs.readFileSync(CONFIG_PATH, "utf-8");
    const parsed = JSON.parse(raw);
    return deepMerge(DEFAULT_CONFIG, parsed);
  } catch (err) {
    console.error("Failed to read config.local.json, falling back to defaults:", err);
    return { ...DEFAULT_CONFIG };
  }
}

/** Merges `patch` into the existing config and writes it back to disk. */
export function writeConfig(patch: Partial<AppConfig>): AppConfig {
  ensureConfigDir();
  const current = readConfig();
  const next = deepMerge(current, patch);
  fs.writeFileSync(CONFIG_PATH, JSON.stringify(next, null, 2), "utf-8");
  return next;
}

/** Returns a copy of the config with secrets redacted, safe to send to the browser. */
export function redactConfig(config: AppConfig) {
  return {
    notion: {
      token: config.notion.token ? "••••••••" : "",
      hasToken: Boolean(config.notion.token),
      studentsDbId: config.notion.studentsDbId,
      purchasesDbId: config.notion.purchasesDbId,
      classRecordsDbId: config.notion.classRecordsDbId,
    },
    google: {
      clientId: config.google.clientId,
      clientSecret: config.google.clientSecret ? "••••••••" : "",
      hasClientSecret: Boolean(config.google.clientSecret),
      redirectUri: config.google.redirectUri,
      connected: Boolean(config.google.tokens?.refresh_token),
    },
    settings: config.settings,
  };
}

export function isNotionConfigured(config: AppConfig): boolean {
  return Boolean(
    config.notion.token &&
      config.notion.studentsDbId &&
      config.notion.purchasesDbId &&
      config.notion.classRecordsDbId
  );
}

export function isGoogleConfigured(config: AppConfig): boolean {
  return Boolean(config.google.clientId && config.google.clientSecret);
}

export function isGoogleConnected(config: AppConfig): boolean {
  return Boolean(config.google.tokens?.refresh_token);
}
