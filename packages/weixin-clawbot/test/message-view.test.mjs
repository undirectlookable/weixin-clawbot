import assert from "node:assert/strict";
import test from "node:test";

import { toBotMessage } from "../dist/context/message-view.js";
import { MessageItemType } from "../dist/protocol/enums.js";
import { MessageKind } from "../dist/public-types.js";

test("toBotMessage maps text payloads into user-facing text messages", () => {
  const result = toBotMessage(
    {
      message_id: 42,
      from_user_id: "user-1",
      to_user_id: "bot-1",
      context_token: "ctx-token",
      item_list: [
        {
          type: MessageItemType.TEXT,
          text_item: { text: "hello" },
        },
      ],
    },
    "fallback-user",
  );

  assert.deepEqual(result, {
    id: "42",
    kind: MessageKind.TEXT,
    fromUserId: "user-1",
    toUserId: "bot-1",
    createdAtMs: undefined,
    updatedAtMs: undefined,
    contextToken: "ctx-token",
    text: "hello",
  });
});

test("toBotMessage maps file payloads into user-facing file messages", () => {
  const result = toBotMessage(
    {
      from_user_id: "user-2",
      item_list: [
        {
          type: MessageItemType.FILE,
          msg_id: "file-msg-id",
          file_item: {
            file_name: "report.pdf",
            len: "128",
            media: {
              encrypt_query_param: "file-param",
              aes_key: "file-key",
              encrypt_type: 1,
            },
          },
        },
      ],
    },
    "fallback-user",
  );

  assert.deepEqual(result, {
    id: "file-msg-id",
    kind: MessageKind.FILE,
    fromUserId: "user-2",
    toUserId: undefined,
    createdAtMs: undefined,
    updatedAtMs: undefined,
    contextToken: undefined,
    media: {
      encryptQueryParam: "file-param",
      aesKey: "file-key",
      encryptType: 1,
    },
    fileName: "report.pdf",
    sizeBytes: 128,
  });
});

test("toBotMessage maps image media handles into the public message shape", () => {
  const result = toBotMessage(
    {
      from_user_id: "user-4",
      item_list: [
        {
          type: MessageItemType.IMAGE,
          image_item: {
            media: {
              encrypt_query_param: "image-param",
              aes_key: "image-key",
              encrypt_type: 1,
            },
            thumb_media: {
              encrypt_query_param: "thumb-param",
              aes_key: "thumb-key",
              encrypt_type: 1,
            },
            hd_size: 1024,
            thumb_size: 128,
            thumb_width: 320,
            thumb_height: 200,
          },
        },
      ],
    },
    "fallback-user",
  );

  assert.deepEqual(result, {
    id: undefined,
    kind: MessageKind.IMAGE,
    fromUserId: "user-4",
    toUserId: undefined,
    createdAtMs: undefined,
    updatedAtMs: undefined,
    contextToken: undefined,
    media: {
      encryptQueryParam: "image-param",
      aesKey: "image-key",
      encryptType: 1,
    },
    thumbnailMedia: {
      encryptQueryParam: "thumb-param",
      aesKey: "thumb-key",
      encryptType: 1,
    },
    sizeBytes: 1024,
    thumbnailSizeBytes: 128,
    width: 320,
    height: 200,
  });
});

test("toBotMessage falls back to unknown when item type is unsupported", () => {
  const result = toBotMessage(
    {
      from_user_id: "user-3",
      item_list: [
        {
          type: 999,
        },
      ],
    },
    "fallback-user",
  );

  assert.equal(result.kind, MessageKind.UNKNOWN);
  assert.equal(result.fromUserId, "user-3");
});
