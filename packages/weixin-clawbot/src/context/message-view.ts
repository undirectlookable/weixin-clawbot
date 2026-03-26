import { MessageItemType } from "../protocol/enums.js";
import type {
  CDNMedia,
  MessageItem,
  WeixinMessage,
} from "../protocol/message.js";
import {
  type BotMediaHandle,
  type BotMessage,
  type BotMessageBase,
  MessageKind,
} from "../public-types.js";

function resolveMessageId(
  message: WeixinMessage,
  item: MessageItem | undefined,
): string | undefined {
  if (item?.msg_id) {
    return item.msg_id;
  }

  if (message.message_id !== undefined) {
    return String(message.message_id);
  }

  return undefined;
}

function createMessageBase(
  message: WeixinMessage,
  fallbackFromUserId: string,
  item: MessageItem | undefined,
): BotMessageBase {
  return {
    id: resolveMessageId(message, item),
    fromUserId: message.from_user_id ?? fallbackFromUserId,
    toUserId: message.to_user_id,
    createdAtMs: item?.create_time_ms ?? message.create_time_ms,
    updatedAtMs: item?.update_time_ms ?? message.update_time_ms,
    contextToken: message.context_token,
  };
}

function toBotMediaHandle(
  media: CDNMedia | undefined,
): BotMediaHandle | undefined {
  if (!media) {
    return undefined;
  }

  return {
    encryptQueryParam: media.encrypt_query_param,
    aesKey: media.aes_key,
    encryptType: media.encrypt_type,
  };
}

export function toBotMessage(
  message: WeixinMessage,
  fallbackFromUserId: string,
): BotMessage {
  const item = message.item_list?.[0];
  const base = createMessageBase(message, fallbackFromUserId, item);

  switch (item?.type) {
    case MessageItemType.TEXT:
      return {
        ...base,
        kind: MessageKind.TEXT,
        text: item.text_item?.text ?? "",
      };

    case MessageItemType.IMAGE:
      return {
        ...base,
        kind: MessageKind.IMAGE,
        media: toBotMediaHandle(item.image_item?.media),
        thumbnailMedia: toBotMediaHandle(item.image_item?.thumb_media),
        sizeBytes: item.image_item?.hd_size ?? item.image_item?.mid_size,
        thumbnailSizeBytes: item.image_item?.thumb_size,
        width: item.image_item?.thumb_width,
        height: item.image_item?.thumb_height,
      };

    case MessageItemType.VOICE:
      return {
        ...base,
        kind: MessageKind.VOICE,
        media: toBotMediaHandle(item.voice_item?.media),
        durationMs: item.voice_item?.playtime,
        transcript: item.voice_item?.text,
      };

    case MessageItemType.FILE:
      return {
        ...base,
        kind: MessageKind.FILE,
        media: toBotMediaHandle(item.file_item?.media),
        fileName: item.file_item?.file_name,
        sizeBytes:
          item.file_item?.len === undefined
            ? undefined
            : Number(item.file_item.len),
      };

    case MessageItemType.VIDEO:
      return {
        ...base,
        kind: MessageKind.VIDEO,
        media: toBotMediaHandle(item.video_item?.media),
        thumbnailMedia: toBotMediaHandle(item.video_item?.thumb_media),
        durationMs: item.video_item?.play_length,
        sizeBytes: item.video_item?.video_size,
        thumbnailSizeBytes: item.video_item?.thumb_size,
      };

    default:
      return {
        ...base,
        kind: MessageKind.UNKNOWN,
      };
  }
}
