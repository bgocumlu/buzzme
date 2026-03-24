import { describe, it, expect, vi, beforeEach } from "vitest";
import { SlackPlatform } from "../../src/platforms/slack.js";

describe("SlackPlatform.sendMessage", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("sends plain text body without markdown", async () => {
    const mockFetch = vi.fn().mockResolvedValue({ ok: true });
    vi.stubGlobal("fetch", mockFetch);

    const platform = new SlackPlatform({ webhook: "https://hooks.slack.com/services/abc" });
    await platform.sendMessage("hello world");

    expect(mockFetch).toHaveBeenCalledWith(
      "https://hooks.slack.com/services/abc",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: "hello world" }),
      }
    );
  });

  it("sends mrkdwn block format with markdown option", async () => {
    const mockFetch = vi.fn().mockResolvedValue({ ok: true });
    vi.stubGlobal("fetch", mockFetch);

    const platform = new SlackPlatform({ webhook: "https://hooks.slack.com/services/abc" });
    await platform.sendMessage("*bold text*", { markdown: true });

    const body = JSON.parse(mockFetch.mock.calls[0][1].body);
    expect(body).toEqual({
      blocks: [
        {
          type: "section",
          text: { type: "mrkdwn", text: "*bold text*" },
        },
      ],
    });
  });

  it("silent is a no-op (body is unchanged)", async () => {
    const mockFetch = vi.fn().mockResolvedValue({ ok: true });
    vi.stubGlobal("fetch", mockFetch);

    const platform = new SlackPlatform({ webhook: "https://hooks.slack.com/services/abc" });
    await platform.sendMessage("shh", { silent: true });

    const body = JSON.parse(mockFetch.mock.calls[0][1].body);
    expect(body).toEqual({ text: "shh" });
  });

  it("throws on API error response", async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 403,
      statusText: "Forbidden",
    });
    vi.stubGlobal("fetch", mockFetch);

    const platform = new SlackPlatform({ webhook: "https://hooks.slack.com/services/abc" });
    await expect(platform.sendMessage("hi")).rejects.toThrow(
      "Slack API error: 403 Forbidden"
    );
  });
});

describe("SlackPlatform.sendFile", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("warns about no file upload support", async () => {
    const mockFetch = vi.fn().mockResolvedValue({ ok: true });
    vi.stubGlobal("fetch", mockFetch);
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});

    const platform = new SlackPlatform({ webhook: "https://hooks.slack.com/services/abc" });
    await platform.sendFile("/fake/path/file.txt");

    expect(warnSpy).toHaveBeenCalledWith(
      "Warning: slack does not support file uploads. Sending message only."
    );
  });

  it("sends caption as message when caption is provided", async () => {
    const mockFetch = vi.fn().mockResolvedValue({ ok: true });
    vi.stubGlobal("fetch", mockFetch);
    vi.spyOn(console, "warn").mockImplementation(() => {});

    const platform = new SlackPlatform({ webhook: "https://hooks.slack.com/services/abc" });
    await platform.sendFile("/fake/path/file.txt", { caption: "look at this file" });

    expect(mockFetch).toHaveBeenCalledOnce();
    const body = JSON.parse(mockFetch.mock.calls[0][1].body);
    expect(body).toEqual({ text: "look at this file" });
  });

  it("only warns (no fetch call) when no caption", async () => {
    const mockFetch = vi.fn().mockResolvedValue({ ok: true });
    vi.stubGlobal("fetch", mockFetch);
    vi.spyOn(console, "warn").mockImplementation(() => {});

    const platform = new SlackPlatform({ webhook: "https://hooks.slack.com/services/abc" });
    await platform.sendFile("/fake/path/file.txt");

    expect(mockFetch).not.toHaveBeenCalled();
  });
});
