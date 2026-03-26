import { CDN_BASE_URL } from "../core/constants.js";
import type { DebugLogger } from "../core/debug.js";
import { createScopedError, describeError } from "../core/errors.js";
import { UploadMediaType } from "../protocol/enums.js";
import type {
  DownloadFileOptions,
  DownloadFileToOptions,
  UploadedFileHandle,
  UploadFileOptions,
} from "../public-types.js";
import {
  downloadCdnBuffer,
  downloadCdnToWriter,
} from "../transport/cdn/download.js";
import { buildCdnDownloadUrl, parseHexAesKey } from "../transport/cdn/url.js";
import type { UploadedMedia } from "./upload.js";
import { uploadMedia } from "./upload.js";

type FileTransferRuntime = {
  token?: string | undefined;
  baseUrl: string;
  cdnBaseUrl?: string | undefined;
  debug?: DebugLogger | undefined;
};

function createFileTransferError(
  scope: string,
  message: string,
  cause?: unknown,
): Error {
  return createScopedError(scope, message, cause);
}

export async function uploadFileWithRuntime(
  runtime: FileTransferRuntime,
  options: UploadFileOptions,
): Promise<UploadedFileHandle> {
  const createError = (message: string, cause?: unknown) =>
    createFileTransferError("bot.uploadFile", message, cause);

  if (!runtime.token?.trim()) {
    throw createError(
      "bot token is missing; pass token to new Bot(...) or set WEIXIN_CLAWBOT_TOKEN before constructing the bot",
    );
  }

  let uploaded: UploadedMedia;
  try {
    uploaded = await uploadMedia({
      filePath: options.filePath,
      toUserId: options.toUserId,
      baseUrl: runtime.baseUrl,
      token: runtime.token,
      cdnBaseUrl: runtime.cdnBaseUrl ?? CDN_BASE_URL,
      mediaType: UploadMediaType.FILE,
      debug: runtime.debug?.child("upload"),
    });
  } catch (error) {
    throw createError(describeError(error), error);
  }

  return {
    downloadUrl: buildCdnDownloadUrl({
      encryptedQueryParam: uploaded.downloadEncryptedQueryParam,
      cdnBaseUrl: runtime.cdnBaseUrl ?? CDN_BASE_URL,
    }),
    encryptQueryParam: uploaded.downloadEncryptedQueryParam,
    aesKeyHex: uploaded.aeskeyHex,
    plaintextSize: uploaded.plaintextSize,
    ciphertextSize: uploaded.ciphertextSize,
  };
}

export async function downloadFileWithRuntime(
  runtime: FileTransferRuntime,
  options: DownloadFileOptions,
): Promise<Buffer> {
  const createError = (message: string, cause?: unknown) =>
    createFileTransferError("bot.downloadFile", message, cause);

  return downloadCdnBuffer({
    downloadUrl: options.downloadUrl,
    label: "file",
    aesKey: parseHexAesKey(options.aesKeyHex, "file", createError),
    debug: runtime.debug?.child("download"),
    createError,
  });
}

export async function downloadFileToWithRuntime(
  runtime: FileTransferRuntime,
  options: DownloadFileToOptions,
): Promise<void> {
  const createError = (message: string, cause?: unknown) =>
    createFileTransferError("bot.downloadFileTo", message, cause);

  await downloadCdnToWriter({
    downloadUrl: options.downloadUrl,
    label: "file",
    aesKey: parseHexAesKey(options.aesKeyHex, "file", createError),
    writable: options.writable,
    debug: runtime.debug?.child("download"),
    createError,
  });
}
