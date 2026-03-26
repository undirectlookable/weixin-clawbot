import assert from "node:assert/strict";
import { Writable } from "node:stream";
import test from "node:test";
import { encryptAesEcb } from "../dist/transport/cdn/crypto.js";
import {
  downloadCdnBuffer,
  downloadCdnToWriter,
} from "../dist/transport/cdn/download.js";
import { uploadBufferToCdn } from "../dist/transport/cdn/upload.js";

function createAbortError() {
  const error = new Error("The operation was aborted");
  error.name = "AbortError";
  return error;
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

test("downloadCdnBuffer times out stalled CDN requests", async () => {
  await withFetch(
    async (_input, init) =>
      await new Promise((_resolve, reject) => {
        init?.signal?.addEventListener(
          "abort",
          () => reject(createAbortError()),
          { once: true },
        );
      }),
    async () => {
      await assert.rejects(
        () =>
          downloadCdnBuffer({
            downloadUrl:
              "https://cdn.example.invalid/c2c/download?encrypted_query_param=stalled",
            label: "file",
            aesKey: Buffer.from("00112233445566778899aabbccddeeff", "hex"),
            timeoutMs: 20,
            createError: (message) => new Error(message),
          }),
        /file CDN download timed out after 20ms/,
      );
    },
  );
});

test("downloadCdnToWriter keeps the timeout active while the body stream stalls", async () => {
  const rawKey = Buffer.from("00112233445566778899aabbccddeeff", "hex");
  const encrypted = encryptAesEcb(
    Buffer.from("streamed payload", "utf8"),
    rawKey,
  );

  await withFetch(
    async (_input, init) => {
      const signal = init?.signal;
      let controller;

      const body = new ReadableStream({
        start(streamController) {
          controller = streamController;
          streamController.enqueue(encrypted.subarray(0, 16));
        },
        cancel() {},
      });

      signal?.addEventListener(
        "abort",
        () => controller?.error(createAbortError()),
        { once: true },
      );

      return new Response(body, {
        status: 200,
        headers: {
          "Content-Type": "application/octet-stream",
        },
      });
    },
    async () => {
      await assert.rejects(
        () =>
          downloadCdnToWriter({
            downloadUrl:
              "https://cdn.example.invalid/c2c/download?encrypted_query_param=stream-stalled",
            label: "video",
            aesKey: rawKey,
            timeoutMs: 20,
            writable: new Writable({
              write(_chunk, _encoding, callback) {
                callback();
              },
            }),
            createError: (message) => new Error(message),
          }),
        /video stream download timed out after 20ms/,
      );
    },
  );
});

test("uploadBufferToCdn times out stalled CDN uploads", async () => {
  let attempts = 0;

  await withFetch(
    async (_input, init) => {
      attempts += 1;
      return await new Promise((_resolve, reject) => {
        init?.signal?.addEventListener(
          "abort",
          () => reject(createAbortError()),
          { once: true },
        );
      });
    },
    async () => {
      await assert.rejects(
        () =>
          uploadBufferToCdn({
            plaintext: Buffer.from("hello upload", "utf8"),
            uploadParam: "upload-param-1",
            filekey: "00112233445566778899aabbccddeeff",
            cdnBaseUrl: "https://cdn.example.invalid/c2c",
            aeskey: Buffer.from("00112233445566778899aabbccddeeff", "hex"),
            timeoutMs: 20,
          }),
        /CDN upload timed out after 20ms/,
      );

      assert.equal(attempts, 3);
    },
  );
});
