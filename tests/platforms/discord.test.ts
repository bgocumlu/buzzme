import { describe, it, expect, vi, beforeEach, afterAll } from "vitest";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { DiscordPlatform } from "../../src/platforms/discord.js";

describe("DiscordPlatform.sendMessage", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("sends correct JSON body to webhook URL", async () => {
    const mockFetch = vi.fn().mockResolvedValue({ ok: true });
    vi.stubGlobal("fetch", mockFetch);

    const platform = new DiscordPlatform({ webhook: "https://discord.com/api/webhooks/123/abc" });
    await platform.sendMessage("hello world");

    expect(mockFetch).toHaveBeenCalledWith(
      "https://discord.com/api/webhooks/123/abc",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content: "hello world" }),
      }
    );
  });

  it("silent flag is a no-op (body has no extra fields)", async () => {
    const mockFetch = vi.fn().mockResolvedValue({ ok: true });
    vi.stubGlobal("fetch", mockFetch);

    const platform = new DiscordPlatform({ webhook: "https://discord.com/api/webhooks/123/abc" });
    await platform.sendMessage("shh", { silent: true });

    const body = JSON.parse(mockFetch.mock.calls[0][1].body);
    expect(body).toEqual({ content: "shh" });
  });

  it("throws on API error response", async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 401,
      statusText: "Unauthorized",
    });
    vi.stubGlobal("fetch", mockFetch);

    const platform = new DiscordPlatform({ webhook: "https://discord.com/api/webhooks/123/abc" });
    await expect(platform.sendMessage("hi")).rejects.toThrow(
      "Discord API error: 401 Unauthorized"
    );
  });
});

describe("DiscordPlatform.sendFile", () => {
  const testDir = path.join(os.tmpdir(), ".buzzme-discord-file-test-" + Date.now());

  beforeEach(() => {
    fs.mkdirSync(testDir, { recursive: true });
    vi.restoreAllMocks();
  });

  afterAll(() => {
    fs.rmSync(testDir, { recursive: true, force: true });
  });

  it("sends multipart form data to webhook URL", async () => {
    const filePath = path.join(testDir, "screenshot.png");
    fs.writeFileSync(filePath, "fakepng");

    const mockFetch = vi.fn().mockResolvedValue({ ok: true });
    vi.stubGlobal("fetch", mockFetch);

    const platform = new DiscordPlatform({ webhook: "https://discord.com/api/webhooks/123/abc" });
    await platform.sendFile(filePath);

    expect(mockFetch).toHaveBeenCalledWith(
      "https://discord.com/api/webhooks/123/abc",
      expect.objectContaining({ method: "POST", body: expect.any(FormData) })
    );
  });

  it("includes payload_json with caption when caption is provided", async () => {
    const filePath = path.join(testDir, "screenshot.png");
    fs.writeFileSync(filePath, "fakepng");

    const mockFetch = vi.fn().mockResolvedValue({ ok: true });
    vi.stubGlobal("fetch", mockFetch);

    const platform = new DiscordPlatform({ webhook: "https://discord.com/api/webhooks/123/abc" });
    await platform.sendFile(filePath, { caption: "my caption" });

    const formData: FormData = mockFetch.mock.calls[0][1].body;
    expect(formData.get("payload_json")).toBe(JSON.stringify({ content: "my caption" }));
    expect(formData.get("files[0]")).not.toBeNull();
  });

  it("does not include payload_json when no caption", async () => {
    const filePath = path.join(testDir, "screenshot.png");
    fs.writeFileSync(filePath, "fakepng");

    const mockFetch = vi.fn().mockResolvedValue({ ok: true });
    vi.stubGlobal("fetch", mockFetch);

    const platform = new DiscordPlatform({ webhook: "https://discord.com/api/webhooks/123/abc" });
    await platform.sendFile(filePath);

    const formData: FormData = mockFetch.mock.calls[0][1].body;
    expect(formData.get("payload_json")).toBeNull();
    expect(formData.get("files[0]")).not.toBeNull();
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

    const platform = new DiscordPlatform({ webhook: "https://discord.com/api/webhooks/123/abc" });
    await expect(platform.sendFile(filePath)).rejects.toThrow(
      "Discord API error: 400 Bad Request"
    );
  });
});
