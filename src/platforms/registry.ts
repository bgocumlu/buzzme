import { loadConfig } from "../config.js";
import type { Platform, TelegramConfig, DiscordConfig, SlackConfig, NtfyConfig } from "./platform.js";
import { TelegramPlatform } from "./telegram.js";
import { DiscordPlatform } from "./discord.js";
import { SlackPlatform } from "./slack.js";
import { NtfyPlatform } from "./ntfy.js";

const SETUP_INSTRUCTIONS: Record<string, string> = {
  telegram: "Telegram is not configured. Run: buzzme --token <token> --chat-id <id>",
  discord: "Discord is not configured. Run: buzzme --platform discord --webhook <url>",
  slack: "Slack is not configured. Run: buzzme --platform slack --webhook <url>",
  ntfy: "Ntfy is not configured. Run: buzzme --platform ntfy --topic <topic>",
};

/**
 * Creates a Platform instance from its name and config.
 * Throws if the platform name is unknown.
 */
export function createPlatform(name: string, config: Record<string, unknown>): Platform {
  switch (name) {
    case "telegram":
      return new TelegramPlatform(config as unknown as TelegramConfig);
    case "discord":
      return new DiscordPlatform(config as unknown as DiscordConfig);
    case "slack":
      return new SlackPlatform(config as unknown as SlackConfig);
    case "ntfy":
      return new NtfyPlatform(config as unknown as NtfyConfig);
    default:
      throw new Error(`Unknown platform: ${name}`);
  }
}

/**
 * Returns the Platform instance for the given name, reading from the config file.
 * Throws with setup instructions if the platform is not configured.
 */
export function getPlatform(name: string): Platform {
  const config = loadConfig();
  const platforms = config.platforms as Record<string, Record<string, unknown>>;

  if (platforms[name]) {
    return createPlatform(name, platforms[name]);
  }

  const instructions = SETUP_INSTRUCTIONS[name];
  if (instructions) {
    throw new Error(instructions);
  }

  throw new Error(`Unknown platform: ${name}`);
}

/**
 * Returns an array of all configured Platform instances.
 * Throws if no platforms are configured.
 */
export function getAllConfigured(): Platform[] {
  const config = loadConfig();
  const platforms = config.platforms as Record<string, Record<string, unknown>>;
  const names = Object.keys(platforms);

  if (names.length === 0) {
    throw new Error("No platforms configured. Run: buzzme --token <token> --chat-id <id>");
  }

  return names.map((name) => createPlatform(name, platforms[name]));
}

/**
 * Returns the default platform name from config.
 * Falls back to the first configured platform if no default is set.
 * Throws if no platforms are configured.
 */
export function getDefaultPlatformName(): string {
  const config = loadConfig();
  const platforms = config.platforms as Record<string, Record<string, unknown>>;
  const names = Object.keys(platforms);

  if (names.length === 0) {
    throw new Error("No platforms configured. Run: buzzme --token <token> --chat-id <id>");
  }

  return config.default ?? names[0];
}
