import { CDN_BASE_URL } from "../../core/constants.js";
import { createScopedError } from "../../core/errors.js";

export type DownloadErrorFactory = (message: string, cause?: unknown) => Error;

function defaultCreateError(message: string, cause?: unknown): Error {
  return createScopedError("download", message, cause);
}

export function buildCdnDownloadUrl(params: {
  encryptedQueryParam: string;
  cdnBaseUrl?: string | undefined;
}): string {
  const base = (params.cdnBaseUrl ?? CDN_BASE_URL).endsWith("/")
    ? (params.cdnBaseUrl ?? CDN_BASE_URL)
    : `${params.cdnBaseUrl ?? CDN_BASE_URL}/`;
  const url = new URL("download", base);
  url.searchParams.set("encrypted_query_param", params.encryptedQueryParam);
  return url.toString();
}

export function parseHexAesKey(
  value: string,
  label: string,
  createError: DownloadErrorFactory = defaultCreateError,
): Buffer {
  if (!/^[0-9a-fA-F]{32}$/.test(value)) {
    throw createError(`${label} aeskey must be a 32-char hex string`);
  }

  return Buffer.from(value, "hex");
}

export function parseMediaAesKeyBase64(
  value: string,
  label: string,
  createError: DownloadErrorFactory = defaultCreateError,
): Buffer {
  const decoded = Buffer.from(value, "base64");
  if (decoded.length === 16) {
    return decoded;
  }

  const decodedAscii = decoded.toString("ascii");
  if (decoded.length === 32 && /^[0-9a-fA-F]{32}$/.test(decodedAscii)) {
    return Buffer.from(decodedAscii, "hex");
  }

  throw createError(
    `${label} aes_key must decode to 16 raw bytes or a 32-char hex string`,
  );
}
