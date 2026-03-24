import type { Platform, SendOptions, NtfyConfig } from "./platform.js";

export class NtfyPlatform implements Platform {
  name = "ntfy";
  private server: string;
  private topic: string;
  private token?: string;

  constructor(config: NtfyConfig) {
    this.topic = config.topic;
    this.server = config.server ?? "https://ntfy.sh";
    this.token = config.token;
  }

  async sendMessage(text: string, options?: SendOptions): Promise<void> {
    const url = `${this.server}/${this.topic}`;
    const headers: Record<string, string> = {};
    if (options?.silent) headers["Priority"] = "1";
    if (options?.markdown) headers["Markdown"] = "yes";
    if (this.token) headers["Authorization"] = `Bearer ${this.token}`;

    const response = await fetch(url, {
      method: "POST",
      body: text,
      headers,
    });
    if (!response.ok) {
      throw new Error(`Ntfy API error: ${response.status} ${response.statusText}`);
    }
  }

  async sendFile(filePath: string, options?: SendOptions & { caption?: string }): Promise<void> {
    console.warn("Warning: ntfy does not support file uploads. Sending message only.");
    if (options?.caption) {
      await this.sendMessage(options.caption, options);
    }
  }
}
