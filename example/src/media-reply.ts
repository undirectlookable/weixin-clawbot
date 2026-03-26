import {
  type BotContext,
  type FileBotMessage,
  type ImageBotMessage,
  MessageKind,
  type VideoBotMessage,
  type VoiceBotMessage,
} from "weixin-clawbot";

function formatMetadataLine(label: string, value: number | string): string {
  return `${label}: ${value}`;
}

function createImageMetadataReply(
  message: ImageBotMessage,
  sizeBytes: number,
): string {
  const lines = [
    "I received an image.",
    formatMetadataLine("File size", `${sizeBytes} bytes`),
  ];

  if (message.width !== undefined) {
    lines.push(formatMetadataLine("Width", `${message.width}px`));
  }

  if (message.height !== undefined) {
    lines.push(formatMetadataLine("Height", `${message.height}px`));
  }

  return lines.join("\n");
}

function createVoiceMetadataReply(
  message: VoiceBotMessage,
  sizeBytes: number,
): string {
  const lines = [
    "I received a voice message.",
    formatMetadataLine("File size", `${sizeBytes} bytes`),
  ];

  if (message.durationMs !== undefined) {
    lines.push(formatMetadataLine("Duration", `${message.durationMs} ms`));
  }

  if (message.transcript) {
    lines.push("", `Transcript:\n${message.transcript}`);
  }

  return lines.join("\n");
}

function createFileMetadataReply(
  message: FileBotMessage,
  sizeBytes: number,
): string {
  const lines = [
    "I received a file.",
    formatMetadataLine("File size", `${sizeBytes} bytes`),
  ];

  if (message.fileName) {
    lines.push(formatMetadataLine("File name", message.fileName));
  }

  return lines.join("\n");
}

function createVideoMetadataReply(
  message: VideoBotMessage,
  sizeBytes: number,
): string {
  const lines = [
    "I received a video.",
    formatMetadataLine("File size", `${sizeBytes} bytes`),
  ];

  if (message.durationMs !== undefined) {
    lines.push(formatMetadataLine("Duration", `${message.durationMs} ms`));
  }

  return lines.join("\n");
}

export function createIncomingMediaMetadataReply(
  ctx: BotContext,
  sizeBytes: number,
): string | undefined {
  switch (ctx.message.kind) {
    case MessageKind.IMAGE:
      return createImageMetadataReply(ctx.message, sizeBytes);
    case MessageKind.VOICE:
      return createVoiceMetadataReply(ctx.message, sizeBytes);
    case MessageKind.FILE:
      return createFileMetadataReply(ctx.message, sizeBytes);
    case MessageKind.VIDEO:
      return createVideoMetadataReply(ctx.message, sizeBytes);
    case MessageKind.TEXT:
    case MessageKind.UNKNOWN:
      return undefined;
  }
}
