import crypto from "node:crypto";

import type { DebugLogger } from "../core/debug.js";
import type { UploadMediaType } from "../protocol/enums.js";
import { getUploadUrl } from "../transport/api/bot-api.js";
import { uploadBufferToCdn } from "../transport/cdn/upload.js";
import { prepareFileUpload } from "./file-meta.js";

type UploadedMediaInfo = {
  downloadEncryptedQueryParam: string;
  aeskeyHex: string;
  plaintextSize: number;
  ciphertextSize: number;
};

export type UploadedMedia = UploadedMediaInfo & {
  thumbDownloadEncryptedQueryParam?: string | undefined;
  thumbCiphertextSize?: number;
};

type PreparedUploadFile = Awaited<ReturnType<typeof prepareFileUpload>>;

async function uploadPreparedFile(params: {
  file: PreparedUploadFile;
  uploadParam: string;
  filekey: string;
  cdnBaseUrl: string;
  aeskey: Buffer;
  debug?: DebugLogger | undefined;
}): Promise<string> {
  return uploadBufferToCdn({
    plaintext: params.file.plaintext,
    uploadParam: params.uploadParam,
    filekey: params.filekey,
    cdnBaseUrl: params.cdnBaseUrl,
    aeskey: params.aeskey,
    debug: params.debug,
  });
}

export async function uploadMedia(params: {
  filePath: string;
  toUserId: string;
  baseUrl: string;
  token?: string | undefined;
  cdnBaseUrl: string;
  mediaType: (typeof UploadMediaType)[keyof typeof UploadMediaType];
  thumbPath?: string | undefined;
  debug?: DebugLogger | undefined;
}): Promise<UploadedMedia> {
  const debug = params.debug;

  debug?.log("prepare.start", {
    filePath: params.filePath,
    thumbPath: params.thumbPath,
    mediaType: params.mediaType,
  });

  const file = await prepareFileUpload(params.filePath);
  const filekey = crypto.randomBytes(16).toString("hex");
  const aeskey = crypto.randomBytes(16);
  const aeskeyHex = aeskey.toString("hex");

  let thumbFile: Awaited<ReturnType<typeof prepareFileUpload>> | undefined;
  if (params.thumbPath) {
    thumbFile = await prepareFileUpload(params.thumbPath);
  }

  debug?.log("prepare.complete", {
    rawsize: file.rawsize,
    filesize: file.filesize,
    hasThumbnail: Boolean(thumbFile),
    thumbRawsize: thumbFile?.rawsize,
    thumbFilesize: thumbFile?.filesize,
  });

  const uploadUrlResp = await getUploadUrl({
    baseUrl: params.baseUrl,
    token: params.token,
    filekey,
    media_type: params.mediaType,
    to_user_id: params.toUserId,
    rawsize: file.rawsize,
    rawfilemd5: file.rawfilemd5,
    filesize: file.filesize,
    thumb_rawsize: thumbFile?.rawsize,
    thumb_rawfilemd5: thumbFile?.rawfilemd5,
    thumb_filesize: thumbFile?.filesize,
    no_need_thumb: !thumbFile,
    aeskey: aeskeyHex,
    debug: debug?.child("api"),
  });

  if (!uploadUrlResp.upload_param) {
    throw new Error("getUploadUrl returned no upload_param");
  }

  debug?.log("upload_url.received", {
    hasUploadParam: Boolean(uploadUrlResp.upload_param),
    hasThumbUploadParam: Boolean(uploadUrlResp.thumb_upload_param),
  });

  const downloadEncryptedQueryParam = await uploadPreparedFile({
    file,
    uploadParam: uploadUrlResp.upload_param,
    filekey,
    cdnBaseUrl: params.cdnBaseUrl,
    aeskey,
    debug: debug?.child("cdn"),
  });

  let thumbDownloadEncryptedQueryParam: string | undefined;
  if (thumbFile && uploadUrlResp.thumb_upload_param) {
    thumbDownloadEncryptedQueryParam = await uploadPreparedFile({
      file: thumbFile,
      uploadParam: uploadUrlResp.thumb_upload_param,
      filekey,
      cdnBaseUrl: params.cdnBaseUrl,
      aeskey,
      debug: debug?.child("cdn"),
    });
  }

  const uploaded: UploadedMedia = {
    downloadEncryptedQueryParam,
    aeskeyHex,
    plaintextSize: file.rawsize,
    ciphertextSize: file.filesize,
  };
  if (thumbDownloadEncryptedQueryParam !== undefined) {
    uploaded.thumbDownloadEncryptedQueryParam =
      thumbDownloadEncryptedQueryParam;
  }
  if (thumbFile?.filesize !== undefined) {
    uploaded.thumbCiphertextSize = thumbFile.filesize;
  }

  debug?.log("upload.complete", {
    plaintextSize: uploaded.plaintextSize,
    ciphertextSize: uploaded.ciphertextSize,
    hasThumbnail: Boolean(uploaded.thumbDownloadEncryptedQueryParam),
    thumbCiphertextSize: uploaded.thumbCiphertextSize,
  });

  return uploaded;
}
