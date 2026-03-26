import assert from "node:assert/strict";
import test from "node:test";

import {
  describeReplyInput,
  normalizeReplyInput,
} from "../dist/media/reply/input.js";
import { MessageKind } from "../dist/public-types.js";

test("normalizeReplyInput converts a string into a text reply", () => {
  const result = normalizeReplyInput("hello");

  assert.deepEqual(result, {
    kind: MessageKind.TEXT,
    text: "hello",
  });
});

test("describeReplyInput keeps reply metadata readable", () => {
  const description = describeReplyInput({
    kind: MessageKind.IMAGE,
    filePath: "/tmp/image.png",
    text: "preview",
    thumbnailPath: "/tmp/thumb.png",
  });

  assert.deepEqual(description, {
    kind: MessageKind.IMAGE,
    filePath: "/tmp/image.png",
    text: "preview",
    fileName: undefined,
    thumbnailPath: "/tmp/thumb.png",
  });
});
