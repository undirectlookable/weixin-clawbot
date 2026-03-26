import { MessageItemType } from "../../protocol/enums.js";
import {
  MessageKind,
  type ReplyResult,
  type ReplyTextInput,
} from "../../public-types.js";
import { uploadMedia } from "../upload.js";
import {
  assertUnreachable,
  describeReplyInput,
  normalizeReplyInput,
} from "./input.js";
import {
  createReplyRuntime,
  type ReplyRuntime,
  type SendReplyParams,
  sendOptionalPreludeText,
  sendReplyItem,
} from "./runtime.js";
import {
  createUploadReplyPlan,
  type UploadBackedReplyInput,
} from "./upload-plan.js";

async function sendTextMessage(
  runtime: ReplyRuntime,
  input: ReplyTextInput,
): Promise<ReplyResult> {
  const messageId = await sendReplyItem({
    toUserId: runtime.toUserId,
    contextToken: runtime.contextToken,
    apiOptions: runtime.apiOptions,
    debug: runtime.debug.child("message"),
    item: {
      type: MessageItemType.TEXT,
      text_item: { text: input.text },
    },
  });

  return { messageId };
}

async function sendUploadedReply(
  runtime: ReplyRuntime,
  input: UploadBackedReplyInput,
): Promise<ReplyResult> {
  const plan = createUploadReplyPlan(input);
  await sendOptionalPreludeText(runtime, plan.text);

  runtime.debug.log("upload.prepare", {
    kind: plan.kind,
    filePath: plan.uploadPaths.filePath,
    thumbnailPath: plan.uploadPaths.thumbnailPath,
  });

  const uploaded = await uploadMedia({
    filePath: plan.uploadPaths.filePath,
    thumbPath: plan.uploadPaths.thumbnailPath,
    toUserId: runtime.toUserId,
    baseUrl: runtime.baseUrl,
    token: runtime.token,
    mediaType: plan.mediaType,
    cdnBaseUrl: runtime.cdnBaseUrl,
    debug: runtime.debug.child("upload"),
  });

  runtime.debug.log("upload.complete", {
    kind: plan.kind,
    ciphertextSize: uploaded.ciphertextSize,
    thumbCiphertextSize: uploaded.thumbCiphertextSize,
  });

  const messageId = await sendReplyItem({
    toUserId: runtime.toUserId,
    contextToken: runtime.contextToken,
    apiOptions: runtime.apiOptions,
    debug: runtime.debug.child("message"),
    item: plan.buildItem(uploaded),
  });

  return { messageId };
}

export async function sendReply(params: SendReplyParams): Promise<ReplyResult> {
  const runtime = createReplyRuntime(params);
  const input = normalizeReplyInput(params.input);

  runtime.debug.log("reply.prepare", {
    toUserId: runtime.toUserId,
    contextTokenPresent: Boolean(runtime.contextToken),
    input: describeReplyInput(input),
  });

  switch (input.kind) {
    case MessageKind.TEXT:
      return sendTextMessage(runtime, input);
    case MessageKind.IMAGE:
    case MessageKind.VOICE:
    case MessageKind.FILE:
    case MessageKind.VIDEO:
      return sendUploadedReply(runtime, input);
    default:
      return assertUnreachable(input);
  }
}
