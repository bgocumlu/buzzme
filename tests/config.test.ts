import { describe, it, expect, beforeEach, afterEach } from "vitest";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import {
  loadConfig,
  savePlatformConfig,
  setDefault,
  getConfigDir,
  getConfigPath,
  displayConfig,
} from "../src/config.js";

describe("config", () => {
  const testDir = path.join(os.tmpdir(), ".buzzme-test-" + Date.now());
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

  it("returns { platforms: {} } when no file exists", () => {
    fs.rmSync(path.join(testDir, ".buzzme"), { recursive: true, force: true });
    const config = loadConfig();
    expect(config).toEqual({ platforms: {} });
  });

  it("migrates flat config { token, chatId } to nested structure", () => {
    const flat = { token: "mytoken123", chatId: "456789" };
    fs.writeFileSync(getConfigPath(), JSON.stringify(flat, null, 2) + "\n");

    const config = loadConfig();
    expect(config).toEqual({
      default: "telegram",
      platforms: {
        telegram: { token: "mytoken123", chatId: "456789" },
      },
    });
  });

  it("migration overwrites the file with new nested structure", () => {
    const flat = { token: "mytoken123", chatId: "456789" };
    fs.writeFileSync(getConfigPath(), JSON.stringify(flat, null, 2) + "\n");

    // Trigger migration
    loadConfig();

    // Read file directly
    const raw = fs.readFileSync(getConfigPath(), "utf-8");
    const parsed = JSON.parse(raw);
    expect(parsed).toEqual({
      default: "telegram",
      platforms: {
        telegram: { token: "mytoken123", chatId: "456789" },
      },
    });
    expect(parsed).not.toHaveProperty("token");
    expect(parsed).not.toHaveProperty("chatId");
  });

  it("savePlatformConfig saves discord config correctly", () => {
    savePlatformConfig("discord", { webhook: "https://discord.com/api/webhooks/abc" });
    const config = loadConfig();
    expect(config.platforms.discord).toEqual({
      webhook: "https://discord.com/api/webhooks/abc",
    });
  });

  it("savePlatformConfig saves telegram config correctly", () => {
    savePlatformConfig("telegram", { token: "tok123", chatId: "789" });
    const config = loadConfig();
    expect(config.platforms.telegram).toEqual({ token: "tok123", chatId: "789" });
  });

  it("savePlatformConfig throws on missing required fields for telegram", () => {
    expect(() => savePlatformConfig("telegram", {})).toThrow(/Missing required fields/);
  });

  it("savePlatformConfig throws when telegram missing chatId", () => {
    expect(() => savePlatformConfig("telegram", { token: "abc" })).toThrow(/chatId/);
  });

  it("savePlatformConfig throws when discord missing webhook", () => {
    expect(() => savePlatformConfig("discord", {})).toThrow(/webhook/);
  });

  it("savePlatformConfig throws when slack missing webhook", () => {
    expect(() => savePlatformConfig("slack", {})).toThrow(/webhook/);
  });

  it("savePlatformConfig throws when ntfy missing topic", () => {
    expect(() => savePlatformConfig("ntfy", {})).toThrow(/topic/);
  });

  it("savePlatformConfig defaults ntfy server to https://ntfy.sh", () => {
    savePlatformConfig("ntfy", { topic: "my-topic" });
    const config = loadConfig();
    expect(config.platforms.ntfy?.server).toBe("https://ntfy.sh");
  });

  it("setDefault works when platform is configured", () => {
    savePlatformConfig("telegram", { token: "tok", chatId: "123" });
    setDefault("telegram");
    const config = loadConfig();
    expect(config.default).toBe("telegram");
  });

  it("setDefault throws when platform is not configured", () => {
    expect(() => setDefault("discord")).toThrow(/not configured/);
  });

  it("displayConfig lists configured platforms with default marked", () => {
    savePlatformConfig("telegram", { token: "abcdefghijk", chatId: "123456" });
    savePlatformConfig("discord", { webhook: "https://discord.com/webhooks/xyzabcdhijk" });
    setDefault("telegram");

    const output = displayConfig();
    expect(output).toContain("telegram (default)");
    expect(output).toContain("discord");
    expect(output).not.toContain("discord (default)");
  });

  it("displayConfig masks sensitive values (token and webhook)", () => {
    savePlatformConfig("telegram", { token: "abcdefghijk", chatId: "123456" });
    const output = displayConfig();
    // token should be masked
    expect(output).not.toContain("abcdefghijk");
    expect(output).toContain("***");
    // chatId should NOT be masked
    expect(output).toContain("123456");
  });

  it("displayConfig shows first4***last3 pattern for masked values", () => {
    savePlatformConfig("telegram", { token: "abcdefghijk", chatId: "123456" });
    const output = displayConfig();
    // abcdefghijk -> abcd***ijk
    expect(output).toContain("abcd***ijk");
  });

  it("displayConfig shows helpful message when no platforms configured", () => {
    const output = displayConfig();
    expect(output).toContain("No platforms configured");
    expect(output).toContain("buzzme --platform");
  });
});
