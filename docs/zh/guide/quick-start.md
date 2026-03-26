# 快速开始

## 安装

```bash
npm install --save weixin-clawbot
```

## 获取凭据

有两种方式获取 Bot 凭据，任选其一。

### 全新获取

先用 CLI 获取凭据：

```bash
npx weixin-clawbot -- --auth
```

点击终端打印的链接，使用微信扫码登录后，记录终端输出的以下信息，用于后续 Bot 初始化：

- `token`
- `userId`
- `baseUrl`

### 从 OpenClaw 中获取

如果你的 OpenClaw 已经配置并连通了微信 Channel，你可以复用 OpenClaw 的凭据：

```bash
cat ~/.openclaw/openclaw-weixin/accounts/*-bot.json
```

注意，如果你 OpenClaw 的微信 Channel 持续运行，你向 Bot 发送的消息会被 OpenClaw 和你的应用程序同时收到。

## 初始化 Bot

可以直接在代码里传：

```ts
import { Bot } from "weixin-clawbot";

const bot = new Bot({
  token: "<YOUR_BOT_TOKEN>",
  userId: "<YOUR_BOT_USER_ID>",
  baseUrl: "https://ilinkai.weixin.qq.com", // 可选
});
```

也可以用环境变量：

```bash
WEIXIN_CLAWBOT_TOKEN="<YOUR_BOT_TOKEN>"
WEIXIN_CLAWBOT_USER_ID="<YOUR_BOT_USER_ID>"
WEIXIN_CLAWBOT_BASE_URL="https://ilinkai.weixin.qq.com" # 可选
WEIXIN_CLAWBOT_STATE_ROOT="/absolute/path/to/bot-state" # 可选，详见 ⬇️ 状态目录
```

## 最小示例

```ts
import { Bot, MessageKind } from "weixin-clawbot";

const bot = new Bot();

bot.on("message", async (ctx) => {
  if (ctx.message.kind === MessageKind.TEXT) {
    await ctx.reply(`echo: ${ctx.message.text}`);
  }
});

bot.start();
```

`bot.start()` 之后，只有在存在至少一个 `message` 监听器时才会开始轮询消息。

## 状态目录

SDK 会保存轮询游标和上下文 token。存储内容、路径规则、内存模式的行为，详见 [状态存储](/zh/reference/state)。

如果使用默认目录，建议加入 `.gitignore`：

```txt
.weixin-clawbot/
```

## 下一步

- [接收消息](/zh/guide/receiving-messages)
- [发送消息](/zh/guide/sending-messages)
- [运行时 API](/zh/reference/api)
- [类型定义](/zh/reference/types)
