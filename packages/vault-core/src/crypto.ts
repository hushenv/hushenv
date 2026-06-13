import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto';

export const KEY_BYTES = 32;
const IV_BYTES = 12;
const ALG = 'aes-256-gcm';

export interface CipherBlob {
  iv: string;
  ct: string;
  tag: string;
}

export function generateKey(): Buffer {
  return randomBytes(KEY_BYTES);
}

/**
 * AES-256-GCM with the secret *name* as AAD: the ciphertext is bound to its
 * name, so swapping blobs between vault entries fails authentication.
 */
export function encryptValue(key: Buffer, name: string, plaintext: string): CipherBlob {
  assertKey(key);
  const iv = randomBytes(IV_BYTES);
  const cipher = createCipheriv(ALG, key, iv);
  cipher.setAAD(Buffer.from(name, 'utf8'));
  const ct = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
  return {
    iv: iv.toString('base64'),
    ct: ct.toString('base64'),
    tag: cipher.getAuthTag().toString('base64'),
  };
}

export function decryptValue(key: Buffer, name: string, blob: CipherBlob): string {
  assertKey(key);
  const decipher = createDecipheriv(ALG, key, Buffer.from(blob.iv, 'base64'));
  decipher.setAAD(Buffer.from(name, 'utf8'));
  decipher.setAuthTag(Buffer.from(blob.tag, 'base64'));
  try {
    return Buffer.concat([
      decipher.update(Buffer.from(blob.ct, 'base64')),
      decipher.final(),
    ]).toString('utf8');
  } catch {
    throw new Error(
      `Failed to decrypt "${name}": wrong master key or tampered vault entry.`,
    );
  }
}

function assertKey(key: Buffer): void {
  if (key.length !== KEY_BYTES) {
    throw new Error(`Master key must be exactly ${KEY_BYTES} bytes.`);
  }
}
