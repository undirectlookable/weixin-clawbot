import { MessageItemType, UploadMediaType } from "../../protocol/enums.js";
import type { MessageItem } from "../../protocol/message.js";
import {
  MessageKind,
  type ReplyFileInput,
  type ReplyImageInput,
  type ReplyVideoInput,
  type ReplyVoiceInput,
} from "../../public-types.js";
import { resolveUploadFileName } from "../file-meta.js";
import type { UploadedMedia } from "../upload.js";
import { buildEncryptedMedia } from "./builders.js";

export type UploadBackedReplyInput =
  | ReplyImageInput
  | ReplyVoiceInput
  | ReplyFileInput
  | ReplyVideoInput;

export type UploadReplyPlan = {
  kind: UploadBackedReplyInput["kind"];
  mediaType: (typeof UploadMediaType)[keyof typeof UploadMediaType];
  text?: string | undefined;
  uploadPaths: {
    filePath: string;
    thumbnailPath?: string | undefined;
  };
  buildItem: (uploaded: UploadedMedia) => MessageItem;
};

function assertUnreachable(value: never): never {
  throw new Error(`Unsupported upload reply plan: ${JSON.stringify(value)}`);
}

function buildThumbMedia(uploaded: UploadedMedia) {
  if (!uploaded.thumbDownloadEncryptedQueryParam) {
    return undefined;
  }

  return buildEncryptedMedia({
    encryptQueryParam: uploaded.thumbDownloadEncryptedQueryParam,
    aeskeyHex: uploaded.aeskeyHex,
  });
}

function buildPrimaryMedia(uploaded: UploadedMedia) {
  return buildEncryptedMedia({
    encryptQueryParam: uploaded.downloadEncryptedQueryParam,
    aeskeyHex: uploaded.aeskeyHex,
  });
}

function buildImageReplyItem(uploaded: UploadedMedia): MessageItem {
  return {
    type: MessageItemType.IMAGE,
    image_item: {
      media: buildPrimaryMedia(uploaded),
      thumb_media: buildThumbMedia(uploaded),
      hd_size: uploaded.ciphertextSize,
      mid_size: uploaded.ciphertextSize,
      thumb_size: uploaded.thumbCiphertextSize,
    },
  };
}

function buildVoiceReplyItem(uploaded: UploadedMedia): MessageItem {
  return {
    type: MessageItemType.VOICE,
    voice_item: {
      media: buildPrimaryMedia(uploaded),
    },
  };
}

function buildFileReplyItem(
  input: ReplyFileInput,
  uploaded: UploadedMedia,
): MessageItem {
  return {
    type: MessageItemType.FILE,
    file_item: {
      media: buildPrimaryMedia(uploaded),
      file_name: resolveUploadFileName({
        filePath: input.filePath,
        fileName: input.fileName,
      }),
      len: String(uploaded.plaintextSize),
    },
  };
}

function buildVideoReplyItem(uploaded: UploadedMedia): MessageItem {
  return {
    type: MessageItemType.VIDEO,
    video_item: {
      media: buildPrimaryMedia(uploaded),
      video_size: uploaded.ciphertextSize,
      thumb_media: buildThumbMedia(uploaded),
      thumb_size: uploaded.thumbCiphertextSize,
    },
  };
}

export function createUploadReplyPlan(
  input: UploadBackedReplyInput,
): UploadReplyPlan {
  switch (input.kind) {
    case MessageKind.IMAGE:
      return {
        kind: input.kind,
        mediaType: UploadMediaType.IMAGE,
        text: input.text,
        uploadPaths: {
          filePath: input.filePath,
          thumbnailPath: input.thumbnailPath,
        },
        buildItem: (uploaded) => buildImageReplyItem(uploaded),
      };
    case MessageKind.VOICE:
      return {
        kind: input.kind,
        mediaType: UploadMediaType.VOICE,
        text: input.text,
        uploadPaths: {
          filePath: input.filePath,
        },
        buildItem: (uploaded) => buildVoiceReplyItem(uploaded),
      };
    case MessageKind.FILE:
      return {
        kind: input.kind,
        mediaType: UploadMediaType.FILE,
        text: input.text,
        uploadPaths: {
          filePath: input.filePath,
        },
        buildItem: (uploaded) => buildFileReplyItem(input, uploaded),
      };
    case MessageKind.VIDEO:
      return {
        kind: input.kind,
        mediaType: UploadMediaType.VIDEO,
        text: input.text,
        uploadPaths: {
          filePath: input.filePath,
          thumbnailPath: input.thumbnailPath,
        },
        buildItem: (uploaded) => buildVideoReplyItem(uploaded),
      };
    default:
      return assertUnreachable(input);
  }
}
