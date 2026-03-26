# 发送消息

`ctx.reply(...)` 支持：

- 直接发送字符串文本
- 发送结构化文本
- 发送图片、语音、文件、视频

下面默认已拿到 `ctx: BotContext`。

## 文本

```ts
await ctx.reply("hello");
```

```ts
import { MessageKind } from "weixin-clawbot";

await ctx.reply({
  kind: MessageKind.TEXT,
  text: "hello",
});
```

## 图片

```ts
await ctx.reply({
  kind: MessageKind.IMAGE,
  filePath: "/absolute/path/to/example.png",
  thumbnailPath: "/absolute/path/to/example-thumb.jpg",
  text: "这是一张图片",
});
```

## 语音

```ts
await ctx.reply({
  kind: MessageKind.VOICE,
  filePath: "/absolute/path/to/example.mp3",
  text: "请收听语音",
});
```

## 文件

```ts
await ctx.reply({
  kind: MessageKind.FILE,
  filePath: "/absolute/path/to/report.pdf",
  fileName: "weekly-report.pdf",
  text: "请查看附件",
});
```

## 视频

```ts
await ctx.reply({
  kind: MessageKind.VIDEO,
  filePath: "/absolute/path/to/example.mp4",
  thumbnailPath: "/absolute/path/to/example-thumb.jpg",
  text: "这是示例视频",
});
```

## 只上传文件

如果你只想上传，不想立刻发消息，可以直接用 `bot.uploadFile(...)`：

```ts
const uploaded = await bot.uploadFile({
  filePath: "/absolute/path/to/report.pdf",
  toUserId: "wxid_xxx",
});

const buffer = await bot.downloadFile({
  downloadUrl: uploaded.downloadUrl,
  aesKeyHex: uploaded.aesKeyHex,
});
```

## 返回值

```ts
const result = await ctx.reply("hello");
console.log(result.messageId);
```

## 注意

- `filePath` 必须是本地真实文件
- `thumbnailPath` 只用于图片和视频
- 文本消息直接传字符串最简单

## 下一步

- [接收消息](/zh/guide/receiving-messages)
- [类型定义](/zh/reference/types)
