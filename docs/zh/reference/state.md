# 状态存储

SDK 会维护少量本地状态，用来恢复轮询进度，并在同一发送方的后续操作中复用上下文信息。

## 存储内容

当前只存两类状态：

- 轮询游标：`getUpdates` 返回的 `get_updates_buf`
- 上下文 token 缓存：`fromUserId -> contextToken` 的映射

## 作用

### 轮询游标

轮询游标用于记录当前 Bot 已处理到哪里。

如果该状态被持久化，下次启动同一个 `accountId` 的 Bot 时，SDK 会先读取上一次保存的游标，再继续轮询。

### 上下文 token 缓存

上下文 token 用于把回复、输入状态等操作绑定到同一会话线程。

SDK 收到带 `context_token` 的消息时，会按发送方用户 ID 缓存最近一次 token。之后如果当前 `BotContext` 没有可直接使用的 token，SDK 会回退到这份缓存。

## 存储路径

路径解析顺序如下：

1. 显式传入 `new Bot({ stateRoot })`
2. 如果 `stateRoot` 是 `undefined`，再读取环境变量 `WEIXIN_CLAWBOT_STATE_ROOT`
3. 只有两者都不存在时，才回退到默认目录 `./.weixin-clawbot`

### 持久化模式

当 `stateRoot` 是非空字符串时，状态会写到该目录下：

```txt
<stateRoot>/
  accounts/
    <accountId>.sync.json
    <accountId>.context-tokens.json
```

其中：

- `<accountId>.sync.json` 保存轮询游标
- `<accountId>.context-tokens.json` 保存上下文 token 缓存

`accountId` 默认取 `userId`，如果没有 `userId`，则回退到 `default`。

文件内容大致如下：

```json
{
  "get_updates_buf": "cursor-123"
}
```

```json
{
  "wxid_user_1": "ctx-123",
  "wxid_user_2": "ctx-456"
}
```

### 非持久化模式

当 `stateRoot` 是空字符串 `""` 时，不会写任何文件，状态只保存在当前进程内存里。

环境变量 `WEIXIN_CLAWBOT_STATE_ROOT` 也是同样的语义：变量存在但值为空时，走内存模式；变量不存在时，才回退默认目录。

## 非持久化的问题

内存模式下，这些状态在当前 Bot 实例存活期间仍然有效，但进程退出后会全部丢失。

具体影响是：

- 当前进程运行期间，轮询游标和上下文 token 仍然可用
- 进程重启后，因为消息轮询位置，可能会重复处理重启前已经收到的消息
- 进程重启后，上下文 token 会丢失，可能无法直接向用户发送消息

如果你希望 Bot 重启后继续沿用之前的本地状态，不要把 `stateRoot` 设为空字符串。
