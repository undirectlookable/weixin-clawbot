import type { DebugLogger } from "../../core/debug.js";
import { isTimeoutError } from "../../core/errors.js";
import { API_TIMEOUTS, createWeixinApiClient } from "./client.js";

export type WeixinQrStatus = {
  status: "wait" | "scaned" | "confirmed" | "expired";
  bot_token?: string | undefined;
  ilink_bot_id?: string | undefined;
  baseurl?: string | undefined;
  ilink_user_id?: string | undefined;
};

export async function fetchQrCode(params: {
  baseUrl: string;
  botType?: string | undefined;
  timeoutMs?: number | undefined;
  debug?: DebugLogger | undefined;
}): Promise<{ qrcode: string; qrcode_img_content: string }> {
  return createWeixinApiClient({
    baseUrl: params.baseUrl,
    debug: params.debug,
  }).json<{
    qrcode: string;
    qrcode_img_content: string;
  }>({
    endpoint: `ilink/bot/get_bot_qrcode?bot_type=${encodeURIComponent(params.botType ?? "3")}`,
    method: "GET",
    timeoutMs: params.timeoutMs ?? API_TIMEOUTS.default,
  });
}

export async function fetchQrStatus(params: {
  baseUrl: string;
  qrcode: string;
  timeoutMs?: number | undefined;
  debug?: DebugLogger | undefined;
}): Promise<WeixinQrStatus> {
  try {
    return await createWeixinApiClient({
      baseUrl: params.baseUrl,
      debug: params.debug,
    }).json<WeixinQrStatus>({
      endpoint: `ilink/bot/get_qrcode_status?qrcode=${encodeURIComponent(params.qrcode)}`,
      method: "GET",
      timeoutMs: params.timeoutMs ?? API_TIMEOUTS.longPoll,
      headers: {
        "iLink-App-ClientVersion": "1",
      },
    });
  } catch (error) {
    if (isTimeoutError(error)) {
      params.debug?.log("qr.status.wait", {
        timeoutMs: params.timeoutMs ?? API_TIMEOUTS.longPoll,
      });
      return { status: "wait" };
    }
    throw error;
  }
}
