# 运行时 API

```ts
import {
  Bot,
  BotContext,
  MessageKind,
  TypingStatus,
  type BotEvents,
  type BotOptions,
  type DownloadFileOptions,
  type DownloadFileToOptions,
  type ReplyInput,
  type ReplyResult,
  type TypingStatusValue,
  type UploadedFileHandle,
  type UploadFileOptions,
} from "weixin-clawbot";
```

## Bot

```ts
class Bot {
  constructor(options?: BotOptions);

  on<K extends keyof BotEvents>(event: K, handler: BotEvents[K]): this;
  off<K extends keyof BotEvents>(event: K, handler: BotEvents[K]): this;
  isRunning(): boolean;
  start(): void;
  end(): void;
  uploadFile(options: UploadFileOptions): Promise<UploadedFileHandle>;
  downloadFile(options: DownloadFileOptions): Promise<Buffer>;
  downloadFileTo(options: DownloadFileToOptions): Promise<void>;
}
```

### new Bot(options?)

```ts
const bot = new Bot({
  token: "<YOUR_BOT_TOKEN>",
  userId: "<YOUR_BOT_USER_ID>",
  baseUrl: "https://ilinkai.weixin.qq.com",
  debug: true,
});
```

常用配置见 [类型定义](/zh/reference/types#botoptions)。

### bot.on(event, handler)

支持的事件：

- `message`
- `error`
- `start`
- `end`

```ts
bot.on("message", async (ctx) => {
  await ctx.reply("hello");
});
```

### bot.off(event, handler)

```ts
const onError = (error: Error) => console.error(error);

bot.on("error", onError);
bot.off("error", onError);
```

### bot.isRunning()

返回当前 bot 是否处于运行状态。

### bot.start()

启动 bot。若存在 `message` 监听器，会开始轮询；否则保持空闲运行。

### bot.end()

停止 bot。若当前有进行中的长轮询，会立即中止。

### bot.uploadFile(options)

只上传文件到 CDN，不发送消息。

```ts
const uploaded = await bot.uploadFile({
  filePath: "/absolute/path/to/report.pdf",
  toUserId: "wxid_xxx",
});
```

返回：

```ts
type UploadedFileHandle = {
  downloadUrl: string;
  encryptQueryParam: string;
  aesKeyHex: string;
  plaintextSize: number;
  ciphertextSize: number;
};
```

### bot.downloadFile(options)

下载并解密文件，返回 `Buffer`。

```ts
const buffer = await bot.downloadFile({
  downloadUrl: uploaded.downloadUrl,
  aesKeyHex: uploaded.aesKeyHex,
});
```

### bot.downloadFileTo(options)

下载并解密文件，直接写入可写流。

```ts
import fs from "node:fs";

await bot.downloadFileTo({
  downloadUrl: uploaded.downloadUrl,
  aesKeyHex: uploaded.aesKeyHex,
  writable: fs.createWriteStream("/tmp/report.pdf"),
});
```

## BotContext

```ts
class BotContext {
  readonly accountId: string;
  readonly token: string | undefined;
  readonly userId: string | undefined;
  readonly baseUrl: string;
  readonly rawMessage: unknown;
  readonly message: BotMessage;
  readonly fromUserId: string;
  readonly contextToken: string | undefined;
  readonly messageKind: BotMessage["kind"];
  readonly cdnBaseUrl: string | undefined;

  reply(input: ReplyInput): Promise<ReplyResult>;
  downloadMedia(): Promise<Buffer>;
  downloadMediaTo(writable: NodeJS.WritableStream): Promise<void>;
  sendTyping(status?: TypingStatusValue): Promise<void>;
}
```

### 常用属性

- `ctx.message`：公开消息对象
- `ctx.rawMessage`：原始协议消息
- `ctx.fromUserId`：发送方用户 ID
- `ctx.contextToken`：当前会话 token
- `ctx.messageKind`：`ctx.message.kind` 的快捷字段

### ctx.reply(input)

```ts
await ctx.reply("hello");
```

```ts
await ctx.reply({
  kind: MessageKind.IMAGE,
  filePath: "/absolute/path/to/image.png",
  text: "sending image",
});
```

### ctx.downloadMedia()

下载当前消息的主媒体，返回解密后的 `Buffer`。

### ctx.downloadMediaTo(writable)

下载当前消息的主媒体，并写入可写流。

### ctx.sendTyping(status?)

```ts
await ctx.sendTyping();
await ctx.sendTyping(TypingStatus.CANCEL);
```
