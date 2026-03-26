import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { BotStateStore } from "../dist/bot/state-store.js";
import { BotContext } from "../dist/context/context.js";
import { MessageItemType } from "../dist/protocol/enums.js";
import { MessageKind } from "../dist/public-types.js";

test("BotContext exposes the raw message separately from the public message view", () => {
  const rawMessage = {
    from_user_id: "user-1",
    context_token: "ctx-123",
    item_list: [
      {
        type: MessageItemType.VOICE,
        voice_item: {
          media: {
            encrypt_query_param: "voice-param",
            aes_key: "voice-key",
            encrypt_type: 1,
          },
          playtime: 2500,
          text: "hello",
        },
      },
    ],
  };

  const ctx = new BotContext({
    accountId: "account-1",
    baseUrl: "https://example.invalid",
    defaultToUserId: "fallback-user",
    message: rawMessage,
  });

  assert.equal(ctx.rawMessage, rawMessage);
  assert.equal(ctx.message.kind, MessageKind.VOICE);
  assert.deepEqual(ctx.message.media, {
    encryptQueryParam: "voice-param",
    aesKey: "voice-key",
    encryptType: 1,
  });
});

test("BotContext.reply keeps each message bound to its own context token", async () => {
  const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), "weixin-context-"));
  const stateStore = new BotStateStore("account-1", tempRoot);
  const originalFetch = globalThis.fetch;
  const sentContextTokens = [];

  stateStore.ensureReady();

  globalThis.fetch = async (input, init) => {
    const url = new URL(typeof input === "string" ? input : input.url);
    assert.equal(url.pathname, "/ilink/bot/sendmessage");

    const body = JSON.parse(String(init?.body));
    sentContextTokens.push(body.msg.context_token);

    return new Response(JSON.stringify({ ret: 0 }), {
      status: 200,
      headers: {
        "Content-Type": "application/json",
      },
    });
  };

  try {
    const firstContext = new BotContext({
      accountId: "account-1",
      token: "token-1",
      baseUrl: "https://example.invalid",
      defaultToUserId: "user-1",
      stateStore,
      message: {
        from_user_id: "user-1",
        context_token: "ctx-1",
        item_list: [
          {
            type: MessageItemType.TEXT,
            text_item: { text: "first" },
          },
        ],
      },
    });

    const secondContext = new BotContext({
      accountId: "account-1",
      token: "token-1",
      baseUrl: "https://example.invalid",
      defaultToUserId: "user-1",
      stateStore,
      message: {
        from_user_id: "user-1",
        context_token: "ctx-2",
        item_list: [
          {
            type: MessageItemType.TEXT,
            text_item: { text: "second" },
          },
        ],
      },
    });

    await firstContext.reply("reply one");
    await secondContext.reply("reply two");

    assert.deepEqual(sentContextTokens, ["ctx-1", "ctx-2"]);
  } finally {
    globalThis.fetch = originalFetch;
    fs.rmSync(tempRoot, { recursive: true, force: true });
  }
});
