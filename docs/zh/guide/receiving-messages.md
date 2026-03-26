# 接收消息

收到消息时，SDK 会调用 `bot.on("message", handler)`，并传入一个 `BotContext`。

常用字段：

- `ctx.message`：SDK 整理后的公开消息
- `ctx.message.kind`：消息类型
- `ctx.rawMessage`：原始协议消息，类型为 `unknown`
- `ctx.fromUserId`：发送方用户 ID

## 文本消息

```ts
import { MessageKind, TypingStatus } from "weixin-clawbot";

bot.on("message", async (ctx) => {
  if (ctx.message.kind !== MessageKind.TEXT) {
    return;
  }

  await ctx.sendTyping(TypingStatus.TYPING);
  await ctx.reply(`你刚刚发送了：${ctx.message.text}`);
});
```

## 多媒体消息

```ts
switch (ctx.message.kind) {
  case MessageKind.IMAGE:
    console.log(ctx.message.width, ctx.message.height);
    break;
  case MessageKind.VOICE:
    console.log(ctx.message.durationMs, ctx.message.transcript);
    break;
  case MessageKind.FILE:
    console.log(ctx.message.fileName, ctx.message.sizeBytes);
    break;
  case MessageKind.VIDEO:
    console.log(ctx.message.durationMs, ctx.message.sizeBytes);
    break;
}
```

## 下载媒体到内存

`ctx.downloadMedia()` 只处理当前消息的主媒体，并返回解密后的 `Buffer`。

```ts
if (
  ctx.message.kind === MessageKind.IMAGE ||
  ctx.message.kind === MessageKind.VOICE ||
  ctx.message.kind === MessageKind.FILE ||
  ctx.message.kind === MessageKind.VIDEO
) {
  const buffer = await ctx.downloadMedia();
  console.log(buffer.length);
}
```

## 流式写入

```ts
import fs from "node:fs";

if (ctx.message.kind === MessageKind.FILE) {
  await ctx.downloadMediaTo(fs.createWriteStream("/tmp/inbound.bin"));
}
```

## 语音转写

如果服务端已经给出识别文本，可以直接读取 `ctx.message.transcript`：

```ts
if (ctx.message.kind === MessageKind.VOICE) {
  await ctx.reply(`语音转写：${ctx.message.transcript ?? "无"}`);
}
```

## 下一步

- [发送消息](/zh/guide/sending-messages)
- [运行时 API](/zh/reference/api)
