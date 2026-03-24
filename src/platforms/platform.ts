export interface SendOptions {
  silent?: boolean;
  markdown?: boolean;
}

export interface Platform {
  name: string;
  sendMessage(text: string, options?: SendOptions): Promise<void>;
  sendFile(filePath: string, options?: SendOptions & { caption?: string }): Promise<void>;
}

export interface TelegramConfig {
  token: string;
  chatId: string;
}

export interface DiscordConfig {
  webhook: string;
}

export interface SlackConfig {
  webhook: string;
}

export interface NtfyConfig {
  topic: string;
  server?: string;  // defaults to "https://ntfy.sh"
  token?: string;   // optional, for authenticated ntfy instances
}

export interface PlatformConfigs {
  telegram?: TelegramConfig;
  discord?: DiscordConfig;
  slack?: SlackConfig;
  ntfy?: NtfyConfig;
}

export interface Config {
  default?: string;
  platforms: PlatformConfigs;
}
