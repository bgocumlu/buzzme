import fs from "node:fs";
import path from "node:path";
import type { Platform, SendOptions, TelegramConfig } from "./platform.js";

export class TelegramPlatform implements Platform {
  name = "telegram";
  private token: string;
  private chatId: string;

  constructor(config: TelegramConfig) {
    this.token = config.token;
    this.chatId = config.chatId;
  }

  async sendMessage(text: string, options?: SendOptions): Promise<void> {
    const url = `https://api.telegram.org/bot${this.token}/sendMessage`;

    const response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chat_id: this.chatId,
        text,
        ...(options?.silent && { disable_notification: true }),
        ...(options?.markdown && { parse_mode: "Markdown" }),
      }),
    });

    if (!response.ok) {
      throw new Error(`Telegram API error: ${response.status} ${response.statusText}`);
    }
  }

  async sendFile(filePath: string, options?: SendOptions & { caption?: string }): Promise<void> {
    const ext = path.extname(filePath).toLowerCase();
    const isImage = [".jpg", ".jpeg", ".png", ".gif", ".webp"].includes(ext);

    const endpoint = isImage ? "sendPhoto" : "sendDocument";
    const fieldName = isImage ? "photo" : "document";
    const url = `https://api.telegram.org/bot${this.token}/${endpoint}`;

    const fileBuffer = fs.readFileSync(filePath);
    const blob = new Blob([fileBuffer]);

    const formData = new FormData();
    formData.append("chat_id", this.chatId);
    formData.append(fieldName, blob, path.basename(filePath));
    if (options?.caption) formData.append("caption", options.caption);
    if (options?.silent) formData.append("disable_notification", "true");
    if (options?.markdown) formData.append("parse_mode", "Markdown");

    const response = await fetch(url, { method: "POST", body: formData });

    if (!response.ok) {
      throw new Error(`Telegram API error: ${response.status} ${response.statusText}`);
    }
  }
}
