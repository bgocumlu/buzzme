import type { Platform, SendOptions, SlackConfig } from "./platform.js";

export class SlackPlatform implements Platform {
  name = "slack";
  private webhook: string;

  constructor(config: SlackConfig) {
    this.webhook = config.webhook;
  }

  async sendMessage(text: string, options?: SendOptions): Promise<void> {
    const body = options?.markdown
      ? {
          blocks: [
            {
              type: "section",
              text: { type: "mrkdwn", text },
            },
          ],
        }
      : { text };

    const response = await fetch(this.webhook, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      throw new Error(`Slack API error: ${response.status} ${response.statusText}`);
    }
  }

  async sendFile(filePath: string, options?: SendOptions & { caption?: string }): Promise<void> {
    console.warn("Warning: slack does not support file uploads. Sending message only.");
    if (options?.caption) {
      await this.sendMessage(options.caption, options);
    }
  }
}
