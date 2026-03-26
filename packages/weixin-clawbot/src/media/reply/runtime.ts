import { CDN_BASE_URL } from "../../core/constants.js";
import { createDebugLogger, type DebugLogger } from "../../core/debug.js";
import { MessageItemType } from "../../protocol/enums.js";
import type { MessageItem } from "../../protocol/message.js";
import type { ReplyInput } from "../../public-types.js";
import { sendMessage as sendMessageApi } from "../../transport/api/bot-api.js";
import type { WeixinApiOptions } from "../../transport/api/client.js";
import { buildBaseMessageItem, makeClientId } from "./builders.js";

export type ReplyRuntime = {
  toUserId: string;
  contextToken?: string | undefined;
  apiOptions: WeixinApiOptions;
  baseUrl: string;
  token?: string | undefined;
  cdnBaseUrl: string;
  debug: DebugLogger;
};

export type SendReplyParams = {
  toUserId: string;
  baseUrl: string;
  token?: string | undefined;
  contextToken?: string | undefined;
  input: ReplyInput;
  cdnBaseUrl?: string | undefined;
  debug?: DebugLogger | undefined;
};

export function createReplyRuntime(params: SendReplyParams): ReplyRuntime {
  return {
    toUserId: params.toUserId,
    contextToken: params.contextToken,
    apiOptions: {
      baseUrl: params.baseUrl,
      token: params.token,
    },
    baseUrl: params.baseUrl,
    token: params.token,
    cdnBaseUrl: params.cdnBaseUrl ?? CDN_BASE_URL,
    debug: params.debug ?? createDebugLogger().child("reply"),
  };
}

export async function sendReplyItem(params: {
  toUserId: string;
  contextToken?: string | undefined;
  item: MessageItem;
  apiOptions: WeixinApiOptions;
  debug?: DebugLogger | undefined;
}): Promise<string> {
  const clientId = makeClientId();
  params.debug?.log("message.send", {
    toUserId: params.toUserId,
    itemType: params.item.type,
    clientId,
    contextTokenPresent: Boolean(params.contextToken),
  });
  await sendMessageApi({
    ...params.apiOptions,
    debug: params.debug?.child("api"),
    body: buildBaseMessageItem({
      toUserId: params.toUserId,
      contextToken: params.contextToken,
      clientId,
      item: params.item,
    }),
  });
  params.debug?.log("message.sent", {
    toUserId: params.toUserId,
    itemType: params.item.type,
    clientId,
  });
  return clientId;
}

export async function sendOptionalPreludeText(
  runtime: ReplyRuntime,
  text: string | undefined,
): Promise<void> {
  if (!text?.trim()) {
    return;
  }

  await sendReplyItem({
    toUserId: runtime.toUserId,
    contextToken: runtime.contextToken,
    apiOptions: runtime.apiOptions,
    debug: runtime.debug.child("prelude"),
    item: {
      type: MessageItemType.TEXT,
      text_item: { text },
    },
  });
}
