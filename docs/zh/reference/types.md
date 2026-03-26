# 类型定义

这一页只列当前包公开导出的核心类型，并简要说明它们的用途。

注意：类型定义以实际代码导出为准。文档可能不会和实现完全同步，这一页只作为阅读和查阅时的参考。

```ts
import {
  MessageKind,
  TypingStatus,
  type BotContext,
  type BotEvents,
  type BotMediaHandle,
  type BotMessage,
  type BotMessageBase,
  type BotOptions,
  type DownloadFileOptions,
  type DownloadFileToOptions,
  type FileBotMessage,
  type ImageBotMessage,
  type MessageKindValue,
  type ReplyFileInput,
  type ReplyImageInput,
  type ReplyInput,
  type ReplyResult,
  type ReplyTextInput,
  type ReplyVideoInput,
  type ReplyVoiceInput,
  type TextBotMessage,
  type TypingStatusValue,
  type UnknownBotMessage,
  type UploadedFileHandle,
  type UploadFileOptions,
  type VideoBotMessage,
  type VoiceBotMessage,
} from "weixin-clawbot";
```

## MessageKind

用于标识公开消息和回复输入的消息类型常量。

```ts
const MessageKind = {
  TEXT: "text",
  IMAGE: "image",
  VOICE: "voice",
  FILE: "file",
  VIDEO: "video",
  UNKNOWN: "unknown",
} as const;
```

`MessageKindValue` 是 `MessageKind` 的值联合类型，适合在需要显式约束消息类型时使用。

```ts
type MessageKindValue =
  | "text"
  | "image"
  | "voice"
  | "file"
  | "video"
  | "unknown";
```

## TypingStatus

用于表示发送“正在输入”相关状态时可用的公开常量。

```ts
const TypingStatus = {
  TYPING: "typing",
  CANCEL: "cancel",
} as const;
```

`TypingStatusValue` 是 `TypingStatus` 的值联合类型。

```ts
type TypingStatusValue = "typing" | "cancel";
```

## BotMediaHandle

表示一段媒体内容的下载句柄，通常出现在图片、语音、文件、视频消息中。

```ts
type BotMediaHandle = {
  encryptQueryParam?: string;
  aesKey?: string;
  encryptType?: number;
};
```

## BotMessageBase

所有公开消息类型共享的基础字段。

```ts
type BotMessageBase = {
  id?: string;
  fromUserId: string;
  toUserId?: string;
  createdAtMs?: number;
  updatedAtMs?: number;
  contextToken?: string;
};
```

## TextBotMessage

表示一条文本消息。

```ts
type TextBotMessage = BotMessageBase & {
  kind: typeof MessageKind.TEXT;
  text: string;
};
```

## ImageBotMessage

表示一条图片消息，包含主图和可选缩略图的媒体句柄与尺寸信息。

```ts
type ImageBotMessage = BotMessageBase & {
  kind: typeof MessageKind.IMAGE;
  media?: BotMediaHandle;
  thumbnailMedia?: BotMediaHandle;
  sizeBytes?: number;
  thumbnailSizeBytes?: number;
  width?: number;
  height?: number;
};
```

## VoiceBotMessage

表示一条语音消息，包含媒体句柄、时长和可选转写文本。

```ts
type VoiceBotMessage = BotMessageBase & {
  kind: typeof MessageKind.VOICE;
  media?: BotMediaHandle;
  durationMs?: number;
  transcript?: string;
};
```

## FileBotMessage

表示一条文件消息，包含文件名、大小和下载句柄。

```ts
type FileBotMessage = BotMessageBase & {
  kind: typeof MessageKind.FILE;
  media?: BotMediaHandle;
  fileName?: string;
  sizeBytes?: number;
};
```

## VideoBotMessage

表示一条视频消息，包含视频本体、缩略图和时长等信息。

```ts
type VideoBotMessage = BotMessageBase & {
  kind: typeof MessageKind.VIDEO;
  media?: BotMediaHandle;
  thumbnailMedia?: BotMediaHandle;
  durationMs?: number;
  sizeBytes?: number;
  thumbnailSizeBytes?: number;
};
```

## UnknownBotMessage

表示当前 SDK 还没有映射成具体公开类型的消息。

```ts
type UnknownBotMessage = BotMessageBase & {
  kind: typeof MessageKind.UNKNOWN;
};
```

## BotMessage

这是对外暴露的统一消息联合类型，`ctx.message` 就是这个类型。

```ts
type BotMessage =
  | TextBotMessage
  | ImageBotMessage
  | VoiceBotMessage
  | FileBotMessage
  | VideoBotMessage
  | UnknownBotMessage;
```

## Reply types

这些类型用于描述 `ctx.reply(...)` 可接受的结构化输入。

```ts
type ReplyTextInput = {
  kind: typeof MessageKind.TEXT;
  text: string;
};

type ReplyImageInput = {
  kind: typeof MessageKind.IMAGE;
  filePath: string;
  text?: string;
  thumbnailPath?: string;
};

type ReplyVoiceInput = {
  kind: typeof MessageKind.VOICE;
  filePath: string;
  text?: string;
};

type ReplyFileInput = {
  kind: typeof MessageKind.FILE;
  filePath: string;
  fileName?: string;
  text?: string;
};

type ReplyVideoInput = {
  kind: typeof MessageKind.VIDEO;
  filePath: string;
  text?: string;
  thumbnailPath?: string;
};
```

## ReplyInput

这是 `ctx.reply(...)` 的完整输入类型，既支持直接传字符串，也支持传结构化对象。

```ts
type ReplyInput =
  | string
  | ReplyTextInput
  | ReplyImageInput
  | ReplyVoiceInput
  | ReplyFileInput
  | ReplyVideoInput;
```

## ReplyResult

表示一次回复发送成功后返回的结果。

```ts
type ReplyResult = {
  messageId: string;
};
```

## UploadFileOptions

用于 `bot.uploadFile(...)`，描述要上传的本地文件和接收方用户。

```ts
type UploadFileOptions = {
  filePath: string;
  toUserId: string;
};
```

## UploadedFileHandle

表示文件上传成功后返回的下载句柄，后续可用于下载或自行保存。

```ts
type UploadedFileHandle = {
  downloadUrl: string;
  encryptQueryParam: string;
  aesKeyHex: string;
  plaintextSize: number;
  ciphertextSize: number;
};
```

## DownloadFileOptions

用于 `bot.downloadFile(...)`，描述下载地址和解密所需的密钥。

```ts
type DownloadFileOptions = {
  downloadUrl: string;
  aesKeyHex: string;
};
```

## DownloadFileToOptions

用于 `bot.downloadFileTo(...)`，在下载并解密后直接写入可写流。

```ts
type DownloadFileToOptions = DownloadFileOptions & {
  writable: NodeJS.WritableStream;
};
```

## BotOptions

用于构造 `new Bot(...)`，控制鉴权、轮询、状态存储和调试行为。

```ts
type BotOptions = {
  token?: string;
  userId?: string;
  baseUrl?: string;
  stateRoot?: string;
  accountId?: string;
  longPollTimeoutMs?: number;
  autoRetry?: boolean;
  cdnBaseUrl?: string;
  debug?: boolean;
};
```

默认行为：

- `baseUrl` 默认是 `https://ilinkai.weixin.qq.com`
- `stateRoot` 在值为 `undefined` 时默认是当前工作目录下的 `.weixin-clawbot`
- `stateRoot` 在值为空字符串时只使用内存，不落盘
- `stateRoot` 的工作方式详见 [状态存储](/zh/reference/state)
- `accountId` 默认取 `userId`，再回退到 `default`
- `longPollTimeoutMs` 默认是 `35000`
- `autoRetry` 默认是 `true`

## BotEvents

这是 `bot.on(...)` 和 `bot.off(...)` 支持的事件集合。

```ts
type BotEvents = {
  message: (ctx: BotContext) => void;
  error: (error: Error) => void;
  start: () => void;
  end: () => void;
};
```
