import assert from "node:assert/strict";
import test from "node:test";

import { createUploadReplyPlan } from "../dist/media/reply/upload-plan.js";
import { MessageItemType, UploadMediaType } from "../dist/protocol/enums.js";
import { MessageKind } from "../dist/public-types.js";

const uploadedMedia = {
  downloadEncryptedQueryParam: "download-param",
  aeskeyHex: "00112233445566778899aabbccddeeff",
  plaintextSize: 256,
  ciphertextSize: 272,
  thumbDownloadEncryptedQueryParam: "thumb-param",
  thumbCiphertextSize: 64,
};

test("createUploadReplyPlan builds file items with attachment metadata", () => {
  const plan = createUploadReplyPlan({
    kind: MessageKind.FILE,
    filePath: "/tmp/report.pdf",
    fileName: "report.pdf",
    text: "attachment",
  });

  assert.equal(plan.mediaType, UploadMediaType.FILE);
  assert.deepEqual(plan.uploadPaths, {
    filePath: "/tmp/report.pdf",
  });

  const item = plan.buildItem(uploadedMedia);
  assert.equal(item.type, MessageItemType.FILE);
  assert.equal(item.file_item.file_name, "report.pdf");
  assert.equal(item.file_item.len, "256");
  assert.equal(
    item.file_item.media.aes_key,
    "MDAxMTIyMzM0NDU1NjY3Nzg4OTlhYWJiY2NkZGVlZmY=",
  );
});

test("createUploadReplyPlan builds image items with thumbnail metadata", () => {
  const plan = createUploadReplyPlan({
    kind: MessageKind.IMAGE,
    filePath: "/tmp/image.png",
    thumbnailPath: "/tmp/thumb.png",
    text: "image",
  });

  assert.equal(plan.mediaType, UploadMediaType.IMAGE);
  assert.deepEqual(plan.uploadPaths, {
    filePath: "/tmp/image.png",
    thumbnailPath: "/tmp/thumb.png",
  });

  const item = plan.buildItem(uploadedMedia);
  assert.equal(item.type, MessageItemType.IMAGE);
  assert.equal(item.image_item.thumb_size, 64);
  assert.equal(item.image_item.thumb_media.encrypt_query_param, "thumb-param");
});

test("createUploadReplyPlan omits optional video thumbnail fields when absent", () => {
  const plan = createUploadReplyPlan({
    kind: MessageKind.VIDEO,
    filePath: "/tmp/video.mp4",
    text: "video",
  });

  const item = plan.buildItem({
    downloadEncryptedQueryParam: "download-param",
    aeskeyHex: "00112233445566778899aabbccddeeff",
    plaintextSize: 512,
    ciphertextSize: 528,
  });

  assert.equal(plan.mediaType, UploadMediaType.VIDEO);
  assert.equal(item.type, MessageItemType.VIDEO);
  assert.equal(item.video_item.video_size, 528);
  assert.equal(item.video_item.thumb_media, undefined);
  assert.equal(item.video_item.thumb_size, undefined);
});
