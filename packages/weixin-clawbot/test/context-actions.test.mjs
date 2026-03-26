import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";

import { BotContext } from "../dist/context/context.js";
import {
  TypingStatus as ApiTypingStatus,
  MessageItemType,
} from "../dist/protocol/enums.js";
import { MessageKind, TypingStatus } from "../dist/public-types.js";

function createJsonResponse(body) {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: {
      "Content-Type": "application/json",
    },
  });
}

async function withFetch(mockFetch, fn) {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = mockFetch;

  try {
    return await fn();
  } finally {
    globalThis.fetch = originalFetch;
  }
}

function createContext(overrides = {}) {
  return new BotContext({
    accountId: "account-1",
    token: "token-1",
    baseUrl: "https://example.invalid",
    defaultToUserId: "fallback-user",
    message: {
      from_user_id: "user-1",
      context_token: "ctx-123",
      item_list: [
        {
          type: MessageItemType.TEXT,
          text_item: {
            text: "hello",
          },
        },
      ],
    },
    ...overrides,
  });
}

test("BotContext.reply sends text messages through sendmessage", async () => {
  const requestBodies = [];
  const ctx = createContext();

  await withFetch(
    async (input, init) => {
      const url = new URL(typeof input === "string" ? input : input.url);
      assert.equal(url.pathname, "/ilink/bot/sendmessage");

      const body = JSON.parse(String(init?.body));
      requestBodies.push(body);

      return createJsonResponse({ ret: 0 });
    },
    async () => {
      const result = await ctx.reply("reply text");
      assert.match(result.messageId, /^\d+-[0-9a-f]{16}$/);
    },
  );

  assert.equal(requestBodies.length, 1);
  assert.equal(requestBodies[0].msg.context_token, "ctx-123");
  assert.equal(requestBodies[0].msg.to_user_id, "user-1");
  assert.deepEqual(requestBodies[0].msg.item_list, [
    {
      type: MessageItemType.TEXT,
      text_item: { text: "reply text" },
    },
  ]);
});

test("BotContext.reply uploads image replies and sends optional prelude text", async () => {
  const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), "weixin-reply-"));
  const imagePath = path.join(tempRoot, "image.png");
  const thumbPath = path.join(tempRoot, "thumb.png");
  const sendBodies = [];
  const uploadParams = [];

  fs.writeFileSync(imagePath, Buffer.from("image-bytes", "utf8"));
  fs.writeFileSync(thumbPath, Buffer.from("thumb-bytes", "utf8"));

  try {
    const ctx = createContext({
      cdnBaseUrl: "https://cdn.example.invalid/c2c",
    });

    await withFetch(
      async (input, init) => {
        const url = new URL(typeof input === "string" ? input : input.url);

        if (url.pathname === "/ilink/bot/sendmessage") {
          sendBodies.push(JSON.parse(String(init?.body)));
          return createJsonResponse({ ret: 0 });
        }

        if (url.pathname === "/ilink/bot/getuploadurl") {
          const body = JSON.parse(String(init?.body));
          assert.equal(body.media_type, 1);
          assert.equal(body.to_user_id, "user-1");
          assert.equal(body.no_need_thumb, false);

          return createJsonResponse({
            upload_param: "upload-param-1",
            thumb_upload_param: "thumb-upload-param-1",
          });
        }

        assert.equal(url.pathname, "/c2c/upload");
        uploadParams.push(url.searchParams.get("encrypted_query_param"));

        return new Response(null, {
          status: 200,
          headers: {
            "x-encrypted-param":
              url.searchParams.get("encrypted_query_param") === "upload-param-1"
                ? "download-param-1"
                : "thumb-download-param-1",
          },
        });
      },
      async () => {
        const result = await ctx.reply({
          kind: MessageKind.IMAGE,
          filePath: imagePath,
          thumbnailPath: thumbPath,
          text: "sending image",
        });

        assert.equal(result.messageId, sendBodies[1].msg.client_id);
      },
    );

    assert.deepEqual(uploadParams, ["upload-param-1", "thumb-upload-param-1"]);
    assert.equal(sendBodies.length, 2);
    assert.equal(
      sendBodies[0].msg.item_list[0].text_item.text,
      "sending image",
    );
    assert.equal(sendBodies[1].msg.context_token, "ctx-123");
    assert.equal(
      sendBodies[1].msg.item_list[0].image_item.media.encrypt_query_param,
      "download-param-1",
    );
    assert.equal(
      sendBodies[1].msg.item_list[0].image_item.thumb_media.encrypt_query_param,
      "thumb-download-param-1",
    );
  } finally {
    fs.rmSync(tempRoot, { recursive: true, force: true });
  }
});

test("BotContext.sendTyping fetches a typing ticket and sends the requested status", async () => {
  const requests = [];
  const ctx = createContext();

  await withFetch(
    async (input, init) => {
      const url = new URL(typeof input === "string" ? input : input.url);
      const body = JSON.parse(String(init?.body));
      requests.push({ path: url.pathname, body });

      if (url.pathname === "/ilink/bot/getconfig") {
        return createJsonResponse({
          ret: 0,
          typing_ticket: "ticket-1",
        });
      }

      assert.equal(url.pathname, "/ilink/bot/sendtyping");
      return createJsonResponse({ ret: 0 });
    },
    async () => {
      await ctx.sendTyping(TypingStatus.CANCEL);
    },
  );

  assert.equal(requests.length, 2);
  assert.equal(requests[0].path, "/ilink/bot/getconfig");
  assert.equal(requests[0].body.ilink_user_id, "user-1");
  assert.equal(requests[0].body.context_token, "ctx-123");
  assert.equal(requests[1].path, "/ilink/bot/sendtyping");
  assert.equal(requests[1].body.typing_ticket, "ticket-1");
  assert.equal(requests[1].body.status, ApiTypingStatus.CANCEL);
});

test("BotContext.sendTyping rejects when getConfig does not return a ticket", async () => {
  const ctx = createContext();

  await withFetch(
    async () =>
      createJsonResponse({
        ret: 0,
      }),
    async () => {
      await assert.rejects(
        () => ctx.sendTyping(),
        /getConfig failed: missing typing_ticket/,
      );
    },
  );
});

test("BotContext.sendTyping rejects when sendtyping fails", async () => {
  const ctx = createContext();

  await withFetch(
    async (input) => {
      const url = new URL(typeof input === "string" ? input : input.url);
      if (url.pathname === "/ilink/bot/getconfig") {
        return createJsonResponse({
          ret: 0,
          typing_ticket: "ticket-2",
        });
      }

      return createJsonResponse({
        ret: 5,
        errmsg: "typing disabled",
      });
    },
    async () => {
      await assert.rejects(
        () => ctx.sendTyping(),
        /sendTyping failed: typing disabled/,
      );
    },
  );
});
