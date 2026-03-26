import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";

import {
  BotStateStore,
  DEFAULT_STATE_ROOT,
  resolveStateRoot,
} from "../dist/bot/state-store.js";

test("resolveStateRoot falls back to the default cwd-based directory", () => {
  assert.equal(resolveStateRoot(undefined), DEFAULT_STATE_ROOT);
});

test("resolveStateRoot keeps an explicit empty value for memory-only state", () => {
  assert.equal(resolveStateRoot(""), "");
  assert.equal(resolveStateRoot("   "), "");
});

test("BotStateStore persists sync cursor and context tokens", () => {
  const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), "weixin-state-"));

  try {
    const writer = new BotStateStore("account-1", tempRoot);
    writer.ensureReady();
    writer.saveSyncCursor("cursor-123");
    writer.setContextToken("user-1", "ctx-123");
    writer.setContextToken("user-2", "ctx-456");

    const reader = new BotStateStore("account-1", tempRoot);
    reader.restoreContextTokens();

    assert.equal(reader.loadSyncCursor(), "cursor-123");
    assert.equal(reader.getContextToken("user-1"), "ctx-123");
    assert.equal(reader.getContextToken("user-2"), "ctx-456");
  } finally {
    fs.rmSync(tempRoot, { recursive: true, force: true });
  }
});

test("BotStateStore keeps state only in memory when stateRoot is empty", () => {
  const writer = new BotStateStore("account-1", "");
  writer.ensureReady();
  writer.saveSyncCursor("cursor-123");
  writer.setContextToken("user-1", "ctx-123");

  assert.equal(writer.loadSyncCursor(), "cursor-123");
  assert.equal(writer.getContextToken("user-1"), "ctx-123");

  const reader = new BotStateStore("account-1", "");
  reader.restoreContextTokens();

  assert.equal(reader.loadSyncCursor(), undefined);
  assert.equal(reader.getContextToken("user-1"), undefined);
});
