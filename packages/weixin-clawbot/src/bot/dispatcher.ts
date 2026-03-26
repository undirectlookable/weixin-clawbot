import { BotContext } from "../context/context.js";
import type { DebugLogger } from "../core/debug.js";
import type { WeixinMessage } from "../protocol/message.js";
import type { BotStateStore } from "./state-store.js";

export function createMessageContext(params: {
  accountId: string;
  token?: string | undefined;
  userId?: string | undefined;
  baseUrl: string;
  message: WeixinMessage;
  cdnBaseUrl?: string | undefined;
  stateStore?: BotStateStore | undefined;
  debug?: DebugLogger | undefined;
}): BotContext {
  const fallbackUserId = params.userId ?? "";
  return new BotContext({
    accountId: params.accountId,
    token: params.token,
    userId: params.userId,
    baseUrl: params.baseUrl,
    message: params.message,
    defaultToUserId: params.message.from_user_id ?? fallbackUserId,
    cdnBaseUrl: params.cdnBaseUrl,
    stateStore: params.stateStore,
    debug: params.debug,
  });
}
