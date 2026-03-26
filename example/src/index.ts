import {
  Bot,
  type BotContext,
  type BotMessage,
  MessageKind,
  type TextBotMessage,
  TypingStatus,
} from "weixin-clawbot";

import { handleTextMessage } from "./commands.js";
import { type ExampleConfig, loadExampleConfig } from "./config.js";
import { createExampleDebugLogger, type ExampleDebugLogger } from "./debug.js";
import { downloadIncomingMediaToTemp } from "./media-download.js";
import { createIncomingMediaMetadataReply } from "./media-reply.js";
import { describeIncomingMessage } from "./message-debug.js";

const SESSION_EXPIRED_ERRCODE = -14;
const UNSUPPORTED_MESSAGE_REPLY =
  "This example bot only handles text messages right now. Send /help to see the supported commands.";

function isSessionExpiredError(error: Error): boolean {
  return error.message.includes(`errcode ${SESSION_EXPIRED_ERRCODE}`);
}

const config = loadExampleConfig();
const debug = createExampleDebugLogger({
  enabled: config.debug,
}).child("app");
const bot = new Bot({ debug: config.debug });

debug.log("startup", {
  debug: config.debug,
  argv: process.argv.slice(2),
  assets: config.assets,
});

registerLifecycleHandlers(bot, debug);
registerErrorHandler(bot, debug);
registerMessageHandler(bot, config, debug);

bot.start();

function registerLifecycleHandlers(bot: Bot, debug: ExampleDebugLogger): void {
  bot.on("start", () => {
    debug.log("bot.start");
    console.log("example bot started");
  });

  bot.on("end", () => {
    debug.log("bot.end");
    console.log("example bot stopped");
  });
}

function registerErrorHandler(bot: Bot, debug: ExampleDebugLogger): void {
  bot.on("error", (error) => {
    debug.log("bot.error", { error });

    if (isSessionExpiredError(error)) {
      console.error(
        [
          "example bot session expired.",
          "Re-run `npx weixin-clawbot -- --auth` to refresh your credentials,",
          "then update your `WEIXIN_CLAWBOT_*` environment variables and start the example again.",
        ].join(" "),
      );
      bot.end();
      process.exitCode = 1;
      return;
    }

    console.error("example bot error", error);
  });
}

function registerMessageHandler(
  bot: Bot,
  config: ExampleConfig,
  debug: ExampleDebugLogger,
): void {
  bot.on("message", async (ctx) => {
    await handleIncomingMessage(ctx, config, debug);
  });
}

// Route media first so the example shows download APIs before command handling.
async function handleIncomingMessage(
  ctx: BotContext,
  config: ExampleConfig,
  debug: ExampleDebugLogger,
): Promise<void> {
  debug.log("message.received", describeIncomingMessage(ctx));

  if (isDownloadableMessageKind(ctx.message.kind)) {
    await handleMediaMessage(ctx, debug);
    return;
  }

  if (ctx.message.kind === MessageKind.TEXT) {
    await handleTextCommandMessage(ctx, ctx.message, config, debug);
    return;
  }

  debug.log("message.unsupported", { kind: ctx.message.kind });
  await ctx.reply(UNSUPPORTED_MESSAGE_REPLY);
}

function isDownloadableMessageKind(kind: BotMessage["kind"]): boolean {
  switch (kind) {
    case MessageKind.IMAGE:
    case MessageKind.VOICE:
    case MessageKind.FILE:
    case MessageKind.VIDEO:
      return true;
    case MessageKind.TEXT:
    case MessageKind.UNKNOWN:
      return false;
  }
}

async function handleMediaMessage(
  ctx: BotContext,
  debug: ExampleDebugLogger,
): Promise<void> {
  const downloadedMedia = await downloadIncomingMediaToTemp(ctx, debug);
  debug.log("message.media_downloaded", {
    kind: ctx.message.kind,
    messageId: ctx.message.id,
    outputPath: downloadedMedia.outputPath,
    sizeBytes: downloadedMedia.sizeBytes,
  });

  const metadataReply = createIncomingMediaMetadataReply(
    ctx,
    downloadedMedia.sizeBytes,
  );
  if (metadataReply) {
    await ctx.reply(metadataReply);
  }
}

async function handleTextCommandMessage(
  ctx: BotContext,
  message: TextBotMessage,
  config: ExampleConfig,
  debug: ExampleDebugLogger,
): Promise<void> {
  try {
    debug.log("typing.send", {
      messageId: message.id,
      fromUserId: message.fromUserId,
    });
    await ctx.sendTyping(TypingStatus.TYPING);

    await handleTextMessage(ctx, message, config, debug);
    debug.log("message.handled", {
      messageId: message.id,
      fromUserId: message.fromUserId,
    });
  } catch (error) {
    debug.log("message.failed", {
      messageId: message.id,
      fromUserId: message.fromUserId,
      error,
    });
    throw error;
  }
}
