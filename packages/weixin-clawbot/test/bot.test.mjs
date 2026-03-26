import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { setTimeout as sleep } from "node:timers/promises";

import { Bot } from "../dist/index.js";

function createJsonResponse(body) {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: {
      "Content-Type": "application/json",
    },
  });
}

function createAbortError() {
  const error = new Error("The operation was aborted");
  error.name = "AbortError";
  return error;
}

async function waitFor(predicate, timeoutMs = 200) {
  const startedAt = Date.now();

  while (!predicate()) {
    if (Date.now() - startedAt >= timeoutMs) {
      throw new Error("Timed out waiting for condition");
    }
    await sleep(10);
  }
}

test("Bot.start stays idle when there are no message handlers", async () => {
  const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), "weixin-bot-idle-"));
  const originalFetch = globalThis.fetch;
  let getUpdatesRequests = 0;

  globalThis.fetch = async (input) => {
    const url = new URL(typeof input === "string" ? input : input.url);
    if (url.pathname === "/ilink/bot/getupdates") {
      getUpdatesRequests += 1;
    }

    return createJsonResponse({
      ret: 0,
      msgs: [],
      get_updates_buf: "",
    });
  };

  try {
    const bot = new Bot({
      baseUrl: "https://example.invalid",
      stateRoot: tempRoot,
    });

    bot.start();
    await sleep(50);

    assert.equal(bot.isRunning(), true);
    assert.equal(getUpdatesRequests, 0);

    bot.end();

    assert.equal(bot.isRunning(), false);
  } finally {
    globalThis.fetch = originalFetch;
    fs.rmSync(tempRoot, { recursive: true, force: true });
  }
});

test("Bot starts polling after the first message handler is added", async () => {
  const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), "weixin-bot-poll-"));
  const originalFetch = globalThis.fetch;
  let getUpdatesRequests = 0;

  globalThis.fetch = async (input, init) => {
    const url = new URL(typeof input === "string" ? input : input.url);
    if (url.pathname !== "/ilink/bot/getupdates") {
      return createJsonResponse({ ret: 0 });
    }

    getUpdatesRequests += 1;

    return await new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        resolve(
          createJsonResponse({
            ret: 0,
            msgs: [],
            get_updates_buf: "",
          }),
        );
      }, 10);

      init?.signal?.addEventListener(
        "abort",
        () => {
          clearTimeout(timer);
          reject(createAbortError());
        },
        { once: true },
      );
    });
  };

  try {
    const bot = new Bot({
      baseUrl: "https://example.invalid",
      stateRoot: tempRoot,
    });

    bot.start();
    await sleep(30);
    assert.equal(getUpdatesRequests, 0);

    const handler = () => {};
    bot.on("message", handler);

    await waitFor(() => getUpdatesRequests > 0);
    assert.equal(bot.isRunning(), true);

    bot.end();
    await sleep(20);

    assert.equal(bot.isRunning(), false);
  } finally {
    globalThis.fetch = originalFetch;
    fs.rmSync(tempRoot, { recursive: true, force: true });
  }
});

test("Bot.end aborts an in-flight long poll immediately", async () => {
  const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), "weixin-bot-end-"));
  const originalFetch = globalThis.fetch;
  let getUpdatesRequests = 0;
  let abortedAt;
  let endAt;

  globalThis.fetch = async (input, init) => {
    const url = new URL(typeof input === "string" ? input : input.url);
    if (url.pathname !== "/ilink/bot/getupdates") {
      return createJsonResponse({ ret: 0 });
    }

    getUpdatesRequests += 1;

    return await new Promise((_resolve, reject) => {
      init?.signal?.addEventListener(
        "abort",
        () => {
          abortedAt = Date.now();
          reject(createAbortError());
        },
        { once: true },
      );
    });
  };

  try {
    const bot = new Bot({
      baseUrl: "https://example.invalid",
      stateRoot: tempRoot,
      longPollTimeoutMs: 1_000,
    });

    bot.on("message", () => {});
    bot.on("end", () => {
      endAt = Date.now();
    });

    const startedAt = Date.now();
    bot.start();

    await waitFor(() => getUpdatesRequests > 0);
    bot.end();

    await waitFor(() => endAt !== undefined, 200);

    assert.ok(abortedAt);
    assert.ok(abortedAt - startedAt < 200);
    assert.ok(endAt - abortedAt < 100);
    assert.equal(bot.isRunning(), false);
  } finally {
    globalThis.fetch = originalFetch;
    fs.rmSync(tempRoot, { recursive: true, force: true });
  }
});
