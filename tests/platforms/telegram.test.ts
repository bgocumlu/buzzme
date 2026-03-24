import { describe, it, expect, vi, beforeEach, afterAll } from "vitest";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { TelegramPlatform } from "../../src/platforms/telegram.js";

describe("TelegramPlatform.sendMessage", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("calls Telegram API with correct URL and body", async () => {
    const mockFetch = vi.fn().mockResolvedValue({ ok: true });
    vi.stubGlobal("fetch", mockFetch);

    const platform = new TelegramPlatform({ token: "mytoken", chatId: "123" });
    await platform.sendMessage("hello world");

    expect(mockFetch).toHaveBeenCalledWith(
      "https://api.telegram.org/botmytoken/sendMessage",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ chat_id: "123", text: "hello world" }),
      }
    );
  });

  it("sends with disable_notification when silent", async () => {
    const mockFetch = vi.fn().mockResolvedValue({ ok: true });
    vi.stubGlobal("fetch", mockFetch);

    const platform = new TelegramPlatform({ token: "mytoken", chatId: "123" });
    await platform.sendMessage("shh", { silent: true });

    const body = JSON.parse(mockFetch.mock.calls[0][1].body);
    expect(body.disable_notification).toBe(true);
  });

  it("sends with parse_mode when markdown", async () => {
    const mockFetch = vi.fn().mockResolvedValue({ ok: true });
    vi.stubGlobal("fetch", mockFetch);

    const platform = new TelegramPlatform({ token: "mytoken", chatId: "123" });
    await platform.sendMessage("*bold*", { markdown: true });

    const body = JSON.parse(mockFetch.mock.calls[0][1].body);
    expect(body.parse_mode).toBe("Markdown");
  });

  it("omits disable_notification when not silent", async () => {
    const mockFetch = vi.fn().mockResolvedValue({ ok: true });
    vi.stubGlobal("fetch", mockFetch);

    const platform = new TelegramPlatform({ token: "mytoken", chatId: "123" });
    await platform.sendMessage("loud");

    const body = JSON.parse(mockFetch.mock.calls[0][1].body);
    expect(body).not.toHaveProperty("disable_notification");
  });

  it("throws on API error response", async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 401,
      statusText: "Unauthorized",
    });
    vi.stubGlobal("fetch", mockFetch);

    const platform = new TelegramPlatform({ token: "badtoken", chatId: "123" });
    await expect(platform.sendMessage("hi")).rejects.toThrow(
      "Telegram API error: 401 Unauthorized"
    );
  });

  it("throws on network error", async () => {
    const mockFetch = vi.fn().mockRejectedValue(new Error("network error"));
    vi.stubGlobal("fetch", mockFetch);

    const platform = new TelegramPlatform({ token: "tok", chatId: "123" });
    await expect(platform.sendMessage("hi")).rejects.toThrow("network error");
  });
});

describe("TelegramPlatform.sendFile", () => {
  const testDir = path.join(os.tmpdir(), ".buzzme-platform-file-test-" + Date.now());

  beforeEach(() => {
    fs.mkdirSync(testDir, { recursive: true });
    vi.restoreAllMocks();
  });

  afterAll(() => {
    fs.rmSync(testDir, { recursive: true, force: true });
  });

  it("sends image via sendPhoto endpoint", async () => {
    const filePath = path.join(testDir, "test.png");
    fs.writeFileSync(filePath, "fakepng");

    const mockFetch = vi.fn().mockResolvedValue({ ok: true });
    vi.stubGlobal("fetch", mockFetch);

    const platform = new TelegramPlatform({ token: "mytoken", chatId: "123" });
    await platform.sendFile(filePath);

    expect(mockFetch).toHaveBeenCalledWith(
      "https://api.telegram.org/botmytoken/sendPhoto",
      expect.objectContaining({ method: "POST" })
    );
  });

  it("sends non-image via sendDocument endpoint", async () => {
    const filePath = path.join(testDir, "test.log");
    fs.writeFileSync(filePath, "some log content");

    const mockFetch = vi.fn().mockResolvedValue({ ok: true });
    vi.stubGlobal("fetch", mockFetch);

    const platform = new TelegramPlatform({ token: "mytoken", chatId: "123" });
    await platform.sendFile(filePath);

    expect(mockFetch).toHaveBeenCalledWith(
      "https://api.telegram.org/botmytoken/sendDocument",
      expect.objectContaining({ method: "POST" })
    );
  });

  it("throws on API error", async () => {
    const filePath = path.join(testDir, "test.txt");
    fs.writeFileSync(filePath, "content");

    const mockFetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 400,
      statusText: "Bad Request",
    });
    vi.stubGlobal("fetch", mockFetch);

    const platform = new TelegramPlatform({ token: "tok", chatId: "123" });
    await expect(platform.sendFile(filePath)).rejects.toThrow(
      "Telegram API error: 400 Bad Request"
    );
  });
});
