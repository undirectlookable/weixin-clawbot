import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { Writable } from "node:stream";
import test from "node:test";

import { Bot } from "../dist/index.js";
import { decryptAesEcb, encryptAesEcb } from "../dist/transport/cdn/crypto.js";

const RELEVANT_ENV_KEYS = [
  "WEIXIN_CLAWBOT_TOKEN",
  "WEIXIN_CLAWBOT_BASE_URL",
  "WEIXIN_CLAWBOT_DEBUG",
];

async function withEnv(overrides, fn) {
  const snapshot = Object.fromEntries(
    RELEVANT_ENV_KEYS.map((key) => [key, process.env[key]]),
  );

  for (const key of RELEVANT_ENV_KEYS) {
    if (Object.hasOwn(overrides, key)) {
      const value = overrides[key];
      if (value === undefined) {
        delete process.env[key];
      } else {
        process.env[key] = value;
      }
    } else {
      delete process.env[key];
    }
  }

  try {
    return await fn();
  } finally {
    for (const key of RELEVANT_ENV_KEYS) {
      const value = snapshot[key];
      if (value === undefined) {
        delete process.env[key];
      } else {
        process.env[key] = value;
      }
    }
  }
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

function createBufferCollectingWritable(chunks) {
  return new Writable({
    write(chunk, _encoding, callback) {
      chunks.push(Buffer.from(chunk));
      callback();
    },
  });
}

test("bot.uploadFile uploads encrypted bytes and reuses bot runtime config", async () => {
  const tempRoot = fs.mkdtempSync(
    path.join(os.tmpdir(), "weixin-upload-file-"),
  );
  const filePath = path.join(tempRoot, "sample.txt");
  const plaintext = Buffer.from("hello uploaded file", "utf8");
  fs.writeFileSync(filePath, plaintext);

  let requestAesKeyHex;
  let uploadedCiphertext;
  let uploadFilekey;

  try {
    const bot = new Bot({
      token: "token-1",
      baseUrl: "https://example.invalid",
      cdnBaseUrl: "https://cdn.example.invalid/c2c",
    });

    await withFetch(
      async (input, init) => {
        const url = new URL(typeof input === "string" ? input : input.url);

        if (url.pathname === "/ilink/bot/getuploadurl") {
          const body = JSON.parse(String(init?.body));
          uploadFilekey = body.filekey;
          requestAesKeyHex = body.aeskey;

          assert.equal(body.to_user_id, "user-1");
          assert.equal(body.rawsize, plaintext.byteLength);
          assert.match(body.filekey, /^[0-9a-f]{32}$/);
          assert.match(body.aeskey, /^[0-9a-f]{32}$/);

          return new Response(
            JSON.stringify({
              upload_param: "upload-param-1",
            }),
            {
              status: 200,
              headers: {
                "Content-Type": "application/json",
              },
            },
          );
        }

        assert.equal(url.pathname, "/c2c/upload");
        assert.equal(
          url.searchParams.get("encrypted_query_param"),
          "upload-param-1",
        );
        assert.equal(url.searchParams.get("filekey"), uploadFilekey);

        uploadedCiphertext = Buffer.from(init.body);

        return new Response(null, {
          status: 200,
          headers: {
            "x-encrypted-param": "download-param-1",
          },
        });
      },
      async () => {
        const uploaded = await bot.uploadFile({
          filePath,
          toUserId: "user-1",
        });

        assert.equal(
          uploaded.downloadUrl,
          "https://cdn.example.invalid/c2c/download?encrypted_query_param=download-param-1",
        );
        assert.equal(uploaded.encryptQueryParam, "download-param-1");
        assert.equal(uploaded.aesKeyHex, requestAesKeyHex);
        assert.equal(uploaded.plaintextSize, plaintext.byteLength);
        assert.ok(uploaded.ciphertextSize >= plaintext.byteLength);
      },
    );

    assert.ok(uploadedCiphertext);
    assert.equal(
      decryptAesEcb(
        uploadedCiphertext,
        Buffer.from(requestAesKeyHex, "hex"),
      ).toString("utf8"),
      plaintext.toString("utf8"),
    );
  } finally {
    fs.rmSync(tempRoot, { recursive: true, force: true });
  }
});

test("bot.uploadFile requires the bot to have a token", async () => {
  await withEnv(
    {
      WEIXIN_CLAWBOT_TOKEN: undefined,
      WEIXIN_CLAWBOT_BASE_URL: undefined,
      WEIXIN_CLAWBOT_DEBUG: undefined,
    },
    async () => {
      const bot = new Bot({
        baseUrl: "https://example.invalid",
      });

      await assert.rejects(
        () =>
          bot.uploadFile({
            filePath: "/tmp/missing-token.txt",
            toUserId: "user-1",
          }),
        /bot\.uploadFile failed: bot token is missing/,
      );
    },
  );
});

test("bot.uploadFile wraps upload failures with the bot scope and preserves cause", async () => {
  const tempRoot = fs.mkdtempSync(
    path.join(os.tmpdir(), "weixin-upload-file-error-"),
  );
  const filePath = path.join(tempRoot, "sample.txt");
  fs.writeFileSync(filePath, Buffer.from("hello uploaded file", "utf8"));
  let uploadAttempts = 0;

  try {
    const bot = new Bot({
      token: "token-1",
      baseUrl: "https://example.invalid",
      cdnBaseUrl: "https://cdn.example.invalid/c2c",
    });

    await withFetch(
      async (input) => {
        const url = new URL(typeof input === "string" ? input : input.url);

        if (url.pathname === "/ilink/bot/getuploadurl") {
          return new Response(
            JSON.stringify({
              upload_param: "upload-param-1",
            }),
            {
              status: 200,
              headers: {
                "Content-Type": "application/json",
              },
            },
          );
        }

        uploadAttempts += 1;
        throw new Error("cdn offline");
      },
      async () => {
        await assert.rejects(
          () =>
            bot.uploadFile({
              filePath,
              toUserId: "user-1",
            }),
          (error) => {
            assert.equal(
              error.message,
              "bot.uploadFile failed: CDN upload request failed: cdn offline",
            );
            assert.equal(
              error.cause?.message,
              "CDN upload request failed: cdn offline",
            );
            assert.equal(error.cause?.cause?.message, "cdn offline");
            return true;
          },
        );
      },
    );

    assert.equal(uploadAttempts, 3);
  } finally {
    fs.rmSync(tempRoot, { recursive: true, force: true });
  }
});

test("bot.downloadFile downloads ciphertext from CDN and decrypts it with aesKeyHex", async () => {
  const rawKey = Buffer.from("00112233445566778899aabbccddeeff", "hex");
  const bot = new Bot({
    token: "token-1",
  });

  await withFetch(
    async (input) => {
      assert.equal(
        String(input),
        "https://cdn.example.invalid/c2c/download?encrypted_query_param=download-param-2",
      );
      return new Response(
        encryptAesEcb(Buffer.from("downloaded payload", "utf8"), rawKey),
        {
          status: 200,
          headers: {
            "Content-Type": "application/octet-stream",
          },
        },
      );
    },
    async () => {
      const result = await bot.downloadFile({
        downloadUrl:
          "https://cdn.example.invalid/c2c/download?encrypted_query_param=download-param-2",
        aesKeyHex: rawKey.toString("hex"),
      });

      assert.equal(result.toString("utf8"), "downloaded payload");
    },
  );
});

test("bot.downloadFileTo streams decrypted bytes into a writable", async () => {
  const rawKey = Buffer.from("00112233445566778899aabbccddeeff", "hex");
  const chunks = [];
  const bot = new Bot({
    token: "token-1",
  });

  await withFetch(
    async () =>
      new Response(
        encryptAesEcb(Buffer.from("streamed payload", "utf8"), rawKey),
        {
          status: 200,
          headers: {
            "Content-Type": "application/octet-stream",
          },
        },
      ),
    async () => {
      await bot.downloadFileTo({
        downloadUrl:
          "https://cdn.example.invalid/c2c/download?encrypted_query_param=download-param-3",
        aesKeyHex: rawKey.toString("hex"),
        writable: createBufferCollectingWritable(chunks),
      });
    },
  );

  assert.equal(Buffer.concat(chunks).toString("utf8"), "streamed payload");
});
