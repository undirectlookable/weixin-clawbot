export const MessageKind = {
  TEXT: "text",
  IMAGE: "image",
  VOICE: "voice",
  FILE: "file",
  VIDEO: "video",
  UNKNOWN: "unknown",
} as const;

export type MessageKindValue = (typeof MessageKind)[keyof typeof MessageKind];

export const TypingStatus = {
  TYPING: "typing",
  CANCEL: "cancel",
} as const;

export type TypingStatusValue =
  (typeof TypingStatus)[keyof typeof TypingStatus];

export type BotMessageBase = {
  id?: string | undefined;
  fromUserId: string;
  toUserId?: string | undefined;
  createdAtMs?: number | undefined;
  updatedAtMs?: number | undefined;
  contextToken?: string | undefined;
};

export type BotMediaHandle = {
  encryptQueryParam?: string | undefined;
  aesKey?: string | undefined;
  encryptType?: number | undefined;
};

export type TextBotMessage = BotMessageBase & {
  kind: typeof MessageKind.TEXT;
  text: string;
};

export type ImageBotMessage = BotMessageBase & {
  kind: typeof MessageKind.IMAGE;
  media?: BotMediaHandle | undefined;
  thumbnailMedia?: BotMediaHandle | undefined;
  sizeBytes?: number | undefined;
  thumbnailSizeBytes?: number | undefined;
  width?: number | undefined;
  height?: number | undefined;
};

export type VoiceBotMessage = BotMessageBase & {
  kind: typeof MessageKind.VOICE;
  media?: BotMediaHandle | undefined;
  durationMs?: number | undefined;
  transcript?: string | undefined;
};

export type FileBotMessage = BotMessageBase & {
  kind: typeof MessageKind.FILE;
  media?: BotMediaHandle | undefined;
  fileName?: string | undefined;
  sizeBytes?: number | undefined;
};

export type VideoBotMessage = BotMessageBase & {
  kind: typeof MessageKind.VIDEO;
  media?: BotMediaHandle | undefined;
  thumbnailMedia?: BotMediaHandle | undefined;
  durationMs?: number | undefined;
  sizeBytes?: number | undefined;
  thumbnailSizeBytes?: number | undefined;
};

export type UnknownBotMessage = BotMessageBase & {
  kind: typeof MessageKind.UNKNOWN;
};

export type BotMessage =
  | TextBotMessage
  | ImageBotMessage
  | VoiceBotMessage
  | FileBotMessage
  | VideoBotMessage
  | UnknownBotMessage;

export type ReplyTextInput = {
  kind: typeof MessageKind.TEXT;
  text: string;
};

export type ReplyImageInput = {
  kind: typeof MessageKind.IMAGE;
  filePath: string;
  text?: string | undefined;
  thumbnailPath?: string | undefined;
};

export type ReplyVoiceInput = {
  kind: typeof MessageKind.VOICE;
  filePath: string;
  text?: string | undefined;
};

export type ReplyFileInput = {
  kind: typeof MessageKind.FILE;
  filePath: string;
  fileName?: string | undefined;
  text?: string | undefined;
};

export type ReplyVideoInput = {
  kind: typeof MessageKind.VIDEO;
  filePath: string;
  text?: string | undefined;
  thumbnailPath?: string | undefined;
};

export type ReplyInput =
  | string
  | ReplyTextInput
  | ReplyImageInput
  | ReplyVoiceInput
  | ReplyFileInput
  | ReplyVideoInput;

export type ReplyResult = {
  messageId: string;
};

export type UploadFileOptions = {
  filePath: string;
  toUserId: string;
};

export type UploadedFileHandle = {
  downloadUrl: string;
  encryptQueryParam: string;
  aesKeyHex: string;
  plaintextSize: number;
  ciphertextSize: number;
};

export type DownloadFileOptions = {
  downloadUrl: string;
  aesKeyHex: string;
};

export type DownloadFileToOptions = DownloadFileOptions & {
  writable: NodeJS.WritableStream;
};
