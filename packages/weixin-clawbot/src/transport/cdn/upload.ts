import {
  DEFAULT_CDN_TIMEOUT_MS,
  UPLOAD_MAX_RETRIES,
} from "../../core/constants.js";
import type { DebugLogger } from "../../core/debug.js";
import {
  createTimeoutError,
  describeError,
  isAbortError,
  toError,
  wrapError,
} from "../../core/errors.js";
import { createRequestTimeoutController } from "../timeout.js";
import { encryptAesEcb } from "./crypto.js";

function buildCdnUploadUrl(params: {
  cdnBaseUrl: string;
  uploadParam: string;
  filekey: string;
}): string {
  const base = params.cdnBaseUrl.endsWith("/")
    ? params.cdnBaseUrl
    : `${params.cdnBaseUrl}/`;
  const url = new URL("upload", base);
  url.searchParams.set("encrypted_query_param", params.uploadParam);
  url.searchParams.set("filekey", params.filekey);
  return url.toString();
}

export async function uploadBufferToCdn(params: {
  plaintext: Buffer;
  uploadParam: string;
  filekey: string;
  cdnBaseUrl: string;
  aeskey: Buffer;
  timeoutMs?: number | undefined;
  debug?: DebugLogger | undefined;
}): Promise<string> {
  const ciphertext = encryptAesEcb(params.plaintext, params.aeskey);
  const url = buildCdnUploadUrl({
    cdnBaseUrl: params.cdnBaseUrl,
    uploadParam: params.uploadParam,
    filekey: params.filekey,
  });
  const debug = params.debug;
  const timeoutMs = params.timeoutMs ?? DEFAULT_CDN_TIMEOUT_MS;

  debug?.log("upload.prepare", {
    endpoint: new URL(url).pathname,
    plaintextSize: params.plaintext.byteLength,
    ciphertextSize: ciphertext.byteLength,
  });

  let lastError: unknown;
  for (let attempt = 1; attempt <= UPLOAD_MAX_RETRIES; attempt += 1) {
    debug?.log("upload.attempt", { attempt });
    try {
      const requestTimeout = createRequestTimeoutController(timeoutMs);
      let res: Response;

      try {
        res = await fetch(url, {
          method: "POST",
          headers: { "Content-Type": "application/octet-stream" },
          body: new Uint8Array(ciphertext),
          signal: requestTimeout.signal,
        });
      } catch (error) {
        if (isAbortError(error) && requestTimeout.didTimeout()) {
          throw createTimeoutError("CDN upload", timeoutMs, error);
        }
        throw wrapError("CDN upload request failed", error);
      } finally {
        requestTimeout.cleanup();
      }

      if (res.status >= 400 && res.status < 500) {
        const errMsg = res.headers.get("x-error-message") ?? (await res.text());
        throw new Error(`CDN upload client error ${res.status}: ${errMsg}`);
      }
      if (res.status !== 200) {
        const errMsg =
          res.headers.get("x-error-message") ?? `status ${res.status}`;
        throw new Error(`CDN upload server error ${res.status}: ${errMsg}`);
      }
      const downloadParam = res.headers.get("x-encrypted-param") ?? undefined;
      if (!downloadParam) {
        throw new Error("CDN upload response missing x-encrypted-param header");
      }
      debug?.log("upload.success", {
        attempt,
        status: res.status,
        ciphertextSize: ciphertext.byteLength,
      });
      return downloadParam;
    } catch (error) {
      lastError = error;
      debug?.log("upload.failed", { attempt, error: toError(error) });
      if (error instanceof Error && error.message.includes("client error")) {
        throw error;
      }
    }
  }

  if (lastError instanceof Error) {
    throw lastError;
  }

  throw new Error(
    `CDN upload failed after ${UPLOAD_MAX_RETRIES} attempts: ${describeError(lastError)}`,
  );
}
