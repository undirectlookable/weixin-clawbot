# 运行示例程序

## 示例程序功能

* 接收用户的指令消息，根据指令向用户发送指定类型的消息
* 接收用户的文字、语音、图片、视频消息，根据不同消息类型做出回应

## 运行示例程序

首先，你应当已经获取到 Weixin Clawbot 的凭据，请参考快速开始。

```bash
# 下载源代码
git clone --depth 1 --branch main \
  https://github.com/undirectlookable/weixin-clawbot.git

# 安装依赖
cd weixin-clawbot
pnpm install
```

```bash
# 通过环境变量注入 ClawBot 凭据以启动示例程序
WEIXIN_CLAWBOT_TOKEN="<YOUR_BOT_TOKEN>" \
WEIXIN_CLAWBOT_USER_ID="<YOUR_BOT_USER_ID>" \
pnpm --dir example start:debug
```

然后，你就可以向你的 ClawBot 发送消息开始交互了。
