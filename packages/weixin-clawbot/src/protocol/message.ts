export interface TextItem {
  text?: string | undefined;
}

export interface CDNMedia {
  encrypt_query_param?: string | undefined;
  aes_key?: string | undefined;
  encrypt_type?: number | undefined;
}

export interface ImageItem {
  media?: CDNMedia | undefined;
  thumb_media?: CDNMedia | undefined;
  aeskey?: string | undefined;
  url?: string | undefined;
  mid_size?: number | undefined;
  thumb_size?: number | undefined;
  thumb_height?: number | undefined;
  thumb_width?: number | undefined;
  hd_size?: number | undefined;
}

export interface VoiceItem {
  media?: CDNMedia | undefined;
  encode_type?: number | undefined;
  bits_per_sample?: number | undefined;
  sample_rate?: number | undefined;
  playtime?: number | undefined;
  text?: string | undefined;
}

export interface FileItem {
  media?: CDNMedia | undefined;
  file_name?: string | undefined;
  md5?: string | undefined;
  len?: string | undefined;
}

export interface VideoItem {
  media?: CDNMedia | undefined;
  video_size?: number | undefined;
  play_length?: number | undefined;
  video_md5?: string | undefined;
  thumb_media?: CDNMedia | undefined;
  thumb_size?: number | undefined;
  thumb_height?: number | undefined;
  thumb_width?: number | undefined;
}

export interface RefMessage {
  message_item?: MessageItem | undefined;
  title?: string | undefined;
}

export interface MessageItem {
  type?: number | undefined;
  create_time_ms?: number | undefined;
  update_time_ms?: number | undefined;
  is_completed?: boolean | undefined;
  msg_id?: string | undefined;
  ref_msg?: RefMessage | undefined;
  text_item?: TextItem | undefined;
  image_item?: ImageItem | undefined;
  voice_item?: VoiceItem | undefined;
  file_item?: FileItem | undefined;
  video_item?: VideoItem | undefined;
}

export interface WeixinMessage {
  seq?: number | undefined;
  message_id?: number | undefined;
  from_user_id?: string | undefined;
  to_user_id?: string | undefined;
  client_id?: string | undefined;
  create_time_ms?: number | undefined;
  update_time_ms?: number | undefined;
  delete_time_ms?: number | undefined;
  session_id?: string | undefined;
  group_id?: string | undefined;
  message_type?: number | undefined;
  message_state?: number | undefined;
  item_list?: MessageItem[] | undefined;
  context_token?: string | undefined;
}
