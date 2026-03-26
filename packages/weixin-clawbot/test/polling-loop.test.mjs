import assert from "node:assert/strict";
import test from "node:test";

import { runPollingLoop } from "../dist/bot/polling-loop.js";
import { MessageItemType } from "../dist/protocol/enums.js";

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

function createPollingParams(overrides = {}) {
  return {
    signal: new AbortController().signal,
    baseUrl: "https://example.invalid",
    token: "token-1",
    autoRetry: false,
    syncCursor: "cursor-1",
    longPollTimeoutMs: 50,
    sessionPausedUntil: 0,
    isRunning: () => true,
    persistSyncCursor: () => {},
    onError: () => {},
    onMessage: () => {},
    onStateChange: () => {},
    ...overrides,
  };
}

test("runPollingLoop persists cursor, updates timeout, and forwards messages", async () => {
  const persistedCursors = [];
  const stateChanges = [];
  const messages = [];
  let running = true;

  await withFetch(
    async () =>
      createJsonResponse({
        ret: 0,
        get_updates_buf: "cursor-2",
        longpolling_timeout_ms: 1234,
        msgs: [
          {
            from_user_id: "user-1",
            item_list: [
              {
                type: MessageItemType.TEXT,
                text_item: { text: "hello" },
              },
            ],
          },
        ],
      }),
    async () => {
      await runPollingLoop(
        createPollingParams({
          isRunning: () => running,
          persistSyncCursor: (cursor) => persistedCursors.push(cursor),
          onStateChange: (state) => stateChanges.push(state),
          onMessage: (message) => {
            messages.push(message);
            running = false;
          },
        }),
      );
    },
  );

  assert.deepEqual(persistedCursors, ["cursor-2"]);
  assert.deepEqual(stateChanges, [
    { longPollTimeoutMs: 1234 },
    { syncCursor: "cursor-2" },
  ]);
  assert.equal(messages.length, 1);
  assert.equal(messages[0].from_user_id, "user-1");
});

test("runPollingLoop surfaces non-session API errors without retry when autoRetry is disabled", async () => {
  const errors = [];
  let requests = 0;

  await withFetch(
    async () => {
      requests += 1;
      return createJsonResponse({
        ret: 7,
        errmsg: "bad poll",
      });
    },
    async () => {
      await runPollingLoop(
        createPollingParams({
          onError: (error) => errors.push(error.message),
        }),
      );
    },
  );

  assert.equal(requests, 1);
  assert.deepEqual(errors, [
    "getUpdates failed: ret=7 errcode= errmsg=bad poll",
  ]);
});

test("runPollingLoop reports session expiry and pauses future polling", async () => {
  const errors = [];
  const stateChanges = [];
  let running = true;

  await withFetch(
    async () =>
      createJsonResponse({
        ret: -14,
        errmsg: "expired",
      }),
    async () => {
      await runPollingLoop(
        createPollingParams({
          autoRetry: true,
          isRunning: () => running,
          onError: (error) => {
            errors.push(error.message);
            running = false;
          },
          onStateChange: (state) => stateChanges.push(state),
        }),
      );
    },
  );

  assert.equal(errors.length, 1);
  assert.match(errors[0], /session expired \(errcode -14\), paused for 60 min/);
  assert.equal(stateChanges.length, 1);
  assert.equal(typeof stateChanges[0].sessionPausedUntil, "number");
  assert.ok(stateChanges[0].sessionPausedUntil > Date.now());
});

test("runPollingLoop surfaces thrown fetch errors when autoRetry is disabled", async () => {
  const errors = [];
  let requests = 0;

  await withFetch(
    async () => {
      requests += 1;
      throw new Error("network down");
    },
    async () => {
      await runPollingLoop(
        createPollingParams({
          onError: (error) => errors.push(error.message),
        }),
      );
    },
  );

  assert.equal(requests, 1);
  assert.deepEqual(errors, ["network down"]);
});
