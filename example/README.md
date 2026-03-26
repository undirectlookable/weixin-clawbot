# weixin-clawbot example

A small runnable bot app that uses the local `weixin-clawbot` workspace package.

## What it does

- replies to `/ping`
- echoes `/echo <text>`
- sends a bundled text file for `/file`
- sends a bundled image for `/image`
- sends a bundled video for `/video`
- downloads inbound media to temp files with `ctx.downloadMediaTo(...)`
- replies to inbound image, voice, file, and video messages with their metadata
- includes the recognized transcript when replying to inbound voice messages
- falls back to a friendly help message for anything else

## Setup

1. Install workspace dependencies from the repo root:

```bash
pnpm install
```

2. Copy `example/.env.example` into your shell environment.
3. From the repo root, build the SDK and the example:

```bash
pnpm build
```

4. Start the example app:

```bash
pnpm --dir example start
```

To enable verbose SDK and example-side debug logs:

```bash
pnpm --dir example start:debug
```

You can also enable it with environment variables:

```bash
WEIXIN_CLAWBOT_DEBUG=true EXAMPLE_DEBUG=true pnpm --dir example start
```

State files:

- You can set `WEIXIN_CLAWBOT_STATE_ROOT` to move bot state somewhere else.
- If you do not set it, the SDK stores state in `.weixin-clawbot` under the current working directory.
- If you keep the default behavior, add `.weixin-clawbot/` to your project's `.gitignore`.

## Commands

- `/help`
- `/ping`
- `/echo hello`
- `/file`
- `/image`
- `/video`

## Troubleshooting

- If you see `session expired (errcode -14)`, your bot credentials have expired.
- Run `npx weixin-clawbot -- --auth` again, then refresh `WEIXIN_CLAWBOT_TOKEN`, `WEIXIN_CLAWBOT_USER_ID`, and `WEIXIN_CLAWBOT_BASE_URL` before restarting the example.
- For QR login troubleshooting, run `npx weixin-clawbot -- --auth --debug` to inspect the init flow.
