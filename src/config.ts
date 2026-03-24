import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import type { Config, PlatformConfigs } from "./platforms/platform.js";

export type { Config };

export function getConfigDir(): string {
  return process.env.BUZZME_CONFIG_DIR ?? path.join(os.homedir(), ".buzzme");
}

export function getConfigPath(): string {
  return path.join(getConfigDir(), "config.json");
}

export function loadConfig(): Config {
  try {
    const raw = fs.readFileSync(getConfigPath(), "utf-8");
    const parsed = JSON.parse(raw) as Record<string, unknown>;

    // Detect old flat shape: has token at root level
    if (typeof parsed["token"] === "string") {
      const migrated: Config = {
        default: "telegram",
        platforms: {
          telegram: {
            token: parsed["token"] as string,
            chatId: (parsed["chatId"] as string) ?? "",
          },
        },
      };
      // Overwrite file with migrated config
      fs.mkdirSync(getConfigDir(), { recursive: true });
      fs.writeFileSync(
        getConfigPath(),
        JSON.stringify(migrated, null, 2) + "\n"
      );
      return migrated;
    }

    // New shape: must have platforms
    if (typeof parsed["platforms"] === "object" && parsed["platforms"] !== null) {
      return parsed as unknown as Config;
    }

    return { platforms: {} };
  } catch {
    return { platforms: {} };
  }
}

const REQUIRED_FIELDS: Record<string, string[]> = {
  telegram: ["token", "chatId"],
  discord: ["webhook"],
  slack: ["webhook"],
  ntfy: ["topic"],
};

export function savePlatformConfig(
  name: string,
  config: Record<string, unknown>
): void {
  const required = REQUIRED_FIELDS[name];
  if (required) {
    const missing = required.filter((f) => !config[f]);
    if (missing.length > 0) {
      throw new Error(
        `Missing required fields for ${name}: ${missing.join(", ")}`
      );
    }
  }

  // Apply defaults
  if (name === "ntfy" && !config["server"]) {
    config = { ...config, server: "https://ntfy.sh" };
  }

  const current = loadConfig();
  const updatedPlatforms: PlatformConfigs = {
    ...current.platforms,
    [name]: config,
  };
  const updated: Config = { ...current, platforms: updatedPlatforms };

  const configPath = getConfigPath();
  fs.mkdirSync(getConfigDir(), { recursive: true });
  fs.writeFileSync(configPath, JSON.stringify(updated, null, 2) + "\n");
}

export function setDefault(name: string): void {
  const current = loadConfig();
  const platforms = current.platforms as Record<string, unknown>;
  if (!platforms[name]) {
    throw new Error(
      `Platform "${name}" is not configured. Run: buzzme --platform ${name} to set it up.`
    );
  }
  const updated: Config = { ...current, default: name };
  const configPath = getConfigPath();
  fs.mkdirSync(getConfigDir(), { recursive: true });
  fs.writeFileSync(configPath, JSON.stringify(updated, null, 2) + "\n");
}

function maskValue(value: string): string {
  if (value.length <= 7) {
    return "***";
  }
  return value.slice(0, 4) + "***" + value.slice(-3);
}

export function displayConfig(): string {
  const config = loadConfig();
  const platforms = config.platforms as Record<string, Record<string, unknown>>;
  const platformNames = Object.keys(platforms);

  if (platformNames.length === 0) {
    return "No platforms configured. Run: buzzme --platform <name> to set one up.";
  }

  const lines: string[] = ["Configured platforms:"];
  for (const name of platformNames) {
    const effectiveDefault = config.default ?? platformNames[0];
    const isDefault = effectiveDefault === name;
    lines.push(`  ${name}${isDefault ? " (default)" : ""}`);
    const platformConfig = platforms[name];
    for (const [key, val] of Object.entries(platformConfig)) {
      const strVal = String(val);
      const isSensitive = key === "token" || key === "webhook";
      const display = isSensitive ? maskValue(strVal) : strVal;
      lines.push(`    ${key}: ${display}`);
    }
  }
  return lines.join("\n");
}
