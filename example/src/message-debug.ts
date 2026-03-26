import { type BotContext, type BotMessage, MessageKind } from "weixin-clawbot";

import type { ExampleDebugFields } from "./debug.js";

function describePublicMessage(message: BotMessage): ExampleDebugFields {
  switch (message.kind) {
    case MessageKind.TEXT:
      return {
        text: message.text,
      };
    case MessageKind.IMAGE:
      return {
        media: message.media,
        thumbnailMedia: message.thumbnailMedia,
        sizeBytes: message.sizeBytes,
        thumbnailSizeBytes: message.thumbnailSizeBytes,
        width: message.width,
        height: message.height,
      };
    case MessageKind.VOICE:
      return {
        media: message.media,
        durationMs: message.durationMs,
        transcript: message.transcript,
      };
    case MessageKind.FILE:
      return {
        media: message.media,
        fileName: message.fileName,
        sizeBytes: message.sizeBytes,
      };
    case MessageKind.VIDEO:
      return {
        media: message.media,
        thumbnailMedia: message.thumbnailMedia,
        durationMs: message.durationMs,
        sizeBytes: message.sizeBytes,
        thumbnailSizeBytes: message.thumbnailSizeBytes,
      };
    case MessageKind.UNKNOWN:
      return {};
  }
}

export function describeIncomingMessage(ctx: BotContext): ExampleDebugFields {
  return {
    kind: ctx.message.kind,
    messageId: ctx.message.id,
    fromUserId: ctx.message.fromUserId,
    toUserId: ctx.message.toUserId,
    createdAtMs: ctx.message.createdAtMs,
    updatedAtMs: ctx.message.updatedAtMs,
    contextTokenPresent: Boolean(ctx.message.contextToken),
    ...describePublicMessage(ctx.message),
    rawMessage: ctx.rawMessage,
  };
}
