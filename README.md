# buzzme

Send notifications from your terminal. Supports Telegram, Discord, Slack, and ntfy.

```bash
npm i -g buzzme
```

## Quick start (Telegram)

1. Create a bot with [@BotFather](https://t.me/BotFather) and save the token:
   ```bash
   buzzme --token <token>
   ```
2. Message your bot, grab your chat ID from `https://api.telegram.org/bot<TOKEN>/getUpdates`, and save it:
   ```bash
   buzzme --chat-id <id>
   ```
3. Send a message:
   ```bash
   buzzme -m "deploy finished"
   ```

## Usage

```bash
# Send a message
buzzme -m "deploy finished"

# Pipe from stdin
echo "server is down" | buzzme
cat error.log | buzzme

# Run a command and notify with the result
buzzme --run "npm test"

# Send without notification sound
buzzme -m "non-urgent update" --silent

# Prepend timestamp
buzzme -m "deploy done" --time    # [2026-03-23 21:30] deploy done

# Markdown formatting
buzzme -m "*bold* _italic_ \`code\`" --md

# Send a file or image
buzzme -f ./screenshot.png
buzzme -f ./build.log -m "build log attached"

# Combine flags
buzzme --run "npm test" --silent --time
```

## Other platforms

```bash
# Discord
buzzme --platform discord --webhook <url>

# Slack
buzzme --platform slack --webhook <url>

# ntfy
buzzme --platform ntfy --topic <topic>
buzzme --platform ntfy --topic <topic> --server https://my-ntfy.example.com
```

### Sending to a specific platform

```bash
buzzme -m "hello" --via discord
buzzme -m "hello" --all              # sends to every configured platform
buzzme --default discord              # change the default
```

## Options

| Flag | Short | Description |
|------|-------|-------------|
| `--message <text>` | `-m` | Send a message |
| `--file <path>` | `-f` | Send a file or image |
| `--run <command>` | `-r` | Run a command and notify with the result |
| `--silent` | `-s` | Send without notification sound |
| `--time` | | Prepend timestamp to message |
| `--md` | | Parse message as Markdown |
| `--token <token>` | `-t` | Save Telegram bot token |
| `--chat-id <id>` | `-i` | Save Telegram chat ID |
| `--platform <name>` | | Target platform for setup |
| `--webhook <url>` | | Webhook URL (Discord, Slack) |
| `--topic <topic>` | | ntfy topic |
| `--server <url>` | | ntfy server (default: ntfy.sh) |
| `--via <name>` | | Send to a specific platform |
| `--all` | | Send to all configured platforms |
| `--default <name>` | | Set the default platform |
| `--config` | | Show saved config |

## API

```bash
npm i buzzme
```

```typescript
import { buzzme } from "buzzme";

await buzzme("deploy finished");
await buzzme("done", { silent: true, markdown: true, time: true });

// Send a file
await buzzme.file("./screenshot.png");
await buzzme.file("./build.log", { caption: "build log" });

// Send to a specific platform
await buzzme("done", { via: "discord" });
await buzzme("done", { all: true });
```

### Without a config file

Pass a platform instance directly:

```typescript
import { buzzme, discord, telegram, ntfy } from "buzzme";

await buzzme("deploy finished", {
  platform: discord({ webhook: "https://discord.com/api/webhooks/..." })
});

await buzzme("alert", {
  platform: ntfy({ topic: "my-alerts" })
});
```
