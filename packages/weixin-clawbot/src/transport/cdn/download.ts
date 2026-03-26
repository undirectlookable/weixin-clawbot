import { Readable } from "node:stream";
import { pipeline } from "node:stream/promises";
import type { ReadableStream as NodeReadableStream } from "node:stream/web";

import { DEFAULT_CDN_TIMEOUT_MS } from "../../core/constants.js";
import { describeError, isAbortError } from "../../core/errors.js";
import { createRequestTimeoutController } from "../timeout.js";
import { createAesEcbDecipher, decryptAesEcb } from "./crypto.js";
import { type CdnDownloadRequest, fetchCdnResponse } from "./fetch.js";
import {
  buildCdnDownloadUrl,
  type DownloadErrorFactory,
  parseHexAesKey,
  parseMediaAesKeyBase64,
} from "./url.js";

type CdnDecryptParams = CdnDownloadRequest & {
  aesKey: Buffer;
};

function isTimedOutAbort(
  error: unknown,
  didTimeout: () => boolean,
): error is Error {
  return isAbortError(error) && didTimeout();
}

function createCdnFailureError(params: {
  error: unknown;
  label: string;
  createError: DownloadErrorFactory;
  scope: string;
}): Error {
  return params.createError(
    `${params.label} ${params.scope}: ${describeError(params.error)}`,
    params.error,
  );
}

function normalizeUnknownError(
  error: unknown,
  createError: DownloadErrorFactory,
): Error {
  if (error instanceof Error) {
    return error;
  }

  return createError(String(error), error);
}

export { buildCdnDownloadUrl, parseHexAesKey, parseMediaAesKeyBase64 };

export async function downloadCdnBuffer(
  params: CdnDecryptParams,
): Promise<Buffer> {
  const timeoutMs = params.timeoutMs ?? DEFAULT_CDN_TIMEOUT_MS;
  const requestTimeout = createRequestTimeoutController(timeoutMs);
  let encrypted: Buffer;

  try {
    const response = await fetchCdnResponse({
      ...params,
      signal: requestTimeout.signal,
      didTimeout: requestTimeout.didTimeout,
      timeoutMs,
    });
    try {
      encrypted = Buffer.from(await response.arrayBuffer());
    } catch (error) {
      if (isTimedOutAbort(error, requestTimeout.didTimeout)) {
        throw params.createError(
          `${params.label} CDN download timed out after ${timeoutMs}ms`,
          error,
        );
      }
      throw createCdnFailureError({
        error,
        label: params.label,
        createError: params.createError,
        scope: "CDN request failed",
      });
    }
  } catch (error) {
    throw normalizeUnknownError(error, params.createError);
  } finally {
    requestTimeout.cleanup();
  }

  params.debug?.log("download.decrypt", {
    kind: params.label,
    encryptedSize: encrypted.byteLength,
  });

  try {
    const decrypted = decryptAesEcb(encrypted, params.aesKey);
    params.debug?.log("download.success", {
      kind: params.label,
      decryptedSize: decrypted.byteLength,
    });
    return decrypted;
  } catch (error) {
    throw params.createError(
      `${params.label} decrypt failed: ${describeError(error)}`,
      error,
    );
  }
}

export async function downloadCdnToWriter(
  params: CdnDecryptParams & {
    writable: NodeJS.WritableStream;
  },
): Promise<void> {
  const timeoutMs = params.timeoutMs ?? DEFAULT_CDN_TIMEOUT_MS;
  const requestTimeout = createRequestTimeoutController(timeoutMs);
  let response: Response;

  try {
    response = await fetchCdnResponse({
      ...params,
      signal: requestTimeout.signal,
      didTimeout: requestTimeout.didTimeout,
      timeoutMs,
    });
  } catch (error) {
    requestTimeout.cleanup();
    if (error instanceof Error) {
      throw error;
    }
    throw params.createError(String(error), error);
  }

  if (!response.body) {
    requestTimeout.cleanup();
    throw params.createError(`${params.label} CDN response body is missing`);
  }

  params.debug?.log("download.stream.start", {
    kind: params.label,
  });

  try {
    await pipeline(
      Readable.fromWeb(
        response.body as unknown as NodeReadableStream<Uint8Array>,
      ),
      createAesEcbDecipher(params.aesKey),
      params.writable,
    );
    params.debug?.log("download.stream.success", {
      kind: params.label,
    });
  } catch (error) {
    if (isTimedOutAbort(error, requestTimeout.didTimeout)) {
      throw params.createError(
        `${params.label} stream download timed out after ${timeoutMs}ms`,
        error,
      );
    }
    throw createCdnFailureError({
      error,
      label: params.label,
      createError: params.createError,
      scope: "stream download failed",
    });
  } finally {
    requestTimeout.cleanup();
  }
}
