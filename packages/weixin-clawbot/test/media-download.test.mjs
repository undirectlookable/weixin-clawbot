import assert from "node:assert/strict";
import { Writable } from "node:stream";
import test from "node:test";

import { BotContext } from "../dist/context/context.js";
import { MessageItemType } from "../dist/protocol/enums.js";
import { encryptAesEcb } from "../dist/transport/cdn/crypto.js";

function createEncryptedResponse(plaintext, rawKey) {
  const ciphertext = encryptAesEcb(Buffer.from(plaintext, "utf8"), rawKey);
  return new Response(ciphertext, {
    status: 200,
    headers: {
      "Content-Type": "application/octet-stream",
    },
  });
}

function withFetch(mockFetch, fn) {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = mockFetch;

  try {
    return fn();
  } finally {
    globalThis.fetch = originalFetch;
  }
}

function createContext(message) {
  return new BotContext({
    accountId: "account-1",
    baseUrl: "https://example.invalid",
    defaultToUserId: "fallback-user",
    message,
  });
}

function createBufferCollectingWritable(chunks) {
  return new Writable({
    write(chunk, _encoding, callback) {
      chunks.push(Buffer.from(chunk));
      callback();
    },
  });
}

test("downloadMedia decrypts images with image_item.aeskey before media.aes_key", async () => {
  const rawKey = Buffer.from("00112233445566778899aabbccddeeff", "hex");
  const ctx = createContext({
    from_user_id: "user-1",
    item_list: [
      {
        type: MessageItemType.IMAGE,
        image_item: {
          aeskey: rawKey.toString("hex"),
          media: {
            encrypt_query_param: "image-download-param",
            aes_key: "not-used",
          },
        },
      },
    ],
  });

  await withFetch(
    async (url) => {
      assert.match(String(url), /\/download\?/);
      return createEncryptedResponse("image-payload", rawKey);
    },
    async () => {
      const result = await ctx.downloadMedia();
      assert.equal(result.toString("utf8"), "image-payload");
    },
  );
});

test("downloadMediaTo streams decrypted media into a writable", async () => {
  const rawKey = Buffer.from("00112233445566778899aabbccddeeff", "hex");
  const ctx = createContext({
    from_user_id: "user-stream",
    item_list: [
      {
        type: MessageItemType.FILE,
        file_item: {
          media: {
            encrypt_query_param: "file-stream-download-param",
            aes_key: Buffer.from(rawKey.toString("hex"), "utf8").toString(
              "base64",
            ),
          },
        },
      },
    ],
  });
  const chunks = [];

  await withFetch(
    async () => createEncryptedResponse("streamed-file-payload", rawKey),
    async () => {
      await ctx.downloadMediaTo(createBufferCollectingWritable(chunks));
    },
  );

  assert.equal(Buffer.concat(chunks).toString("utf8"), "streamed-file-payload");
});

test("downloadMedia decrypts voice file and video messages with base64-encoded hex AES keys", async () => {
  const rawKey = Buffer.from("00112233445566778899aabbccddeeff", "hex");
  const aesKeyBase64 = Buffer.from(rawKey.toString("hex"), "utf8").toString(
    "base64",
  );

  const cases = [
    {
      type: MessageItemType.VOICE,
      item: {
        voice_item: {
          media: {
            encrypt_query_param: "voice-download-param",
            aes_key: aesKeyBase64,
          },
        },
      },
      expected: "voice-payload",
    },
    {
      type: MessageItemType.FILE,
      item: {
        file_item: {
          media: {
            encrypt_query_param: "file-download-param",
            aes_key: aesKeyBase64,
          },
        },
      },
      expected: "file-payload",
    },
    {
      type: MessageItemType.VIDEO,
      item: {
        video_item: {
          media: {
            encrypt_query_param: "video-download-param",
            aes_key: aesKeyBase64,
          },
          thumb_media: {
            encrypt_query_param: "thumb-download-param",
            aes_key: "not-used",
          },
        },
      },
      expected: "video-payload",
    },
  ];

  for (const currentCase of cases) {
    const ctx = createContext({
      from_user_id: "user-2",
      item_list: [
        {
          type: currentCase.type,
          ...currentCase.item,
        },
      ],
    });

    await withFetch(
      async (url) => {
        assert.match(String(url), /download/);
        assert.doesNotMatch(String(url), /thumb-download-param/);
        return createEncryptedResponse(currentCase.expected, rawKey);
      },
      async () => {
        const result = await ctx.downloadMedia();
        assert.equal(result.toString("utf8"), currentCase.expected);
      },
    );
  }
});

test("downloadMedia throws on non-media messages", async () => {
  const textContext = createContext({
    from_user_id: "user-3",
    item_list: [
      {
        type: MessageItemType.TEXT,
        text_item: {
          text: "hello",
        },
      },
    ],
  });

  await assert.rejects(
    () => textContext.downloadMedia(),
    /text messages do not have downloadable media/,
  );

  const unknownContext = createContext({
    from_user_id: "user-4",
    item_list: [
      {
        type: 999,
      },
    ],
  });

  await assert.rejects(
    () => unknownContext.downloadMedia(),
    /does not expose downloadable media/,
  );
});

test("downloadMedia throws clear errors when key or media metadata is missing", async () => {
  const missingKeyContext = createContext({
    from_user_id: "user-5",
    item_list: [
      {
        type: MessageItemType.FILE,
        file_item: {
          media: {
            encrypt_query_param: "file-download-param",
          },
        },
      },
    ],
  });

  await assert.rejects(
    () => missingKeyContext.downloadMedia(),
    /file message is missing media\.aes_key/,
  );

  const missingParamContext = createContext({
    from_user_id: "user-6",
    item_list: [
      {
        type: MessageItemType.VIDEO,
        video_item: {
          media: {
            aes_key: "unused",
          },
        },
      },
    ],
  });

  await assert.rejects(
    () => missingParamContext.downloadMedia(),
    /video message is missing media\.encrypt_query_param/,
  );
});

test("downloadMedia wraps CDN download and decrypt failures", async () => {
  const networkContext = createContext({
    from_user_id: "user-7",
    item_list: [
      {
        type: MessageItemType.FILE,
        file_item: {
          media: {
            encrypt_query_param: "file-download-param",
            aes_key: Buffer.from(
              "00112233445566778899aabbccddeeff",
              "utf8",
            ).toString("base64"),
          },
        },
      },
    ],
  });

  await withFetch(
    async () => {
      throw new Error("network down");
    },
    async () => {
      await assert.rejects(
        () => networkContext.downloadMedia(),
        (error) => {
          assert.match(error.message, /file CDN request failed: network down/);
          assert.equal(error.cause?.message, "network down");
          return true;
        },
      );
    },
  );

  const invalidKeyContext = createContext({
    from_user_id: "user-8",
    item_list: [
      {
        type: MessageItemType.VOICE,
        voice_item: {
          media: {
            encrypt_query_param: "voice-download-param",
            aes_key: "invalid-base64",
          },
        },
      },
    ],
  });

  await assert.rejects(
    () => invalidKeyContext.downloadMedia(),
    /voice aes_key must decode to 16 raw bytes or a 32-char hex string/,
  );
});

test("downloadMediaTo wraps stream pipeline failures", async () => {
  const rawKey = Buffer.from("00112233445566778899aabbccddeeff", "hex");
  const ctx = createContext({
    from_user_id: "user-stream-fail",
    item_list: [
      {
        type: MessageItemType.VIDEO,
        video_item: {
          media: {
            encrypt_query_param: "video-stream-download-param",
            aes_key: Buffer.from(rawKey.toString("hex"), "utf8").toString(
              "base64",
            ),
          },
        },
      },
    ],
  });

  await withFetch(
    async () => createEncryptedResponse("streamed-video-payload", rawKey),
    async () => {
      await assert.rejects(
        () =>
          ctx.downloadMediaTo(
            new Writable({
              write(_chunk, _encoding, callback) {
                callback(new Error("disk full"));
              },
            }),
          ),
        /video stream download failed: disk full/,
      );
    },
  );
});
