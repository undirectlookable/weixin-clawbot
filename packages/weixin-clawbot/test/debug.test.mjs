import assert from "node:assert/strict";
import test from "node:test";

import { createDebugLogger } from "../dist/core/debug.js";

test("createDebugLogger redacts sensitive fields and truncates long strings", () => {
  const lines = [];
  const logger = createDebugLogger({
    enabled: true,
    namespace: "test",
    sink: (line) => lines.push(line),
  });

  logger.log("sample", {
    token: "secret-token",
    upload_param: "hidden-param",
    text: "x".repeat(260),
    nested: {
      aeskey: "should-hide",
    },
  });

  assert.equal(lines.length, 1);
  assert.match(lines[0], /\[test\] sample/);
  assert.match(lines[0], /"<redacted:12>"/);
  assert.match(lines[0], /"<redacted:12>"/);
  assert.match(lines[0], /<trimmed:260>/);
  assert.match(lines[0], /"nested":\{"aeskey":"<redacted:11>"\}/);
});
