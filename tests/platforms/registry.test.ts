import { describe, it, expect, beforeEach, afterEach } from "vitest";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { createPlatform, getPlatform, getAllConfigured, getDefaultPlatformName } from "../../src/platforms/registry.js";
import { TelegramPlatform } from "../../src/platforms/telegram.js";
import { DiscordPlatform } from "../../src/platforms/discord.js";
import { SlackPlatform } from "../../src/platforms/slack.js";
import { NtfyPlatform } from "../../src/platforms/ntfy.js";

describe("registry", () => {
  const testDir = path.join(os.tmpdir(), ".buzzme-registry-test-" + Date.now());
  let originalEnv: string | undefined;

  beforeEach(() => {
    originalEnv = process.env.BUZZME_CONFIG_DIR;
    process.env.BUZZME_CONFIG_DIR = path.join(testDir, ".buzzme");
    fs.mkdirSync(path.join(testDir, ".buzzme"), { recursive: true });
  });

  afterEach(() => {
    if (originalEnv === undefined) {
      delete process.env.BUZZME_CONFIG_DIR;
    } else {
      process.env.BUZZME_CONFIG_DIR = originalEnv;
    }
    fs.rmSync(testDir, { recursive: true, force: true });
  });

  function writeConfig(config: object): void {
    const configPath = path.join(testDir, ".buzzme", "config.json");
    fs.writeFileSync(configPath, JSON.stringify(config, null, 2) + "\n");
  }

  // createPlatform tests
  it("createPlatform('telegram', config) returns TelegramPlatform", () => {
    const platform = createPlatform("telegram", { token: "tok", chatId: "123" });
    expect(platform).toBeInstanceOf(TelegramPlatform);
    expect(platform.name).toBe("telegram");
  });

  it("createPlatform('discord', config) returns DiscordPlatform", () => {
    const platform = createPlatform("discord", { webhook: "https://discord.com/api/webhooks/abc" });
    expect(platform).toBeInstanceOf(DiscordPlatform);
    expect(platform.name).toBe("discord");
  });

  it("createPlatform('slack', config) returns SlackPlatform", () => {
    const platform = createPlatform("slack", { webhook: "https://hooks.slack.com/services/abc" });
    expect(platform).toBeInstanceOf(SlackPlatform);
    expect(platform.name).toBe("slack");
  });

  it("createPlatform('ntfy', config) returns NtfyPlatform", () => {
    const platform = createPlatform("ntfy", { topic: "my-topic" });
    expect(platform).toBeInstanceOf(NtfyPlatform);
    expect(platform.name).toBe("ntfy");
  });

  it("createPlatform('unknown', config) throws", () => {
    expect(() => createPlatform("unknown", {})).toThrow("Unknown platform: unknown");
  });

  // getPlatform tests
  it("getPlatform('telegram') returns platform when configured", () => {
    writeConfig({
      platforms: {
        telegram: { token: "tok123", chatId: "456" },
      },
    });
    const platform = getPlatform("telegram");
    expect(platform).toBeInstanceOf(TelegramPlatform);
    expect(platform.name).toBe("telegram");
  });

  it("getPlatform('discord') throws with setup instructions when not configured", () => {
    writeConfig({ platforms: {} });
    expect(() => getPlatform("discord")).toThrow(
      "Discord is not configured. Run: buzzme --platform discord --webhook <url>"
    );
  });

  it("getPlatform('telegram') throws with setup instructions when not configured", () => {
    writeConfig({ platforms: {} });
    expect(() => getPlatform("telegram")).toThrow(
      "Telegram is not configured. Run: buzzme --token <token> --chat-id <id>"
    );
  });

  it("getPlatform('slack') throws with setup instructions when not configured", () => {
    writeConfig({ platforms: {} });
    expect(() => getPlatform("slack")).toThrow(
      "Slack is not configured. Run: buzzme --platform slack --webhook <url>"
    );
  });

  it("getPlatform('ntfy') throws with setup instructions when not configured", () => {
    writeConfig({ platforms: {} });
    expect(() => getPlatform("ntfy")).toThrow(
      "Ntfy is not configured. Run: buzzme --platform ntfy --topic <topic>"
    );
  });

  it("getPlatform('unknown') throws for unknown platform", () => {
    writeConfig({ platforms: {} });
    expect(() => getPlatform("unknown")).toThrow("Unknown platform: unknown");
  });

  // getAllConfigured tests
  it("getAllConfigured() returns all configured platforms", () => {
    writeConfig({
      platforms: {
        telegram: { token: "tok", chatId: "123" },
        discord: { webhook: "https://discord.com/api/webhooks/abc" },
        slack: { webhook: "https://hooks.slack.com/services/abc" },
        ntfy: { topic: "my-topic" },
      },
    });
    const platforms = getAllConfigured();
    expect(platforms).toHaveLength(4);
    expect(platforms.some((p) => p instanceof TelegramPlatform)).toBe(true);
    expect(platforms.some((p) => p instanceof DiscordPlatform)).toBe(true);
    expect(platforms.some((p) => p instanceof SlackPlatform)).toBe(true);
    expect(platforms.some((p) => p instanceof NtfyPlatform)).toBe(true);
  });

  it("getAllConfigured() throws when none configured", () => {
    writeConfig({ platforms: {} });
    expect(() => getAllConfigured()).toThrow(/No platforms configured/);
  });

  // getDefaultPlatformName tests
  it("getDefaultPlatformName() returns config.default when set", () => {
    writeConfig({
      default: "discord",
      platforms: {
        telegram: { token: "tok", chatId: "123" },
        discord: { webhook: "https://discord.com/api/webhooks/abc" },
      },
    });
    expect(getDefaultPlatformName()).toBe("discord");
  });

  it("getDefaultPlatformName() falls back to first configured platform", () => {
    writeConfig({
      platforms: {
        telegram: { token: "tok", chatId: "123" },
        discord: { webhook: "https://discord.com/api/webhooks/abc" },
      },
    });
    expect(getDefaultPlatformName()).toBe("telegram");
  });

  it("getDefaultPlatformName() throws when no platforms configured", () => {
    writeConfig({ platforms: {} });
    expect(() => getDefaultPlatformName()).toThrow(/No platforms configured/);
  });
});
