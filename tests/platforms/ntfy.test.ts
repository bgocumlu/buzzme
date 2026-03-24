import { describe, it, expect, vi, beforeEach } from "vitest";
import { NtfyPlatform } from "../../src/platforms/ntfy.js";

describe("NtfyPlatform.sendMessage", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("POSTs message body to {server}/{topic}", async () => {
    const mockFetch = vi.fn().mockResolvedValue({ ok: true });
    vi.stubGlobal("fetch", mockFetch);

    const platform = new NtfyPlatform({ topic: "mytopic", server: "https://ntfy.example.com" });
    await platform.sendMessage("hello world");

    expect(mockFetch).toHaveBeenCalledWith(
      "https://ntfy.example.com/mytopic",
      expect.objectContaining({
        method: "POST",
        body: "hello world",
      })
    );
  });

  it("defaults server to https://ntfy.sh", async () => {
    const mockFetch = vi.fn().mockResolvedValue({ ok: true });
    vi.stubGlobal("fetch", mockFetch);

    const platform = new NtfyPlatform({ topic: "mytopic" });
    await platform.sendMessage("hello");

    expect(mockFetch).toHaveBeenCalledWith(
      "https://ntfy.sh/mytopic",
      expect.any(Object)
    );
  });

  it("adds Priority: 1 header when silent", async () => {
    const mockFetch = vi.fn().mockResolvedValue({ ok: true });
    vi.stubGlobal("fetch", mockFetch);

    const platform = new NtfyPlatform({ topic: "mytopic" });
    await platform.sendMessage("shh", { silent: true });

    const headers = mockFetch.mock.calls[0][1].headers;
    expect(headers["Priority"]).toBe("1");
  });

  it("adds Markdown: yes header when markdown", async () => {
    const mockFetch = vi.fn().mockResolvedValue({ ok: true });
    vi.stubGlobal("fetch", mockFetch);

    const platform = new NtfyPlatform({ topic: "mytopic" });
    await platform.sendMessage("**bold**", { markdown: true });

    const headers = mockFetch.mock.calls[0][1].headers;
    expect(headers["Markdown"]).toBe("yes");
  });

  it("adds Authorization: Bearer header when token configured", async () => {
    const mockFetch = vi.fn().mockResolvedValue({ ok: true });
    vi.stubGlobal("fetch", mockFetch);

    const platform = new NtfyPlatform({ topic: "mytopic", token: "mytoken123" });
    await platform.sendMessage("hello");

    const headers = mockFetch.mock.calls[0][1].headers;
    expect(headers["Authorization"]).toBe("Bearer mytoken123");
  });

  it("does not add Authorization header when no token", async () => {
    const mockFetch = vi.fn().mockResolvedValue({ ok: true });
    vi.stubGlobal("fetch", mockFetch);

    const platform = new NtfyPlatform({ topic: "mytopic" });
    await platform.sendMessage("hello");

    const headers = mockFetch.mock.calls[0][1].headers;
    expect(headers).not.toHaveProperty("Authorization");
  });

  it("throws on API error response", async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 403,
      statusText: "Forbidden",
    });
    vi.stubGlobal("fetch", mockFetch);

    const platform = new NtfyPlatform({ topic: "mytopic" });
    await expect(platform.sendMessage("hi")).rejects.toThrow(
      "Ntfy API error: 403 Forbidden"
    );
  });
});

describe("NtfyPlatform.sendFile", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("warns about no file upload support", async () => {
    const mockFetch = vi.fn().mockResolvedValue({ ok: true });
    vi.stubGlobal("fetch", mockFetch);
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});

    const platform = new NtfyPlatform({ topic: "mytopic" });
    await platform.sendFile("/fake/path/file.txt");

    expect(warnSpy).toHaveBeenCalledWith(
      "Warning: ntfy does not support file uploads. Sending message only."
    );
  });

  it("sends caption as message when caption is provided", async () => {
    const mockFetch = vi.fn().mockResolvedValue({ ok: true });
    vi.stubGlobal("fetch", mockFetch);
    vi.spyOn(console, "warn").mockImplementation(() => {});

    const platform = new NtfyPlatform({ topic: "mytopic" });
    await platform.sendFile("/fake/path/file.txt", { caption: "look at this file" });

    expect(mockFetch).toHaveBeenCalledOnce();
    expect(mockFetch.mock.calls[0][1].body).toBe("look at this file");
  });

  it("only warns (no fetch call) when no caption", async () => {
    const mockFetch = vi.fn().mockResolvedValue({ ok: true });
    vi.stubGlobal("fetch", mockFetch);
    vi.spyOn(console, "warn").mockImplementation(() => {});

    const platform = new NtfyPlatform({ topic: "mytopic" });
    await platform.sendFile("/fake/path/file.txt");

    expect(mockFetch).not.toHaveBeenCalled();
  });
});
