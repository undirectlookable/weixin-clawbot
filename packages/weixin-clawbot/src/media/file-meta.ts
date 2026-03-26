import crypto from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";

import { aesEcbPaddedSize } from "../transport/cdn/crypto.js";

type PreparedFile = {
  plaintext: Buffer;
  rawsize: number;
  rawfilemd5: string;
  filesize: number;
};

export async function prepareFileUpload(
  filePath: string,
): Promise<PreparedFile> {
  const plaintext = await fs.readFile(filePath);
  const rawsize = plaintext.length;
  const rawfilemd5 = crypto.createHash("md5").update(plaintext).digest("hex");
  const filesize = aesEcbPaddedSize(rawsize);
  return {
    plaintext,
    rawsize,
    rawfilemd5,
    filesize,
  };
}

export function resolveUploadFileName(params: {
  filePath: string;
  fileName?: string | undefined;
}): string {
  return params.fileName ?? path.basename(params.filePath);
}
