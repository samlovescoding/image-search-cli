#!/usr/bin/env bun
// CLI entry point for image-search
// Handles config management, credential loading, and CLI argument parsing

import { main } from "./index";
import {
  readConfig,
  setConfigValue,
  getConfigValue,
  listConfig,
  getConfigFilePath,
} from "./config";

interface CliArgs {
  apiKey?: string;
  searchEngineId?: string;
  count?: number;
  parallel?: number;
  queries: string[];
  command?: "config" | "open";
  configAction?: "set" | "get" | "list" | "path";
  configArgs: string[];
}

function parseArgs(): CliArgs {
  const args = process.argv.slice(2);
  const result: CliArgs = {
    queries: [],
    configArgs: [],
  };

  // Check if first arg is "config"
  if (args[0] === "config") {
    result.command = "config";
    if (args[1] === "set" || args[1] === "get" || args[1] === "list" || args[1] === "path") {
      result.configAction = args[1];
      result.configArgs = args.slice(2);
    } else {
      result.configAction = "list"; // default config action
    }
    return result;
  }

  // Check if first arg is "open"
  if (args[0] === "open") {
    result.command = "open";
    return result;
  }

  // Parse flags and queries
  for (let i = 0; i < args.length; i++) {
    if (args[i] === "--api-key" && i + 1 < args.length) {
      result.apiKey = args[i + 1];
      i++;
    } else if (args[i] === "--search-engine-id" && i + 1 < args.length) {
      result.searchEngineId = args[i + 1];
      i++;
    } else if (args[i] === "--count" && i + 1 < args.length) {
      result.count = parseInt(args[i + 1], 10);
      i++;
    } else if (args[i] === "--parallel" && i + 1 < args.length) {
      result.parallel = parseInt(args[i + 1], 10);
      i++;
    } else if (!args[i].startsWith("--")) {
      result.queries.push(args[i]);
    }
  }

  return result;
}

async function handleOpenCommand(): Promise<void> {
  const { DOWNLOAD_DIRECTORY } = await import("./index");
  const { resolve } = await import("node:path");
  const { existsSync } = await import("node:fs");

  const searchesPath = resolve(process.cwd(), DOWNLOAD_DIRECTORY);

  if (!existsSync(searchesPath)) {
    console.error(`Error: Searches directory not found at ${searchesPath}`);
    console.error("\nNo searches have been performed yet.");
    console.error("Run a search first: image-search \"your query\"");
    process.exit(1);
  }

  const platform = process.platform;
  let command: string;
  let args: string[];

  if (platform === "darwin") {
    // macOS
    command = "open";
    args = [searchesPath];
  } else if (platform === "win32") {
    // Windows
    command = "explorer";
    args = [searchesPath];
  } else {
    // Linux and others
    command = "xdg-open";
    args = [searchesPath];
  }

  console.log(`Opening searches folder: ${searchesPath}`);

  try {
    const proc = Bun.spawn([command, ...args], {
      stdout: "inherit",
      stderr: "inherit",
    });

    await proc.exited;
  } catch (error) {
    console.error(`Error opening folder: ${error}`);
    console.error(`\nYou can manually open: ${searchesPath}`);
    process.exit(1);
  }
}

async function handleConfigCommand(action: string, args: string[]): Promise<void> {
  switch (action) {
    case "set": {
      if (args.length === 0) {
        console.error("Error: Missing key=value argument");
        console.error("\nUsage:");
        console.error("  image-search config set GOOGLE_API_KEY your_key_here");
        console.error("  image-search config set GOOGLE_SEARCH_ENGINE_ID your_id_here");
        process.exit(1);
      }

      for (const arg of args) {
        const [key, ...valueParts] = arg.split("=");
        const value = valueParts.join("="); // Handle values with = in them

        if (!value) {
          console.error(`Error: Invalid format for "${arg}". Use KEY=VALUE format.`);
          continue;
        }

        try {
          await setConfigValue(key.trim(), value.trim());
          console.log(`Set ${key} successfully`);
        } catch (error) {
          if (error instanceof Error) {
            console.error(`Error: ${error.message}`);
          }
        }
      }
      break;
    }

    case "get": {
      if (args.length === 0) {
        console.error("Error: Missing config key");
        console.error("\nUsage:");
        console.error("  image-search config get GOOGLE_API_KEY");
        process.exit(1);
      }

      const key = args[0];
      const value = await getConfigValue(key);

      if (value) {
        console.log(`${key}=${value}`);
      } else {
        console.log(`${key} is not set`);
      }
      break;
    }

    case "path": {
      console.log(getConfigFilePath());
      break;
    }

    case "list":
    default: {
      await listConfig();
      break;
    }
  }
}

async function loadCredentials(cliArgs: CliArgs): Promise<{
  apiKey: string;
  searchEngineId: string;
}> {
  let apiKey = cliArgs.apiKey;
  let searchEngineId = cliArgs.searchEngineId;

  // Priority 1: CLI flags (already set above if provided)

  // Priority 2: Environment variables (.env file - Bun loads automatically)
  if (!apiKey) {
    apiKey = process.env.GOOGLE_API_KEY;
  }
  if (!searchEngineId) {
    searchEngineId = process.env.GOOGLE_SEARCH_ENGINE_ID;
  }

  // Priority 3: Global config file
  if (!apiKey || !searchEngineId) {
    const config = await readConfig();
    if (!apiKey && config.GOOGLE_API_KEY) {
      apiKey = config.GOOGLE_API_KEY;
    }
    if (!searchEngineId && config.GOOGLE_SEARCH_ENGINE_ID) {
      searchEngineId = config.GOOGLE_SEARCH_ENGINE_ID;
    }
  }

  // Validate we have both credentials
  if (!apiKey || !searchEngineId) {
    console.error("Error: Missing required API credentials\n");
    console.error("You can provide credentials in any of these ways (in order of priority):\n");
    console.error("1. CLI flags:");
    console.error("   image-search --api-key YOUR_KEY --search-engine-id YOUR_ID \"cats\"\n");
    console.error("2. Environment variables in .env file:");
    console.error("   GOOGLE_API_KEY=your_key");
    console.error("   GOOGLE_SEARCH_ENGINE_ID=your_id\n");
    console.error("3. Global config file:");
    console.error("   image-search config set GOOGLE_API_KEY your_key");
    console.error("   image-search config set GOOGLE_SEARCH_ENGINE_ID your_id\n");
    console.error("See README.md for setup instructions");
    process.exit(1);
  }

  return { apiKey, searchEngineId };
}

async function run() {
  const cliArgs = parseArgs();

  // Handle config command
  if (cliArgs.command === "config") {
    await handleConfigCommand(cliArgs.configAction || "list", cliArgs.configArgs);
    return;
  }

  // Handle open command
  if (cliArgs.command === "open") {
    await handleOpenCommand();
    return;
  }

  // Load credentials for search commands
  const { apiKey, searchEngineId } = await loadCredentials(cliArgs);

  // Run main search
  await main(apiKey, searchEngineId);
}

run().catch((error) => {
  console.error("Fatal error:", error);
  process.exit(1);
});
