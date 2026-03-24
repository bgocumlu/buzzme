import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { buzzme, discord, telegram, ntfy, slack } from "../src/api.js";

describe("API", () => {
  const testDir = path.join(os.tmpdir(), ".buzzme-api-test-" + Date.now());
  let originalEnv: string | undefined;

  beforeEach(() => {
    originalEnv = process.env.BUZZME_CONFIG_DIR;
    process.env.BUZZME_CONFIG_DIR = path.join(testDir, ".buzzme");
    fs.mkdirSync(path.join(testDir, ".buzzme"), { recursive: true });
    vi.restoreAllMocks();
  });

  afterEach(() => {
    if (originalEnv === undefined) {
      delete process.env.BUZZME_CONFIG_DIR;
    } else {
      process.env.BUZZME_CONFIG_DIR = originalEnv;
    }
    fs.rmSync(testDir, { recursive: true, force: true });
  });

  function setConfig(config: object) {
    const configPath = path.join(testDir, ".buzzme", "config.json");
    fs.writeFileSync(configPath, JSON.stringify(config));
  }

  it("sends a message (via default platform)", async () => {
    setConfig({
      default: "telegram",
      platforms: { telegram: { token: "tok", chatId: "123" } },
    });
    const mockFetch = vi.fn().mockResolvedValue({ ok: true });
    vi.stubGlobal("fetch", mockFetch);

    await buzzme("hello");

    const body = JSON.parse(mockFetch.mock.calls[0][1].body);
    expect(body.text).toBe("hello");
    expect(body.chat_id).toBe("123");
  });

  it("sends with silent option", async () => {
    setConfig({
      default: "telegram",
      platforms: { telegram: { token: "tok", chatId: "123" } },
    });
    const mockFetch = vi.fn().mockResolvedValue({ ok: true });
    vi.stubGlobal("fetch", mockFetch);

    await buzzme("shh", { silent: true });

    const body = JSON.parse(mockFetch.mock.calls[0][1].body);
    expect(body.disable_notification).toBe(true);
  });

  it("sends with markdown option", async () => {
    setConfig({
      default: "telegram",
      platforms: { telegram: { token: "tok", chatId: "123" } },
    });
    const mockFetch = vi.fn().mockResolvedValue({ ok: true });
    vi.stubGlobal("fetch", mockFetch);

    await buzzme("*bold*", { markdown: true });

    const body = JSON.parse(mockFetch.mock.calls[0][1].body);
    expect(body.parse_mode).toBe("Markdown");
  });

  it("prepends timestamp with time option", async () => {
    setConfig({
      default: "telegram",
      platforms: { telegram: { token: "tok", chatId: "123" } },
    });
    const mockFetch = vi.fn().mockResolvedValue({ ok: true });
    vi.stubGlobal("fetch", mockFetch);

    await buzzme("deploy done", { time: true });

    const body = JSON.parse(mockFetch.mock.calls[0][1].body);
    expect(body.text).toMatch(/^\[\d{4}-\d{2}-\d{2} \d{2}:\d{2}\] deploy done$/);
  });

  it("throws when no platforms configured", async () => {
    setConfig({ platforms: {} });
    await expect(buzzme("hello")).rejects.toThrow("No platforms configured");
  });

  it("sends a file", async () => {
    setConfig({
      default: "telegram",
      platforms: { telegram: { token: "tok", chatId: "123" } },
    });
    const filePath = path.join(testDir, "test.txt");
    fs.writeFileSync(filePath, "content");

    const mockFetch = vi.fn().mockResolvedValue({ ok: true });
    vi.stubGlobal("fetch", mockFetch);

    await buzzme.file(filePath);

    expect(mockFetch).toHaveBeenCalledWith(
      expect.stringContaining("sendDocument"),
      expect.objectContaining({ method: "POST" })
    );
  });

  it("sends a file with caption", async () => {
    setConfig({
      default: "telegram",
      platforms: { telegram: { token: "tok", chatId: "123" } },
    });
    const filePath = path.join(testDir, "test.png");
    fs.writeFileSync(filePath, "fakepng");

    const mockFetch = vi.fn().mockResolvedValue({ ok: true });
    vi.stubGlobal("fetch", mockFetch);

    await buzzme.file(filePath, { caption: "screenshot" });

    expect(mockFetch).toHaveBeenCalledWith(
      expect.stringContaining("sendPhoto"),
      expect.objectContaining({ method: "POST" })
    );
  });

  it("sends message with via: 'discord' to discord webhook", async () => {
    setConfig({
      default: "telegram",
      platforms: {
        telegram: { token: "tok", chatId: "123" },
        discord: { webhook: "https://discord.example.com/webhook" },
      },
    });
    const mockFetch = vi.fn().mockResolvedValue({ ok: true });
    vi.stubGlobal("fetch", mockFetch);

    await buzzme("discord message", { via: "discord" });

    expect(mockFetch).toHaveBeenCalledWith(
      "https://discord.example.com/webhook",
      expect.objectContaining({ method: "POST" })
    );
    const body = JSON.parse(mockFetch.mock.calls[0][1].body);
    expect(body.content).toBe("discord message");
  });

  it("sends message with all: true to all configured platforms", async () => {
    setConfig({
      default: "telegram",
      platforms: {
        telegram: { token: "tok", chatId: "123" },
        discord: { webhook: "https://discord.example.com/webhook" },
      },
    });
    const mockFetch = vi.fn().mockResolvedValue({ ok: true });
    vi.stubGlobal("fetch", mockFetch);

    await buzzme("broadcast", { all: true });

    // Should have called fetch twice (once for each platform)
    expect(mockFetch).toHaveBeenCalledTimes(2);
  });

  it("sends file with via option", async () => {
    setConfig({
      default: "telegram",
      platforms: {
        telegram: { token: "tok", chatId: "123" },
        discord: { webhook: "https://discord.example.com/webhook" },
      },
    });
    const filePath = path.join(testDir, "test.txt");
    fs.writeFileSync(filePath, "content");

    const mockFetch = vi.fn().mockResolvedValue({ ok: true });
    vi.stubGlobal("fetch", mockFetch);

    await buzzme.file(filePath, { via: "discord" });

    expect(mockFetch).toHaveBeenCalledWith(
      "https://discord.example.com/webhook",
      expect.objectContaining({ method: "POST" })
    );
  });

  // ============================================================
  // Code-configured platforms (no config file)
  // ============================================================

  it("sends via code-configured discord (no config file)", async () => {
    // No setConfig call — no config file at all
    const mockFetch = vi.fn().mockResolvedValue({ ok: true });
    vi.stubGlobal("fetch", mockFetch);

    const d = discord({ webhook: "https://discord.com/api/webhooks/test" });
    await buzzme("hello from code", { platform: d });

    expect(mockFetch).toHaveBeenCalledWith(
      "https://discord.com/api/webhooks/test",
      expect.objectContaining({ method: "POST" })
    );
    const body = JSON.parse(mockFetch.mock.calls[0][1].body);
    expect(body.content).toBe("hello from code");
  });

  it("sends via code-configured telegram (no config file)", async () => {
    const mockFetch = vi.fn().mockResolvedValue({ ok: true });
    vi.stubGlobal("fetch", mockFetch);

    const t = telegram({ token: "code-token", chatId: "code-chat" });
    await buzzme("code msg", { platform: t });

    expect(mockFetch).toHaveBeenCalledWith(
      "https://api.telegram.org/botcode-token/sendMessage",
      expect.objectContaining({ method: "POST" })
    );
    const body = JSON.parse(mockFetch.mock.calls[0][1].body);
    expect(body.text).toBe("code msg");
    expect(body.chat_id).toBe("code-chat");
  });

  it("sends via code-configured ntfy (no config file)", async () => {
    const mockFetch = vi.fn().mockResolvedValue({ ok: true });
    vi.stubGlobal("fetch", mockFetch);

    const n = ntfy({ topic: "my-topic" });
    await buzzme("ntfy msg", { platform: n });

    expect(mockFetch).toHaveBeenCalledWith(
      "https://ntfy.sh/my-topic",
      expect.objectContaining({ method: "POST", body: "ntfy msg" })
    );
  });

  it("sends file via code-configured platform (no config file)", async () => {
    const filePath = path.join(testDir, "test.txt");
    fs.writeFileSync(filePath, "content");

    const mockFetch = vi.fn().mockResolvedValue({ ok: true });
    vi.stubGlobal("fetch", mockFetch);

    const d = discord({ webhook: "https://discord.com/api/webhooks/test" });
    await buzzme.file(filePath, { platform: d, caption: "my file" });

    expect(mockFetch).toHaveBeenCalledWith(
      "https://discord.com/api/webhooks/test",
      expect.objectContaining({ method: "POST" })
    );
  });

  it("code-configured platform supports timestamp option", async () => {
    const mockFetch = vi.fn().mockResolvedValue({ ok: true });
    vi.stubGlobal("fetch", mockFetch);

    const t = telegram({ token: "tok", chatId: "123" });
    await buzzme("deploy done", { platform: t, time: true });

    const body = JSON.parse(mockFetch.mock.calls[0][1].body);
    expect(body.text).toMatch(/^\[\d{4}-\d{2}-\d{2} \d{2}:\d{2}\] deploy done$/);
  });

  // ============================================================
  // Broadcast and failure handling
  // ============================================================

  it("all: true collects and reports failures", async () => {
    setConfig({
      default: "telegram",
      platforms: {
        telegram: { token: "tok", chatId: "123" },
        discord: { webhook: "https://discord.example.com/webhook" },
      },
    });
    const mockFetch = vi
      .fn()
      .mockResolvedValueOnce({ ok: true }) // telegram succeeds
      .mockResolvedValueOnce({ ok: false, status: 500, statusText: "Server Error" }); // discord fails
    vi.stubGlobal("fetch", mockFetch);

    await expect(buzzme("fail some", { all: true })).rejects.toThrow(
      "Failed to send to 1 platform(s)"
    );
  });
});
