import { Command } from "commander";
import { execSync } from "node:child_process";
import fs from "node:fs";
import { loadConfig, savePlatformConfig, setDefault, displayConfig, getConfigDir, getConfigPath } from "./config.js";
import { getPlatform, getAllConfigured, getDefaultPlatformName } from "./platforms/registry.js";
import { timestamp } from "./util.js";
import type { Platform } from "./platforms/platform.js";

async function readStdin(): Promise<string | null> {
  if (process.stdin.isTTY) return null;

  const chunks: Buffer[] = [];
  for await (const chunk of process.stdin) {
    chunks.push(chunk as Buffer);
  }
  const text = Buffer.concat(chunks).toString().trim();
  return text || null;
}

/** Maps platform names to their valid setup flags */
const PLATFORM_SETUP_FLAGS: Record<string, string[]> = {
  telegram: ["token", "chatId"],
  discord: ["webhook"],
  slack: ["webhook"],
  ntfy: ["topic", "server"],
};

/** Maps flag names to their CLI form */
const FLAG_DISPLAY: Record<string, string> = {
  token: "--token",
  chatId: "--chat-id",
  webhook: "--webhook",
  topic: "--topic",
  server: "--server",
};

/** Platform setup instructions */
const PLATFORM_SETUP_HELP: Record<string, string> = {
  telegram: "buzzme --token <token> --chat-id <id>",
  discord: "buzzme --platform discord --webhook <url>",
  slack: "buzzme --platform slack --webhook <url>",
  ntfy: "buzzme --platform ntfy --topic <topic>",
};

export function createCli(): Command {
  const program = new Command();

  program
    .name("buzzme")
    .description("Send notifications to Telegram, Discord, Slack, and ntfy from your terminal")
    .version("1.0.0");

  program
    .option("-t, --token <token>", "save Telegram bot token")
    .option("-i, --chat-id <id>", "save Telegram chat ID")
    .option("-m, --message <text>", "send a message")
    .option("-f, --file <path>", "send a file or image")
    .option("-s, --silent", "send without notification sound")
    .option("-r, --run <command>", "run a command and notify with the result")
    .option("--time", "prepend timestamp to message")
    .option("--md", "parse message as Markdown")
    .option("--config", "show saved config")
    .option("--platform <name>", "specify platform for setup (telegram, discord, slack, ntfy)")
    .option("--via <name>", "send to a specific platform")
    .option("--all", "send to all configured platforms")
    .option("--default <name>", "set the default platform")
    .option("--webhook <url>", "setup: webhook URL (Discord, Slack)")
    .option("--topic <topic>", "setup: ntfy topic")
    .option("--server <url>", "setup: ntfy server (optional)");

  program.action(async (options) => {
    try {
      // Handle --default <name>
      if (options.default) {
        setDefault(options.default);
        console.log(`Default platform set to "${options.default}".`);
        return;
      }

      // Handle --via + --all conflict
      if (options.via && options.all) {
        console.error("Cannot use --via and --all together");
        process.exit(1);
      }

      // Determine if this is a setup operation
      const isSetup = handleSetup(options);
      if (isSetup) {
        // If only setup flags provided, return early
        if (!options.message && !options.run && !options.file && !options.config) {
          return;
        }
      }

      // Show config
      if (options.config) {
        console.log(displayConfig());
        return;
      }

      // Determine message from --run, --message, or stdin
      let message: string | undefined = options.message;

      if (options.run) {
        const cmd: string = options.run;
        try {
          execSync(cmd, { stdio: "inherit" });
          message = `${cmd} exited with code 0`;
        } catch (error: unknown) {
          const code = (error as { status?: number }).status ?? 1;
          message = `${cmd} failed (code ${code})`;
        }
      }

      if (!message && !isSetup) {
        const stdin = await readStdin();
        if (stdin) message = stdin;
      }

      // Prepend timestamp if requested
      if (message && options.time) {
        message = `${timestamp()} ${message}`;
      }

      const sendOpts = {
        silent: options.silent,
        markdown: options.md,
      };

      // Send file if provided
      if (options.file) {
        if (!fs.existsSync(options.file)) {
          console.error(`File not found: ${options.file}`);
          process.exit(1);
        }

        const platforms = resolvePlatforms(options);
        if (options.all) {
          await broadcastFile(platforms, options.file, { ...sendOpts, caption: message });
        } else {
          const platform = platforms[0];
          await platform.sendFile(options.file, { ...sendOpts, caption: message });
          console.log("Sent.");
        }
        return;
      }

      // Send message
      if (message) {
        const platforms = resolvePlatforms(options);
        if (options.all) {
          await broadcastMessage(platforms, message, sendOpts);
        } else {
          const platform = platforms[0];
          await platform.sendMessage(message, sendOpts);
          console.log("Sent.");
        }
        return;
      }

      // No actionable flags — show help
      if (!isSetup) {
        program.help();
      }
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      if (msg.includes("401") || msg.includes("Unauthorized")) {
        console.error(
          "Failed to send message. Check your token is correct.\n" +
          "Run: buzzme --token <new_token> to update it."
        );
      } else {
        console.error(`Failed to send message: ${msg}`);
      }
      process.exit(1);
    }
  });

  return program;
}

/**
 * Handles setup flags (--token, --chat-id, --webhook, --topic, --server, --platform).
 * Returns true if any setup was performed.
 */
function handleSetup(options: Record<string, unknown>): boolean {
  const hasToken = !!options.token;
  const hasChatId = !!options.chatId;
  const hasWebhook = !!options.webhook;
  const hasTopic = !!options.topic;
  const hasServer = !!options.server;
  const hasSetupFlag = hasToken || hasChatId || hasWebhook || hasTopic || hasServer;

  if (!hasSetupFlag) return false;

  // Determine target platform
  const platformName = (options.platform as string) ?? (hasToken || hasChatId ? "telegram" : undefined);

  if (!platformName) {
    console.error("Please specify a platform with --platform <name>");
    process.exit(1);
  }

  const validFlags = PLATFORM_SETUP_FLAGS[platformName];
  if (!validFlags) {
    console.error(`Unknown platform: ${platformName}. Valid platforms: telegram, discord, slack, ntfy`);
    process.exit(1);
  }

  // Validate that setup flags match the platform
  const setupFlagMap: Record<string, boolean> = {
    token: hasToken,
    chatId: hasChatId,
    webhook: hasWebhook,
    topic: hasTopic,
    server: hasServer,
  };

  for (const [flag, isSet] of Object.entries(setupFlagMap)) {
    if (isSet && !validFlags.includes(flag)) {
      const displayName = platformName.charAt(0).toUpperCase() + platformName.slice(1);
      const flagDisplay = FLAG_DISPLAY[flag];
      const help = PLATFORM_SETUP_HELP[platformName];
      console.error(`${displayName} does not use ${flagDisplay}. Run: ${help}`);
      process.exit(1);
    }
  }

  // Build the config for this platform
  if (platformName === "telegram") {
    // Backward compat: partial saves for telegram (token only or chatId only)
    const config = loadConfig();
    const existing = config.platforms.telegram;
    const merged: Record<string, string> = {
      ...(existing?.token ? { token: existing.token } : {}),
      ...(existing?.chatId ? { chatId: existing.chatId } : {}),
    };
    if (hasToken) merged.token = options.token as string;
    if (hasChatId) merged.chatId = options.chatId as string;

    if (merged.token && merged.chatId) {
      savePlatformConfig("telegram", merged);
    } else {
      // Partial save: write directly without validation
      const updated = { ...config, platforms: { ...config.platforms, telegram: merged } };
      fs.mkdirSync(getConfigDir(), { recursive: true });
      fs.writeFileSync(getConfigPath(), JSON.stringify(updated, null, 2) + "\n");
    }
    if (hasToken) console.log("Token saved.");
    if (hasChatId) console.log("Chat ID saved.");
  } else if (platformName === "discord") {
    savePlatformConfig("discord", { webhook: options.webhook as string });
    console.log("Discord webhook saved.");
  } else if (platformName === "slack") {
    savePlatformConfig("slack", { webhook: options.webhook as string });
    console.log("Slack webhook saved.");
  } else if (platformName === "ntfy") {
    const ntfyConfig: Record<string, string> = { topic: options.topic as string };
    if (hasServer) ntfyConfig.server = options.server as string;
    savePlatformConfig("ntfy", ntfyConfig);
    console.log("Ntfy topic saved.");
  }

  return true;
}

/**
 * Resolves which platform(s) to send to based on --via and --all flags.
 */
function resolvePlatforms(options: Record<string, unknown>): Platform[] {
  if (options.all) {
    return getAllConfigured();
  }
  if (options.via) {
    return [getPlatform(options.via as string)];
  }
  return [getPlatform(getDefaultPlatformName())];
}

/**
 * Broadcasts a message to all platforms using Promise.allSettled.
 * Reports failures and exits with code 1 if any failed.
 */
async function broadcastMessage(
  platforms: Platform[],
  message: string,
  options: { silent?: boolean; markdown?: boolean }
): Promise<void> {
  const results = await Promise.allSettled(
    platforms.map((p) => p.sendMessage(message, options))
  );
  reportBroadcastResults(platforms, results);
}

/**
 * Broadcasts a file to all platforms using Promise.allSettled.
 */
async function broadcastFile(
  platforms: Platform[],
  filePath: string,
  options: { silent?: boolean; markdown?: boolean; caption?: string }
): Promise<void> {
  const results = await Promise.allSettled(
    platforms.map((p) => p.sendFile(filePath, options))
  );
  reportBroadcastResults(platforms, results);
}

/**
 * Reports broadcast results — prints success/failure per platform.
 * Exits with code 1 if any failed.
 */
function reportBroadcastResults(
  platforms: Platform[],
  results: PromiseSettledResult<void>[]
): void {
  let hasFailure = false;
  for (let i = 0; i < results.length; i++) {
    const result = results[i];
    const name = platforms[i].name;
    if (result.status === "fulfilled") {
      console.log(`Sent to ${name}.`);
    } else {
      hasFailure = true;
      const msg = result.reason instanceof Error ? result.reason.message : String(result.reason);
      console.error(`Failed to send to ${name}: ${msg}`);
    }
  }
  if (hasFailure) {
    process.exit(1);
  }
}
