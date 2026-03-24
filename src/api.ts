import { getPlatform, getAllConfigured, getDefaultPlatformName, createPlatform } from "./platforms/registry.js";
import type { Platform, SendOptions, TelegramConfig, DiscordConfig, SlackConfig, NtfyConfig } from "./platforms/platform.js";
import { TelegramPlatform } from "./platforms/telegram.js";
import { DiscordPlatform } from "./platforms/discord.js";
import { SlackPlatform } from "./platforms/slack.js";
import { NtfyPlatform } from "./platforms/ntfy.js";
import { timestamp } from "./util.js";

export interface BuzzmeOptions extends SendOptions {
  time?: boolean;
  via?: string;
  all?: boolean;
  platform?: Platform;
}

// Convenience factory functions for code-based configuration
export function telegram(config: TelegramConfig): Platform {
  return new TelegramPlatform(config);
}

export function discord(config: DiscordConfig): Platform {
  return new DiscordPlatform(config);
}

export function slack(config: SlackConfig): Platform {
  return new SlackPlatform(config);
}

export function ntfy(config: NtfyConfig): Platform {
  return new NtfyPlatform(config);
}

async function buzzme(text: string, options?: BuzzmeOptions): Promise<void> {
  const message = options?.time ? `${timestamp()} ${text}` : text;

  if (options?.platform) {
    await options.platform.sendMessage(message, options);
  } else if (options?.via) {
    const platform = getPlatform(options.via);
    await platform.sendMessage(message, options);
  } else if (options?.all) {
    const platforms = getAllConfigured();
    const results = await Promise.allSettled(
      platforms.map((p) => p.sendMessage(message, options))
    );
    const failures = results
      .map((r, i) => ({ r, name: platforms[i].name }))
      .filter(({ r }) => r.status === "rejected") as {
      r: PromiseRejectedResult;
      name: string;
    }[];
    if (failures.length > 0) {
      const msgs = failures.map(({ r, name }) => `${name}: ${r.reason}`).join("; ");
      throw new Error(`Failed to send to ${failures.length} platform(s): ${msgs}`);
    }
  } else {
    const platform = getPlatform(getDefaultPlatformName());
    await platform.sendMessage(message, options);
  }
}

buzzme.file = async function (
  filePath: string,
  options?: BuzzmeOptions & { caption?: string }
): Promise<void> {
  let caption = options?.caption;
  if (caption && options?.time) caption = `${timestamp()} ${caption}`;
  const fileOptions = { ...options, caption };

  if (options?.platform) {
    await options.platform.sendFile(filePath, fileOptions);
  } else if (options?.via) {
    const platform = getPlatform(options.via);
    await platform.sendFile(filePath, fileOptions);
  } else if (options?.all) {
    const platforms = getAllConfigured();
    const results = await Promise.allSettled(
      platforms.map((p) => p.sendFile(filePath, fileOptions))
    );
    const failures = results
      .map((r, i) => ({ r, name: platforms[i].name }))
      .filter(({ r }) => r.status === "rejected") as {
      r: PromiseRejectedResult;
      name: string;
    }[];
    if (failures.length > 0) {
      const msgs = failures.map(({ r, name }) => `${name}: ${r.reason}`).join("; ");
      throw new Error(`Failed to send to ${failures.length} platform(s): ${msgs}`);
    }
  } else {
    const platform = getPlatform(getDefaultPlatformName());
    await platform.sendFile(filePath, fileOptions);
  }
};

export { buzzme, createPlatform };
export type { Platform, TelegramConfig, DiscordConfig, SlackConfig, NtfyConfig };
