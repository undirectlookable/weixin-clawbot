import { MessageItemType } from "../protocol/enums.js";
import type { WeixinMessage } from "../protocol/message.js";
import { MessageKind } from "../public-types.js";
import {
  type DownloadErrorFactory,
  parseHexAesKey,
  parseMediaAesKeyBase64,
} from "../transport/cdn/url.js";

type DownloadableMessageKind =
  | typeof MessageKind.IMAGE
  | typeof MessageKind.VOICE
  | typeof MessageKind.FILE
  | typeof MessageKind.VIDEO;

export type ResolvedDownloadSource = {
  kind: DownloadableMessageKind;
  encryptedQueryParam: string;
  aesKey: Buffer;
};

type EncodedMedia = {
  encrypt_query_param?: string | undefined;
  aes_key?: string | undefined;
};

function getFirstMessageItem(message: WeixinMessage) {
  return message.item_list?.[0];
}

function requireEncryptedQueryParam(
  value: string | undefined,
  label: string,
  createError: DownloadErrorFactory,
): string {
  if (!value) {
    throw createError(`${label} message is missing media.encrypt_query_param`);
  }

  return value;
}

function resolveEncodedMediaSource(params: {
  kind: DownloadableMessageKind;
  label: string;
  media: EncodedMedia | null | undefined;
  createError: DownloadErrorFactory;
}): ResolvedDownloadSource {
  const encryptedQueryParam = requireEncryptedQueryParam(
    params.media?.encrypt_query_param,
    params.label,
    params.createError,
  );

  if (!params.media?.aes_key) {
    throw params.createError(
      `${params.label} message is missing media.aes_key`,
    );
  }

  return {
    kind: params.kind,
    encryptedQueryParam,
    aesKey: parseMediaAesKeyBase64(
      params.media.aes_key,
      params.label,
      params.createError,
    ),
  };
}

function resolveImageSource(
  message: WeixinMessage,
  createError: DownloadErrorFactory,
): ResolvedDownloadSource {
  const media = getFirstMessageItem(message)?.image_item?.media;
  const encryptedQueryParam = requireEncryptedQueryParam(
    media?.encrypt_query_param,
    "image",
    createError,
  );
  const aeskeyHex = getFirstMessageItem(message)?.image_item?.aeskey;

  if (aeskeyHex) {
    return {
      kind: MessageKind.IMAGE,
      encryptedQueryParam,
      aesKey: parseHexAesKey(aeskeyHex, "image", createError),
    };
  }

  if (!media?.aes_key) {
    throw createError(
      "image message is missing image_item.aeskey or media.aes_key",
    );
  }

  return {
    kind: MessageKind.IMAGE,
    encryptedQueryParam,
    aesKey: parseMediaAesKeyBase64(media.aes_key, "image", createError),
  };
}

export function resolveDownloadSource(
  message: WeixinMessage,
  createError: DownloadErrorFactory,
): ResolvedDownloadSource {
  const item = getFirstMessageItem(message);
  if (!item) {
    throw createError("message has no media item");
  }

  switch (item.type) {
    case MessageItemType.IMAGE:
      return resolveImageSource(message, createError);
    case MessageItemType.VOICE:
      return resolveEncodedMediaSource({
        kind: MessageKind.VOICE,
        label: "voice",
        media: item.voice_item?.media,
        createError,
      });
    case MessageItemType.FILE:
      return resolveEncodedMediaSource({
        kind: MessageKind.FILE,
        label: "file",
        media: item.file_item?.media,
        createError,
      });
    case MessageItemType.VIDEO:
      return resolveEncodedMediaSource({
        kind: MessageKind.VIDEO,
        label: "video",
        media: item.video_item?.media,
        createError,
      });
    case MessageItemType.TEXT:
      throw createError("text messages do not have downloadable media");
    default:
      throw createError(
        "the current message does not expose downloadable media",
      );
  }
}
