import assert from "node:assert/strict";
import test from "node:test";
import { setImmediate as waitForMicrotasks } from "node:timers/promises";

import {
  addHandler,
  emitHandlers,
  removeHandler,
} from "../dist/bot/event-emitter.js";

function toError(error) {
  return error instanceof Error ? error : new Error(String(error));
}

test("addHandler and removeHandler manage subscribed handlers", () => {
  const handlers = {
    message: new Set(),
    error: new Set(),
  };
  const handler = () => {};

  addHandler(handlers, "message", handler);
  assert.equal(handlers.message.has(handler), true);

  removeHandler(handlers, "message", handler);
  assert.equal(handlers.message.has(handler), false);
});

test("emitHandlers forwards sync and async failures through emitError", async () => {
  const received = [];
  const forwardedErrors = [];
  const handlers = {
    message: new Set([
      (value) => {
        received.push(value);
      },
      async () => {
        throw new Error("async boom");
      },
      () => {
        throw new Error("sync boom");
      },
    ]),
    error: new Set(),
  };

  emitHandlers(
    handlers,
    "message",
    (error) => forwardedErrors.push(error.message),
    toError,
    "payload",
  );

  await waitForMicrotasks();

  assert.deepEqual(received, ["payload"]);
  assert.deepEqual(forwardedErrors.sort(), ["async boom", "sync boom"]);
});

test("emitHandlers does not recurse when an error handler throws", async () => {
  const forwardedErrors = [];
  const handlers = {
    message: new Set(),
    error: new Set([
      () => {
        throw new Error("error handler failed");
      },
      async () => {
        throw new Error("async error handler failed");
      },
    ]),
  };

  emitHandlers(
    handlers,
    "error",
    (error) => forwardedErrors.push(error.message),
    toError,
    new Error("original"),
  );

  await waitForMicrotasks();

  assert.deepEqual(forwardedErrors, []);
});
