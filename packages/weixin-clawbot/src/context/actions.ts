import type { DebugLogger } from "../core/debug.js";
import { sendReply } from "../media/reply/send.js";
import { TypingStatus as ApiTypingStatus } from "../protocol/enums.js";
import {
  MessageKind,
  type ReplyInput,
  type ReplyResult,
  TypingStatus,
  type TypingStatusValue,
} from "../public-types.js";
import {
  getConfig,
  sendTyping as sendTypingApi,
} from "../transport/api/bot-api.js";

type BotContextActionRuntime = {
  baseUrl: string;
  token?: string | undefined;
  fromUserId: string;
  contextToken?: string | undefined;
  cdnBaseUrl?: string | undefined;
  debug: DebugLogger;
};

function toApiTypingStatus(status: TypingStatusValue): number {
  switch (status) {
    case TypingStatus.TYPING:
      return ApiTypingStatus.TYPING;
    case TypingStatus.CANCEL:
      return ApiTypingStatus.CANCEL;
  }
}

export async function sendContextReply(
  runtime: BotContextActionRuntime,
  input: ReplyInput,
): Promise<ReplyResult> {
  const replyDebug = runtime.debug.child("reply");

  replyDebug.log("send", {
    toUserId: runtime.fromUserId,
    kind: typeof input === "string" ? MessageKind.TEXT : input.kind,
    contextTokenPresent: Boolean(runtime.contextToken),
  });

  const result = await sendReply({
    toUserId: runtime.fromUserId,
    baseUrl: runtime.baseUrl,
    token: runtime.token,
    contextToken: runtime.contextToken,
    input,
    cdnBaseUrl: runtime.cdnBaseUrl,
    debug: replyDebug,
  });

  replyDebug.log("sent", {
    toUserId: runtime.fromUserId,
    messageId: result.messageId,
  });

  return result;
}

export async function sendContextTyping(
  runtime: BotContextActionRuntime,
  status: TypingStatusValue = TypingStatus.TYPING,
): Promise<void> {
  const typingDebug = runtime.debug.child("typing");

  typingDebug.log("send", {
    toUserId: runtime.fromUserId,
    status,
    contextTokenPresent: Boolean(runtime.contextToken),
  });

  const config = await getConfig({
    baseUrl: runtime.baseUrl,
    token: runtime.token,
    ilinkUserId: runtime.fromUserId,
    contextToken: runtime.contextToken,
    debug: typingDebug.child("api"),
  });

  typingDebug.log("config.received", {
    ret: config.ret,
    errmsg: config.errmsg,
    hasTypingTicket: Boolean(config.typing_ticket),
  });

  if (config.ret !== 0 || !config.typing_ticket) {
    throw new Error(
      `getConfig failed: ${config.errmsg ?? "missing typing_ticket"}`,
    );
  }

  const response = await sendTypingApi({
    baseUrl: runtime.baseUrl,
    token: runtime.token,
    body: {
      ilink_user_id: runtime.fromUserId,
      typing_ticket: config.typing_ticket,
      status: toApiTypingStatus(status),
    },
    debug: typingDebug.child("api"),
  });

  typingDebug.log("response.received", {
    ret: response.ret,
    errmsg: response.errmsg,
  });

  if (response.ret !== 0) {
    throw new Error(`sendTyping failed: ${response.errmsg ?? "unknown error"}`);
  }

  typingDebug.log("sent", {
    toUserId: runtime.fromUserId,
    status,
  });
}
