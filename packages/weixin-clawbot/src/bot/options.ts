import {
  DEFAULT_BASE_URL,
  DEFAULT_LONG_POLL_TIMEOUT_MS,
} from "../core/constants.js";
import { loadBotEnvConfig } from "../core/env.js";
import { resolveStateRoot } from "./state-store.js";

export type BotOptions = {
  token?: string | undefined;
  userId?: string | undefined;
  baseUrl?: string | undefined;
  stateRoot?: string | undefined;
  accountId?: string | undefined;
  longPollTimeoutMs?: number | undefined;
  autoRetry?: boolean | undefined;
  cdnBaseUrl?: string | undefined;
  debug?: boolean | undefined;
};

export type ResolvedBotOptions = {
  token?: string | undefined;
  userId?: string | undefined;
  baseUrl: string;
  stateRoot: string;
  accountId: string;
  longPollTimeoutMs: number;
  autoRetry: boolean;
  cdnBaseUrl?: string | undefined;
  debugEnabled: boolean;
};

export function resolveBotOptions(options: BotOptions): ResolvedBotOptions {
  const env = loadBotEnvConfig();
  const token = options.token ?? env.token;
  const userId = options.userId ?? env.userId;

  return {
    token,
    userId,
    baseUrl: options.baseUrl ?? env.baseUrl ?? DEFAULT_BASE_URL,
    stateRoot: resolveStateRoot(options.stateRoot ?? env.stateRoot),
    accountId: options.accountId ?? userId ?? "default",
    longPollTimeoutMs:
      options.longPollTimeoutMs ?? DEFAULT_LONG_POLL_TIMEOUT_MS,
    autoRetry: options.autoRetry ?? true,
    cdnBaseUrl: options.cdnBaseUrl,
    debugEnabled: options.debug ?? env.debug,
  };
}
