import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { createCli } from "../src/cli.js";

describe("CLI integration", () => {
  const testDir = path.join(os.tmpdir(), ".buzzme-cli-test-" + Date.now());
  const configDir = path.join(testDir, ".buzzme");
  const configPath = path.join(configDir, "config.json");
  let originalEnv: string | undefined;

  function writeConfig(config: Record<string, unknown>) {
    fs.writeFileSync(configPath, JSON.stringify(config));
  }

  function writeTelegramConfig() {
    writeConfig({
      default: "telegram",
      platforms: { telegram: { token: "tok", chatId: "123" } },
    });
  }

  function readConfig() {
    return JSON.parse(fs.readFileSync(configPath, "utf-8"));
  }

  beforeEach(() => {
    originalEnv = process.env.BUZZME_CONFIG_DIR;
    process.env.BUZZME_CONFIG_DIR = configDir;
    fs.mkdirSync(configDir, { recursive: true });
    // Prevent stdin reads from hanging in tests (no real pipe)
    Object.defineProperty(process.stdin, "isTTY", { value: true, configurable: true });
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

  // ============================================================
  // Backward-compatible Telegram setup
  // ============================================================

  it("saves token via --token (backward compat)", async () => {
    const consoleSpy = vi.spyOn(console, "log");
    const program = createCli();
    await program.parseAsync(["node", "buzzme", "--token", "abc123"]);

    expect(consoleSpy).toHaveBeenCalledWith("Token saved.");

    const config = readConfig();
    expect(config.platforms.telegram.token).toBe("abc123");
  });

  it("saves chat ID via --chat-id (backward compat)", async () => {
    const consoleSpy = vi.spyOn(console, "log");
    const program = createCli();
    await program.parseAsync(["node", "buzzme", "--chat-id", "999"]);

    expect(consoleSpy).toHaveBeenCalledWith("Chat ID saved.");

    const config = readConfig();
    expect(config.platforms.telegram.chatId).toBe("999");
  });

  it("saves both token and chatId together", async () => {
    const consoleSpy = vi.spyOn(console, "log");
    const program = createCli();
    await program.parseAsync(["node", "buzzme", "--token", "tok123", "--chat-id", "456"]);

    expect(consoleSpy).toHaveBeenCalledWith("Token saved.");
    expect(consoleSpy).toHaveBeenCalledWith("Chat ID saved.");

    const config = readConfig();
    expect(config.platforms.telegram.token).toBe("tok123");
    expect(config.platforms.telegram.chatId).toBe("456");
  });

  // ============================================================
  // Multi-platform setup
  // ============================================================

  it("saves discord webhook via --platform discord --webhook", async () => {
    const consoleSpy = vi.spyOn(console, "log");
    const program = createCli();
    await program.parseAsync(["node", "buzzme", "--platform", "discord", "--webhook", "https://discord.webhook/123"]);

    expect(consoleSpy).toHaveBeenCalledWith("Discord webhook saved.");
    const config = readConfig();
    expect(config.platforms.discord.webhook).toBe("https://discord.webhook/123");
  });

  it("saves slack webhook via --platform slack --webhook", async () => {
    const consoleSpy = vi.spyOn(console, "log");
    const program = createCli();
    await program.parseAsync(["node", "buzzme", "--platform", "slack", "--webhook", "https://hooks.slack.com/xxx"]);

    expect(consoleSpy).toHaveBeenCalledWith("Slack webhook saved.");
    const config = readConfig();
    expect(config.platforms.slack.webhook).toBe("https://hooks.slack.com/xxx");
  });

  it("saves ntfy topic via --platform ntfy --topic", async () => {
    const consoleSpy = vi.spyOn(console, "log");
    const program = createCli();
    await program.parseAsync(["node", "buzzme", "--platform", "ntfy", "--topic", "my-alerts"]);

    expect(consoleSpy).toHaveBeenCalledWith("Ntfy topic saved.");
    const config = readConfig();
    expect(config.platforms.ntfy.topic).toBe("my-alerts");
    // Should have default server
    expect(config.platforms.ntfy.server).toBe("https://ntfy.sh");
  });

  it("saves ntfy topic with custom server via --platform ntfy --topic --server", async () => {
    const consoleSpy = vi.spyOn(console, "log");
    const program = createCli();
    await program.parseAsync([
      "node", "buzzme", "--platform", "ntfy",
      "--topic", "my-alerts", "--server", "https://my-ntfy.example.com",
    ]);

    expect(consoleSpy).toHaveBeenCalledWith("Ntfy topic saved.");
    const config = readConfig();
    expect(config.platforms.ntfy.topic).toBe("my-alerts");
    expect(config.platforms.ntfy.server).toBe("https://my-ntfy.example.com");
  });

  // ============================================================
  // Setup flag validation
  // ============================================================

  it("errors when using --token with --platform discord", async () => {
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    vi.spyOn(process, "exit").mockImplementation(() => { throw new Error("exit"); });

    const program = createCli();
    await expect(
      program.parseAsync(["node", "buzzme", "--platform", "discord", "--token", "x"])
    ).rejects.toThrow("exit");

    expect(errorSpy).toHaveBeenCalledWith(
      expect.stringContaining("Discord does not use --token")
    );
  });

  it("errors when using --webhook with --platform telegram", async () => {
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    vi.spyOn(process, "exit").mockImplementation(() => { throw new Error("exit"); });

    const program = createCli();
    await expect(
      program.parseAsync(["node", "buzzme", "--platform", "telegram", "--webhook", "url"])
    ).rejects.toThrow("exit");

    expect(errorSpy).toHaveBeenCalledWith(
      expect.stringContaining("Telegram does not use --webhook")
    );
  });

  it("errors when using --topic with --platform discord", async () => {
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    vi.spyOn(process, "exit").mockImplementation(() => { throw new Error("exit"); });

    const program = createCli();
    await expect(
      program.parseAsync(["node", "buzzme", "--platform", "discord", "--topic", "x"])
    ).rejects.toThrow("exit");

    expect(errorSpy).toHaveBeenCalledWith(
      expect.stringContaining("Discord does not use --topic")
    );
  });

  // ============================================================
  // --default
  // ============================================================

  it("sets default platform via --default", async () => {
    // Need platform configured first
    writeConfig({
      default: "telegram",
      platforms: {
        telegram: { token: "tok", chatId: "123" },
        discord: { webhook: "https://discord.webhook" },
      },
    });

    const consoleSpy = vi.spyOn(console, "log");
    const program = createCli();
    await program.parseAsync(["node", "buzzme", "--default", "discord"]);

    expect(consoleSpy).toHaveBeenCalledWith('Default platform set to "discord".');
    const config = readConfig();
    expect(config.default).toBe("discord");
  });

  it("errors when setting default to unconfigured platform", async () => {
    writeConfig({ platforms: { telegram: { token: "tok", chatId: "123" } } });

    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    vi.spyOn(process, "exit").mockImplementation(() => { throw new Error("exit"); });

    const program = createCli();
    await expect(
      program.parseAsync(["node", "buzzme", "--default", "discord"])
    ).rejects.toThrow("exit");

    expect(errorSpy).toHaveBeenCalledWith(
      expect.stringContaining('Platform "discord" is not configured')
    );
  });

  // ============================================================
  // --config
  // ============================================================

  it("shows config via --config", async () => {
    writeConfig({
      default: "telegram",
      platforms: { telegram: { token: "123456:ABC-test", chatId: "999" } },
    });

    const consoleSpy = vi.spyOn(console, "log");
    const program = createCli();
    await program.parseAsync(["node", "buzzme", "--config"]);

    expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining("999"));
    expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining("***"));
  });

  // ============================================================
  // Sending messages (default platform / telegram)
  // ============================================================

  it("errors when sending without config", async () => {
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    vi.spyOn(process, "exit").mockImplementation(() => { throw new Error("exit"); });

    const program = createCli();
    await expect(
      program.parseAsync(["node", "buzzme", "-m", "hello"])
    ).rejects.toThrow("exit");

    expect(errorSpy).toHaveBeenCalledWith(
      expect.stringContaining("No platforms configured")
    );
  });

  it("sends message successfully via default platform", async () => {
    writeTelegramConfig();

    const mockFetch = vi.fn().mockResolvedValue({ ok: true });
    vi.stubGlobal("fetch", mockFetch);

    const consoleSpy = vi.spyOn(console, "log");
    const program = createCli();
    await program.parseAsync(["node", "buzzme", "-m", "build done"]);

    expect(consoleSpy).toHaveBeenCalledWith("Sent.");
    expect(mockFetch).toHaveBeenCalledOnce();
  });

  it("sends message with --silent flag", async () => {
    writeTelegramConfig();

    const mockFetch = vi.fn().mockResolvedValue({ ok: true });
    vi.stubGlobal("fetch", mockFetch);

    const consoleSpy = vi.spyOn(console, "log");
    const program = createCli();
    await program.parseAsync(["node", "buzzme", "-m", "shh", "--silent"]);

    expect(consoleSpy).toHaveBeenCalledWith("Sent.");
    expect(mockFetch).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({
        body: expect.stringContaining('"disable_notification":true'),
      })
    );
  });

  it("sends message without disable_notification when not silent", async () => {
    writeTelegramConfig();

    const mockFetch = vi.fn().mockResolvedValue({ ok: true });
    vi.stubGlobal("fetch", mockFetch);

    const program = createCli();
    await program.parseAsync(["node", "buzzme", "-m", "loud"]);

    const body = JSON.parse(mockFetch.mock.calls[0][1].body);
    expect(body).not.toHaveProperty("disable_notification");
  });

  it("sends with Markdown parse_mode via --md", async () => {
    writeTelegramConfig();

    const mockFetch = vi.fn().mockResolvedValue({ ok: true });
    vi.stubGlobal("fetch", mockFetch);

    const program = createCli();
    await program.parseAsync(["node", "buzzme", "-m", "*bold*", "--md"]);

    const body = JSON.parse(mockFetch.mock.calls[0][1].body);
    expect(body.parse_mode).toBe("Markdown");
  });

  it("prepends timestamp with --time flag", async () => {
    writeTelegramConfig();

    const mockFetch = vi.fn().mockResolvedValue({ ok: true });
    vi.stubGlobal("fetch", mockFetch);

    const program = createCli();
    await program.parseAsync(["node", "buzzme", "-m", "deploy done", "--time"]);

    const body = JSON.parse(mockFetch.mock.calls[0][1].body);
    expect(body.text).toMatch(/^\[\d{4}-\d{2}-\d{2} \d{2}:\d{2}\] deploy done$/);
  });

  // ============================================================
  // --run command
  // ============================================================

  it("notifies on successful --run command", async () => {
    writeTelegramConfig();

    const mockFetch = vi.fn().mockResolvedValue({ ok: true });
    vi.stubGlobal("fetch", mockFetch);

    const consoleSpy = vi.spyOn(console, "log");
    const program = createCli();
    await program.parseAsync(["node", "buzzme", "--run", "node -e \"process.exit(0)\""]);

    expect(consoleSpy).toHaveBeenCalledWith("Sent.");
    const body = JSON.parse(mockFetch.mock.calls[0][1].body);
    expect(body.text).toContain("exited with code 0");
  });

  it("notifies on failed --run command", async () => {
    writeTelegramConfig();

    const mockFetch = vi.fn().mockResolvedValue({ ok: true });
    vi.stubGlobal("fetch", mockFetch);

    const consoleSpy = vi.spyOn(console, "log");
    const program = createCli();
    await program.parseAsync(["node", "buzzme", "--run", "node -e \"process.exit(1)\""]);

    expect(consoleSpy).toHaveBeenCalledWith("Sent.");
    const body = JSON.parse(mockFetch.mock.calls[0][1].body);
    expect(body.text).toContain("failed (code 1)");
  });

  // ============================================================
  // --file
  // ============================================================

  it("sends file via --file", async () => {
    writeTelegramConfig();

    const filePath = path.join(testDir, "test.txt");
    fs.writeFileSync(filePath, "file content");

    const mockFetch = vi.fn().mockResolvedValue({ ok: true });
    vi.stubGlobal("fetch", mockFetch);

    const consoleSpy = vi.spyOn(console, "log");
    const program = createCli();
    await program.parseAsync(["node", "buzzme", "-f", filePath]);

    expect(consoleSpy).toHaveBeenCalledWith("Sent.");
    expect(mockFetch).toHaveBeenCalledWith(
      expect.stringContaining("sendDocument"),
      expect.objectContaining({ method: "POST" })
    );
  });

  it("sends file with caption via --file and --message", async () => {
    writeTelegramConfig();

    const filePath = path.join(testDir, "screenshot.png");
    fs.writeFileSync(filePath, "fakepng");

    const mockFetch = vi.fn().mockResolvedValue({ ok: true });
    vi.stubGlobal("fetch", mockFetch);

    const program = createCli();
    await program.parseAsync(["node", "buzzme", "-f", filePath, "-m", "build log"]);

    expect(mockFetch).toHaveBeenCalledWith(
      expect.stringContaining("sendPhoto"),
      expect.objectContaining({ method: "POST" })
    );
  });

  it("errors when file not found", async () => {
    writeTelegramConfig();

    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    vi.spyOn(process, "exit").mockImplementation(() => { throw new Error("exit"); });

    const program = createCli();
    await expect(
      program.parseAsync(["node", "buzzme", "-f", "/nonexistent/file.txt"])
    ).rejects.toThrow("exit");

    expect(errorSpy).toHaveBeenCalledWith(expect.stringContaining("File not found"));
  });

  // ============================================================
  // --via (platform routing)
  // ============================================================

  it("sends message via --via discord", async () => {
    writeConfig({
      default: "telegram",
      platforms: {
        telegram: { token: "tok", chatId: "123" },
        discord: { webhook: "https://discord.com/api/webhooks/123/abc" },
      },
    });

    const mockFetch = vi.fn().mockResolvedValue({ ok: true });
    vi.stubGlobal("fetch", mockFetch);

    const consoleSpy = vi.spyOn(console, "log");
    const program = createCli();
    await program.parseAsync(["node", "buzzme", "-m", "hello discord", "--via", "discord"]);

    expect(consoleSpy).toHaveBeenCalledWith("Sent.");
    expect(mockFetch).toHaveBeenCalledWith(
      "https://discord.com/api/webhooks/123/abc",
      expect.objectContaining({
        method: "POST",
        body: expect.stringContaining("hello discord"),
      })
    );
  });

  it("sends message via --via ntfy", async () => {
    writeConfig({
      default: "telegram",
      platforms: {
        telegram: { token: "tok", chatId: "123" },
        ntfy: { topic: "test-topic", server: "https://ntfy.sh" },
      },
    });

    const mockFetch = vi.fn().mockResolvedValue({ ok: true });
    vi.stubGlobal("fetch", mockFetch);

    const consoleSpy = vi.spyOn(console, "log");
    const program = createCli();
    await program.parseAsync(["node", "buzzme", "-m", "hello ntfy", "--via", "ntfy"]);

    expect(consoleSpy).toHaveBeenCalledWith("Sent.");
    expect(mockFetch).toHaveBeenCalledWith(
      "https://ntfy.sh/test-topic",
      expect.objectContaining({
        method: "POST",
        body: "hello ntfy",
      })
    );
  });

  // ============================================================
  // --all (broadcast)
  // ============================================================

  it("sends to all configured platforms via --all", async () => {
    writeConfig({
      default: "telegram",
      platforms: {
        telegram: { token: "tok", chatId: "123" },
        discord: { webhook: "https://discord.webhook" },
      },
    });

    const mockFetch = vi.fn().mockResolvedValue({ ok: true });
    vi.stubGlobal("fetch", mockFetch);

    const consoleSpy = vi.spyOn(console, "log");
    const program = createCli();
    await program.parseAsync(["node", "buzzme", "-m", "broadcast", "--all"]);

    expect(consoleSpy).toHaveBeenCalledWith("Sent to telegram.");
    expect(consoleSpy).toHaveBeenCalledWith("Sent to discord.");
    expect(mockFetch).toHaveBeenCalledTimes(2);
  });

  it("reports partial failures with --all", async () => {
    writeConfig({
      default: "telegram",
      platforms: {
        telegram: { token: "tok", chatId: "123" },
        discord: { webhook: "https://discord.webhook" },
      },
    });

    const mockFetch = vi.fn()
      .mockResolvedValueOnce({ ok: true })  // telegram succeeds
      .mockResolvedValueOnce({ ok: false, status: 500, statusText: "Internal Server Error" });  // discord fails

    vi.stubGlobal("fetch", mockFetch);

    const consoleSpy = vi.spyOn(console, "log");
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    vi.spyOn(process, "exit").mockImplementation(() => { throw new Error("exit"); });

    const program = createCli();
    await expect(
      program.parseAsync(["node", "buzzme", "-m", "broadcast", "--all"])
    ).rejects.toThrow("exit");

    expect(consoleSpy).toHaveBeenCalledWith("Sent to telegram.");
    expect(errorSpy).toHaveBeenCalledWith(
      expect.stringContaining("Failed to send to discord")
    );
  });

  // ============================================================
  // --via + --all conflict
  // ============================================================

  it("errors when using --via and --all together", async () => {
    writeTelegramConfig();

    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    vi.spyOn(process, "exit").mockImplementation(() => { throw new Error("exit"); });

    const program = createCli();
    await expect(
      program.parseAsync(["node", "buzzme", "-m", "hello", "--via", "discord", "--all"])
    ).rejects.toThrow("exit");

    expect(errorSpy).toHaveBeenCalledWith("Cannot use --via and --all together");
  });

  // ============================================================
  // Version and help
  // ============================================================

  it("shows version 1.0.0 via --version", async () => {
    const stdoutSpy = vi.spyOn(process.stdout, "write").mockImplementation(() => true);
    vi.spyOn(process, "exit").mockImplementation(() => { throw new Error("exit"); });

    const program = createCli();
    await expect(
      program.parseAsync(["node", "buzzme", "--version"])
    ).rejects.toThrow("exit");

    const output = stdoutSpy.mock.calls.map(c => String(c[0])).join("");
    expect(output).toContain("1.0.0");
  });

  it("shows help when no flags provided", async () => {
    const stdoutSpy = vi.spyOn(process.stdout, "write").mockImplementation(() => true);
    vi.spyOn(process, "exit").mockImplementation(() => { throw new Error("exit"); });

    const program = createCli();
    await expect(
      program.parseAsync(["node", "buzzme"])
    ).rejects.toThrow("exit");

    // Commander writes help to stdout
    expect(stdoutSpy).toHaveBeenCalled();
  });
});
