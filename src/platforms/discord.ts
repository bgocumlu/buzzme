import fs from "node:fs";
import path from "node:path";
import type { Platform, SendOptions, DiscordConfig } from "./platform.js";

export class DiscordPlatform implements Platform {
  name = "discord";
  private webhook: string;

  constructor(config: DiscordConfig) {
    this.webhook = config.webhook;
  }

  async sendMessage(text: string, options?: SendOptions): Promise<void> {
    const response = await fetch(this.webhook, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ content: text }),
    });
    if (!response.ok) {
      throw new Error(`Discord API error: ${response.status} ${response.statusText}`);
    }
  }

  async sendFile(filePath: string, options?: SendOptions & { caption?: string }): Promise<void> {
    const fileBuffer = fs.readFileSync(filePath);
    const blob = new Blob([fileBuffer]);
    const formData = new FormData();
    if (options?.caption) {
      formData.append("payload_json", JSON.stringify({ content: options.caption }));
    }
    formData.append("files[0]", blob, path.basename(filePath));
    const response = await fetch(this.webhook, { method: "POST", body: formData });
    if (!response.ok) {
      throw new Error(`Discord API error: ${response.status} ${response.statusText}`);
    }
  }
}
