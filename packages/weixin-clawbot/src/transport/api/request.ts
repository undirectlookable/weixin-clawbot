import crypto from "node:crypto";

import type { DebugLogger } from "../../core/debug.js";
import {
  createTimeoutError,
  isAbortError,
  wrapError,
} from "../../core/errors.js";
import { createRequestTimeoutController } from "../timeout.js";

export type HttpMethod = "GET" | "POST";

export type ApiFetchParams = {
  baseUrl: string;
  endpoint: string;
  method?: HttpMethod | undefined;
  token?: string | undefined;
  body?: string | undefined;
  timeoutMs: number;
  signal?: AbortSignal | undefined;
  headers?: Record<string, string> | undefined;
  debug?: DebugLogger | undefined;
};

function ensureTrailingSlash(url: string): string {
  return url.endsWith("/") ? url : `${url}/`;
}

function randomWechatUin(): string {
  const uint32 = crypto.randomBytes(4).readUInt32BE(0);
  return Buffer.from(String(uint32), "utf-8").toString("base64");
}

function buildHeaders(params: {
  token?: string | undefined;
  body?: string | undefined;
  extraHeaders?: Record<string, string> | undefined;
}): Record<string, string> {
  const headers: Record<string, string> = {
    ...(params.extraHeaders ?? {}),
    SKRouteTag: "",
  };

  if (params.body !== undefined) {
    headers["Content-Type"] = "application/json";
    headers["Content-Length"] = String(Buffer.byteLength(params.body, "utf-8"));
    headers.AuthorizationType = "ilink_bot_token";
    headers["X-WECHAT-UIN"] = randomWechatUin();

    if (params.token?.trim()) {
      headers.Authorization = `Bearer ${params.token.trim()}`;
    }
  }

  return headers;
}

function parseDebugPayload(rawText: string | undefined): unknown {
  if (rawText === undefined) {
    return undefined;
  }

  try {
    return JSON.parse(rawText) as unknown;
  } catch {
    return rawText;
  }
}

export function parseJsonResponse<T>(rawText: string, endpoint: string): T {
  try {
    return JSON.parse(rawText) as T;
  } catch (error) {
    throw wrapError(`Invalid JSON response from ${endpoint}`, error);
  }
}

export async function apiFetch(params: ApiFetchParams): Promise<string> {
  const url = new URL(params.endpoint, ensureTrailingSlash(params.baseUrl));
  const requestTimeout = createRequestTimeoutController(
    params.timeoutMs,
    params.signal,
  );
  const method = params.method ?? "POST";
  const headers = buildHeaders({
    token: params.token,
    body: params.body,
    extraHeaders: params.headers,
  });
  let status: number | undefined;
  let rawText: string | undefined;
  const startedAt = Date.now();

  try {
    const requestInit: RequestInit = {
      method,
      headers,
      signal: requestTimeout.signal,
    };

    if (params.body !== undefined) {
      requestInit.body = params.body;
    }

    params.debug?.log("request.start", {
      method,
      endpoint: url.pathname,
      origin: url.origin,
      timeoutMs: params.timeoutMs,
      headers,
      body: parseDebugPayload(params.body),
    });

    const response = await fetch(url.toString(), requestInit);
    status = response.status;
    rawText = await response.text();
    if (!response.ok) {
      throw new Error(
        `${method} ${url.pathname} ${response.status}: ${rawText}`,
      );
    }

    params.debug?.log("request.success", {
      method,
      endpoint: url.pathname,
      status,
      durationMs: Date.now() - startedAt,
      response: parseDebugPayload(rawText),
    });
    return rawText;
  } catch (error) {
    if (isAbortError(error)) {
      params.debug?.log("request.aborted", {
        method,
        endpoint: url.pathname,
        timeoutMs: params.timeoutMs,
        didTimeout: requestTimeout.didTimeout(),
        externallyAborted: Boolean(params.signal?.aborted),
      });
      if (requestTimeout.didTimeout()) {
        throw createTimeoutError(
          `${method} ${url.pathname}`,
          params.timeoutMs,
          error,
        );
      }
    } else {
      params.debug?.log("request.failed", {
        method,
        endpoint: url.pathname,
        status,
        durationMs: Date.now() - startedAt,
        response: parseDebugPayload(rawText),
        error,
      });
    }
    throw error;
  } finally {
    requestTimeout.cleanup();
  }
}
