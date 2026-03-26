import crypto from "node:crypto";

export function aesEcbPaddedSize(plaintextSize: number): number {
  return Math.ceil((plaintextSize + 1) / 16) * 16;
}

export function encryptAesEcb(plaintext: Buffer, key: Buffer): Buffer {
  const cipher = crypto.createCipheriv("aes-128-ecb", key, null);
  return Buffer.concat([cipher.update(plaintext), cipher.final()]);
}

export function decryptAesEcb(ciphertext: Buffer, key: Buffer): Buffer {
  const decipher = createAesEcbDecipher(key);
  return Buffer.concat([decipher.update(ciphertext), decipher.final()]);
}

export function createAesEcbDecipher(key: Buffer) {
  return crypto.createDecipheriv("aes-128-ecb", key, null);
}
