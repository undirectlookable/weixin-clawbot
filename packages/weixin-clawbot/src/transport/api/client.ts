import {
  CHANNEL_VERSION,
  DEFAULT_API_TIMEOUT_MS,
  DEFAULT_CONFIG_TIMEOUT_MS,
  DEFAULT_LONG_POLL_TIMEOUT_MS,
} from "../../core/constants.js";
import type { DebugLogger } from "../../core/debug.js";
import type { BaseInfo } from "../../protocol/api.js";
import { type ApiFetchParams, apiFetch, parseJsonResponse } from "./request.js";

export type WeixinApiOptions = {
  baseUrl: string;
  token?: string | undefined;
  timeoutMs?: number | undefined;
  debug?: DebugLogger | undefined;
};

type ApiJsonRequestParams<TBody> = {
  endpoint: string;
  method?: ApiFetchParams["method"];
  timeoutMs: number;
  signal?: AbortSignal | undefined;
  body?: TBody | undefined;
  headers?: Record<string, string> | undefined;
  debug?: DebugLogger | undefined;
};

export const API_TIMEOUTS = {
  default: DEFAULT_API_TIMEOUT_MS,
  config: DEFAULT_CONFIG_TIMEOUT_MS,
  longPoll: DEFAULT_LONG_POLL_TIMEOUT_MS,
} as const;

export function buildBaseInfo(): BaseInfo {
  return { channel_version: CHANNEL_VERSION };
}

export class WeixinApiClient {
  constructor(
    private readonly options: Pick<
      WeixinApiOptions,
      "baseUrl" | "token" | "debug"
    >,
  ) {}

  async text(
    params: Omit<ApiFetchParams, "baseUrl" | "token">,
  ): Promise<string> {
    return apiFetch({
      ...params,
      baseUrl: this.options.baseUrl,
      token: this.options.token,
      debug: this.options.debug,
    });
  }

  async json<TResponse, TBody = never>(
    params: ApiJsonRequestParams<TBody>,
  ): Promise<TResponse> {
    const rawText = await this.text({
      endpoint: params.endpoint,
      method: params.method,
      timeoutMs: params.timeoutMs,
      signal: params.signal,
      body: params.body === undefined ? undefined : JSON.stringify(params.body),
      headers: params.headers,
      debug: params.debug ?? this.options.debug,
    });

    return parseJsonResponse<TResponse>(rawText, params.endpoint);
  }
}

export function createWeixinApiClient(
  options: Pick<WeixinApiOptions, "baseUrl" | "token" | "debug">,
): WeixinApiClient {
  return new WeixinApiClient(options);
}
