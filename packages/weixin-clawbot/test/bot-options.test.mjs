import assert from "node:assert/strict";
import test from "node:test";

import { resolveBotOptions } from "../dist/bot/options.js";

const RELEVANT_ENV_KEYS = [
  "WEIXIN_CLAWBOT_TOKEN",
  "WEIXIN_CLAWBOT_USER_ID",
  "WEIXIN_CLAWBOT_BASE_URL",
  "WEIXIN_CLAWBOT_STATE_ROOT",
  "WEIXIN_CLAWBOT_DEBUG",
];

function withEnv(overrides, fn) {
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
    return fn();
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

test("resolveBotOptions falls back to current defaults", () => {
  withEnv({}, () => {
    const options = resolveBotOptions({});

    assert.equal(options.baseUrl, "https://ilinkai.weixin.qq.com");
    assert.equal(options.accountId, "default");
    assert.equal(options.stateRoot, `${process.cwd()}/.weixin-clawbot`);
    assert.equal(options.autoRetry, true);
    assert.equal(options.debugEnabled, false);
  });
});

test("resolveBotOptions treats an empty env state root as memory-only state", () => {
  withEnv(
    {
      WEIXIN_CLAWBOT_STATE_ROOT: "",
    },
    () => {
      const options = resolveBotOptions({});

      assert.equal(options.stateRoot, "");
    },
  );
});

test("resolveBotOptions uses env values when explicit options are absent", () => {
  withEnv(
    {
      WEIXIN_CLAWBOT_TOKEN: "token-from-env",
      WEIXIN_CLAWBOT_USER_ID: "user-from-env",
      WEIXIN_CLAWBOT_BASE_URL: "https://example.invalid",
      WEIXIN_CLAWBOT_STATE_ROOT: "/tmp/weixin-state",
      WEIXIN_CLAWBOT_DEBUG: "true",
    },
    () => {
      const options = resolveBotOptions({});

      assert.equal(options.token, "token-from-env");
      assert.equal(options.userId, "user-from-env");
      assert.equal(options.baseUrl, "https://example.invalid");
      assert.equal(options.stateRoot, "/tmp/weixin-state");
      assert.equal(options.accountId, "user-from-env");
      assert.equal(options.debugEnabled, true);
    },
  );
});

test("resolveBotOptions treats an explicit empty state root as memory-only state", () => {
  withEnv(
    {
      WEIXIN_CLAWBOT_STATE_ROOT: "/tmp/weixin-state",
    },
    () => {
      const options = resolveBotOptions({
        stateRoot: "",
      });

      assert.equal(options.stateRoot, "");
    },
  );
});

test("resolveBotOptions gives precedence to explicit options", () => {
  withEnv(
    {
      WEIXIN_CLAWBOT_TOKEN: "token-from-env",
      WEIXIN_CLAWBOT_USER_ID: "user-from-env",
      WEIXIN_CLAWBOT_BASE_URL: "https://example.invalid",
      WEIXIN_CLAWBOT_STATE_ROOT: "/tmp/weixin-state",
      WEIXIN_CLAWBOT_DEBUG: "false",
    },
    () => {
      const options = resolveBotOptions({
        token: "token-from-options",
        userId: "user-from-options",
        baseUrl: "https://override.invalid",
        stateRoot: "/tmp/override-state",
        accountId: "override-account",
        autoRetry: false,
        longPollTimeoutMs: 1234,
        debug: true,
      });

      assert.equal(options.token, "token-from-options");
      assert.equal(options.userId, "user-from-options");
      assert.equal(options.baseUrl, "https://override.invalid");
      assert.equal(options.stateRoot, "/tmp/override-state");
      assert.equal(options.accountId, "override-account");
      assert.equal(options.autoRetry, false);
      assert.equal(options.longPollTimeoutMs, 1234);
      assert.equal(options.debugEnabled, true);
    },
  );
});
