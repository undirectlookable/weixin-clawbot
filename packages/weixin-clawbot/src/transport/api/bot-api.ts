import type { DebugLogger } from "../../core/debug.js";
import { isTimeoutError } from "../../core/errors.js";
import type {
  GetConfigResp,
  GetUpdatesReq,
  GetUpdatesResp,
  GetUploadUrlReq,
  GetUploadUrlResp,
  SendMessageReq,
  SendMessageResp,
  SendTypingReq,
  SendTypingResp,
} from "../../protocol/api.js";
import {
  API_TIMEOUTS,
  buildBaseInfo,
  createWeixinApiClient,
  type WeixinApiOptions,
} from "./client.js";

type WithBaseInfo<TBody extends object> = TBody & {
  base_info: ReturnType<typeof buildBaseInfo>;
};

function createClient(params: {
  baseUrl: string;
  token?: string | undefined;
  debug?: DebugLogger | undefined;
}) {
  return createWeixinApiClient({
    baseUrl: params.baseUrl,
    token: params.token,
    debug: params.debug,
  });
}

function withBaseInfo<TBody extends object>(body: TBody): WithBaseInfo<TBody> {
  return {
    ...body,
    base_info: buildBaseInfo(),
  };
}

export async function getUpdates(
  params: GetUpdatesReq & {
    baseUrl: string;
    token?: string | undefined;
    timeoutMs?: number | undefined;
    signal?: AbortSignal | undefined;
    debug?: DebugLogger | undefined;
  },
): Promise<GetUpdatesResp> {
  const timeoutMs = params.timeoutMs ?? API_TIMEOUTS.longPoll;
  const debug = params.debug;

  try {
    return await createClient(params).json<
      GetUpdatesResp,
      WithBaseInfo<{ get_updates_buf: string }>
    >({
      endpoint: "ilink/bot/getupdates",
      timeoutMs,
      signal: params.signal,
      body: withBaseInfo({
        get_updates_buf: params.get_updates_buf ?? "",
      }),
    });
  } catch (error) {
    if (isTimeoutError(error)) {
      debug?.log("poll.timeout", {
        timeoutMs,
        syncCursorPresent: Boolean(params.get_updates_buf),
      });
      return {
        ret: 0,
        msgs: [],
        get_updates_buf: params.get_updates_buf ?? "",
      };
    }
    throw error;
  }
}

export async function sendMessage(
  params: WeixinApiOptions & { body: SendMessageReq },
): Promise<void> {
  const rawText = await createClient(params).text({
    endpoint: "ilink/bot/sendmessage",
    timeoutMs: params.timeoutMs ?? API_TIMEOUTS.default,
    body: JSON.stringify(withBaseInfo(params.body)),
    debug: params.debug,
  });

  const trimmed = rawText.trim();
  if (!trimmed) {
    return;
  }

  let response: SendMessageResp;
  try {
    response = JSON.parse(trimmed) as SendMessageResp;
  } catch {
    return;
  }

  if (
    (response.ret !== undefined && response.ret !== 0) ||
    (response.errcode !== undefined && response.errcode !== 0)
  ) {
    throw new Error(
      `sendMessage failed: ret=${response.ret ?? ""} errcode=${response.errcode ?? ""} errmsg=${response.errmsg ?? ""}`,
    );
  }
}

export async function getUploadUrl(
  params: WeixinApiOptions & GetUploadUrlReq,
): Promise<GetUploadUrlResp> {
  return createClient(params).json<
    GetUploadUrlResp,
    WithBaseInfo<GetUploadUrlReq>
  >({
    endpoint: "ilink/bot/getuploadurl",
    timeoutMs: params.timeoutMs ?? API_TIMEOUTS.default,
    body: withBaseInfo({
      filekey: params.filekey,
      media_type: params.media_type,
      to_user_id: params.to_user_id,
      rawsize: params.rawsize,
      rawfilemd5: params.rawfilemd5,
      filesize: params.filesize,
      thumb_rawsize: params.thumb_rawsize,
      thumb_rawfilemd5: params.thumb_rawfilemd5,
      thumb_filesize: params.thumb_filesize,
      no_need_thumb: params.no_need_thumb,
      aeskey: params.aeskey,
    }),
    debug: params.debug,
  });
}

export async function getConfig(
  params: WeixinApiOptions & {
    ilinkUserId: string;
    contextToken?: string | undefined;
  },
): Promise<GetConfigResp> {
  return createClient(params).json<
    GetConfigResp,
    WithBaseInfo<{ ilink_user_id: string; context_token?: string | undefined }>
  >({
    endpoint: "ilink/bot/getconfig",
    timeoutMs: params.timeoutMs ?? API_TIMEOUTS.config,
    body: withBaseInfo({
      ilink_user_id: params.ilinkUserId,
      context_token: params.contextToken,
    }),
    debug: params.debug,
  });
}

export async function sendTyping(
  params: WeixinApiOptions & { body: SendTypingReq },
): Promise<SendTypingResp> {
  return createClient(params).json<SendTypingResp, WithBaseInfo<SendTypingReq>>(
    {
      endpoint: "ilink/bot/sendtyping",
      timeoutMs: params.timeoutMs ?? API_TIMEOUTS.config,
      body: withBaseInfo(params.body),
      debug: params.debug,
    },
  );
}
