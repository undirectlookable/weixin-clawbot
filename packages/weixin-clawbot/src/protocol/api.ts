import type { WeixinMessage } from "./message.js";

export interface BaseInfo {
  channel_version?: string | undefined;
}

export interface GetUpdatesReq {
  get_updates_buf?: string | undefined;
}

export interface GetUpdatesResp {
  ret?: number | undefined;
  errcode?: number | undefined;
  errmsg?: string | undefined;
  msgs?: WeixinMessage[] | undefined;
  get_updates_buf?: string | undefined;
  longpolling_timeout_ms?: number | undefined;
}

export interface SendMessageReq {
  msg?: WeixinMessage | undefined;
}

export interface SendMessageResp {
  ret?: number | undefined;
  errcode?: number | undefined;
  errmsg?: string | undefined;
}

export interface GetUploadUrlReq {
  filekey?: string | undefined;
  media_type?: number | undefined;
  to_user_id?: string | undefined;
  rawsize?: number | undefined;
  rawfilemd5?: string | undefined;
  filesize?: number | undefined;
  thumb_rawsize?: number | undefined;
  thumb_rawfilemd5?: string | undefined;
  thumb_filesize?: number | undefined;
  no_need_thumb?: boolean | undefined;
  aeskey?: string | undefined;
}

export interface GetUploadUrlResp {
  upload_param?: string | undefined;
  thumb_upload_param?: string | undefined;
}

export interface SendTypingReq {
  ilink_user_id?: string | undefined;
  typing_ticket?: string | undefined;
  status?: number | undefined;
}

export interface SendTypingResp {
  ret?: number | undefined;
  errmsg?: string | undefined;
}

export interface GetConfigResp {
  ret?: number | undefined;
  errmsg?: string | undefined;
  typing_ticket?: string | undefined;
}
