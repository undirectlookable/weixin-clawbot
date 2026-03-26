import assert from "node:assert/strict";
import test from "node:test";

import { getUpdates } from "../dist/transport/api/bot-api.js";
import { fetchQrStatus } from "../dist/transport/api/qr-api.js";

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

test("getUpdates treats request timeouts as empty poll responses", async () => {
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
      const response = await getUpdates({
        baseUrl: "https://example.invalid",
        token: "token-1",
        get_updates_buf: "cursor-1",
        timeoutMs: 20,
      });

      assert.deepEqual(response, {
        ret: 0,
        msgs: [],
        get_updates_buf: "cursor-1",
      });
    },
  );
});

test("getUpdates propagates external aborts instead of treating them as timeouts", async () => {
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
      const controller = new AbortController();
      const request = getUpdates({
        baseUrl: "https://example.invalid",
        token: "token-1",
        get_updates_buf: "cursor-2",
        timeoutMs: 200,
        signal: controller.signal,
      });

      controller.abort();

      await assert.rejects(request, (error) => {
        assert.equal(error.name, "AbortError");
        assert.equal(error.message, "The operation was aborted");
        return true;
      });
    },
  );
});

test("fetchQrStatus only converts timeouts into wait states", async () => {
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
      const status = await fetchQrStatus({
        baseUrl: "https://example.invalid",
        qrcode: "qr-1",
        timeoutMs: 20,
      });

      assert.deepEqual(status, { status: "wait" });
    },
  );
});
