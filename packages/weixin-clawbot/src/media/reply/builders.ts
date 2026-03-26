import crypto from "node:crypto";

import type { SendMessageReq } from "../../protocol/api.js";
import { MessageState, MessageType } from "../../protocol/enums.js";
import type { CDNMedia, MessageItem } from "../../protocol/message.js";

export function buildBaseMessageItem(params: {
  toUserId: string;
  contextToken?: string | undefined;
  clientId: string;
  item: MessageItem;
}): SendMessageReq {
  return {
    msg: {
      from_user_id: "",
      to_user_id: params.toUserId,
      client_id: params.clientId,
      message_type: MessageType.BOT,
      message_state: MessageState.FINISH,
      item_list: [params.item],
      context_token: params.contextToken,
    },
  };
}

export function makeClientId(): string {
  return `${Date.now()}-${crypto.randomBytes(8).toString("hex")}`;
}

function encodeAesKeyBase64(aeskeyHex: string): string {
  // Match the original project wire format: base64 of the 32-char hex string.
  return Buffer.from(aeskeyHex, "utf-8").toString("base64");
}

export function buildEncryptedMedia(params: {
  encryptQueryParam: string;
  aeskeyHex: string;
}): CDNMedia {
  return {
    encrypt_query_param: params.encryptQueryParam,
    aes_key: encodeAesKeyBase64(params.aeskeyHex),
    encrypt_type: 1,
  };
}
