import type { DebugLogger } from "../../core/debug.js";
import {
  createTimeoutError,
  describeError,
  isAbortError,
} from "../../core/errors.js";
import { buildCdnDownloadUrl, type DownloadErrorFactory } from "./url.js";

export type CdnDownloadRequest = {
  encryptedQueryParam?: string | undefined;
  downloadUrl?: string | undefined;
  cdnBaseUrl?: string | undefined;
  timeoutMs?: number | undefined;
  debug?: DebugLogger | undefined;
  label: string;
  createError: DownloadErrorFactory;
};

type CdnFetchParams = CdnDownloadRequest & {
  signal: AbortSignal;
  didTimeout: () => boolean;
  timeoutMs: number;
};

function resolveDownloadUrl(params: CdnDownloadRequest): string {
  if (params.downloadUrl) {
    return params.downloadUrl;
  }

  if (params.encryptedQueryParam) {
    return buildCdnDownloadUrl({
      encryptedQueryParam: params.encryptedQueryParam,
      cdnBaseUrl: params.cdnBaseUrl,
    });
  }

  throw params.createError(
    `${params.label} requires downloadUrl or encryptedQueryParam`,
  );
}

export async function fetchCdnResponse(
  params: CdnFetchParams,
): Promise<Response> {
  const url = resolveDownloadUrl(params);

  params.debug?.log("download.request", {
    kind: params.label,
    endpoint: new URL(url).pathname,
  });

  let response: Response;
  try {
    response = await fetch(url, {
      signal: params.signal,
    });
  } catch (error) {
    if (isAbortError(error)) {
      if (params.didTimeout()) {
        throw params.createError(
          `${params.label} CDN download timed out after ${params.timeoutMs}ms`,
          createTimeoutError(
            `${params.label} CDN download`,
            params.timeoutMs,
            error,
          ),
        );
      }
    }
    throw params.createError(
      `${params.label} CDN request failed: ${describeError(error)}`,
      error,
    );
  }

  if (!response.ok) {
    const body = await response.text().catch(() => "(unreadable)");
    throw params.createError(
      `${params.label} CDN download ${response.status} ${response.statusText}: ${body}`,
    );
  }

  return response;
}
