// Configuration management for image-search CLI
// Handles reading/writing global config file at ~/.config/image-search/config.json

import { existsSync } from "node:fs";
import { mkdir } from "node:fs/promises";
import { join } from "node:path";
import { homedir } from "node:os";
import { logError } from "./index";

const CONFIG_DIR = join(homedir(), ".config", "image-search");
const CONFIG_FILE = join(CONFIG_DIR, "config.json");

export interface Config {
  GOOGLE_API_KEY?: string;
  GOOGLE_SEARCH_ENGINE_ID?: string;
}

export async function ensureConfigDir(): Promise<void> {
  if (!existsSync(CONFIG_DIR)) {
    await mkdir(CONFIG_DIR, { recursive: true });
  }
}

export async function readConfig(): Promise<Config> {
  if (!existsSync(CONFIG_FILE)) {
    return {};
  }

  try {
    const file = Bun.file(CONFIG_FILE);
    const config = await file.json();
    return config;
  } catch (error) {
    await logError(error as Error, `readConfig - ${CONFIG_FILE}`);
    console.error(`Warning: Could not read config file at ${CONFIG_FILE}`);
    return {};
  }
}

export async function writeConfig(config: Config): Promise<void> {
  await ensureConfigDir();
  await Bun.write(CONFIG_FILE, JSON.stringify(config, null, 2));
}

export async function setConfigValue(key: string, value: string): Promise<void> {
  const config = await readConfig();

  if (key !== "GOOGLE_API_KEY" && key !== "GOOGLE_SEARCH_ENGINE_ID") {
    throw new Error(`Invalid config key: ${key}. Valid keys: GOOGLE_API_KEY, GOOGLE_SEARCH_ENGINE_ID`);
  }

  config[key as keyof Config] = value;
  await writeConfig(config);
}

export async function getConfigValue(key: string): Promise<string | undefined> {
  const config = await readConfig();
  return config[key as keyof Config];
}

export async function listConfig(): Promise<void> {
  const config = await readConfig();

  if (Object.keys(config).length === 0) {
    console.log("No configuration set.");
    console.log(`\nTo set configuration:`);
    console.log(`  image-search config set GOOGLE_API_KEY your_key_here`);
    console.log(`  image-search config set GOOGLE_SEARCH_ENGINE_ID your_id_here`);
    return;
  }

  console.log(`Configuration (${CONFIG_FILE}):\n`);

  for (const [key, value] of Object.entries(config)) {
    if (value) {
      // Mask API keys for security
      const maskedValue = value.length > 8
        ? `${value.slice(0, 4)}...${value.slice(-4)}`
        : "***";
      console.log(`  ${key}: ${maskedValue}`);
    }
  }
}

export function getConfigFilePath(): string {
  return CONFIG_FILE;
}
