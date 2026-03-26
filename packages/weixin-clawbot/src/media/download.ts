import type { DebugLogger } from "../core/debug.js";
import { createScopedError } from "../core/errors.js";
import type { WeixinMessage } from "../protocol/message.js";
import {
  downloadCdnBuffer,
  downloadCdnToWriter,
} from "../transport/cdn/download.js";
import { resolveDownloadSource } from "./download-source.js";

function createDownloadMediaError(message: string, cause?: unknown): Error {
  return createScopedError("downloadMedia", message, cause);
}

type DownloadMediaParams = {
  message: WeixinMessage;
  cdnBaseUrl?: string | undefined;
  debug?: DebugLogger | undefined;
};

function resolveCdnDownloadParams(params: DownloadMediaParams) {
  const source = resolveDownloadSource(
    params.message,
    createDownloadMediaError,
  );
  return {
    encryptedQueryParam: source.encryptedQueryParam,
    cdnBaseUrl: params.cdnBaseUrl,
    debug: params.debug,
    label: source.kind,
    createError: createDownloadMediaError,
    aesKey: source.aesKey,
  };
}

export async function downloadMediaBuffer(params: {
  message: WeixinMessage;
  cdnBaseUrl?: string | undefined;
  debug?: DebugLogger | undefined;
}): Promise<Buffer> {
  return downloadCdnBuffer(resolveCdnDownloadParams(params));
}

export async function downloadMediaToWriter(params: {
  message: WeixinMessage;
  writable: NodeJS.WritableStream;
  cdnBaseUrl?: string | undefined;
  debug?: DebugLogger | undefined;
}): Promise<void> {
  await downloadCdnToWriter({
    ...resolveCdnDownloadParams(params),
    writable: params.writable,
  });
}
