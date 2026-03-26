import fs from "node:fs";
import { mkdir, stat } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import { type BotContext, MessageKind } from "weixin-clawbot";

import type { ExampleDebugLogger } from "./debug.js";

export type DownloadedIncomingMedia = {
  outputPath: string;
  sizeBytes: number;
};

const EXAMPLE_MEDIA_DOWNLOAD_ROOT = path.join(
  os.tmpdir(),
  "weixin-clawbot-example-media",
);

function sanitizeFileName(value: string): string {
  return value.replace(/[^a-zA-Z0-9._-]/g, "_");
}

function inferDownloadedFileName(ctx: BotContext): string {
  const safeMessageId = sanitizeFileName(ctx.message.id ?? `${Date.now()}`);

  if (ctx.message.kind === MessageKind.FILE && ctx.message.fileName) {
    return `${safeMessageId}-${sanitizeFileName(path.basename(ctx.message.fileName))}`;
  }

  switch (ctx.message.kind) {
    case MessageKind.IMAGE:
      return `${safeMessageId}-image.bin`;
    case MessageKind.VOICE:
      return `${safeMessageId}-voice.bin`;
    case MessageKind.FILE:
      return `${safeMessageId}-file.bin`;
    case MessageKind.VIDEO:
      return `${safeMessageId}-video.bin`;
    default:
      return `${safeMessageId}-media.bin`;
  }
}

export async function downloadIncomingMediaToTemp(
  ctx: BotContext,
  debug?: ExampleDebugLogger,
): Promise<DownloadedIncomingMedia> {
  await mkdir(EXAMPLE_MEDIA_DOWNLOAD_ROOT, { recursive: true });
  const outputPath = path.join(
    EXAMPLE_MEDIA_DOWNLOAD_ROOT,
    inferDownloadedFileName(ctx),
  );

  debug?.log("message.media_download.start", {
    kind: ctx.message.kind,
    messageId: ctx.message.id,
    outputPath,
  });

  await ctx.downloadMediaTo(fs.createWriteStream(outputPath));
  const outputStat = await stat(outputPath);

  debug?.log("message.media_download.complete", {
    kind: ctx.message.kind,
    messageId: ctx.message.id,
    outputPath,
    sizeBytes: outputStat.size,
  });

  return {
    outputPath,
    sizeBytes: outputStat.size,
  };
}
