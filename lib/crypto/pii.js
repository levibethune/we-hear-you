import crypto from "crypto";
import { promisify } from "util";

const scrypt = promisify(crypto.scrypt);

const ALGORITHM = "aes-256-gcm";
const KEY_LENGTH = 32;
const SALT_LENGTH = 16;
const NONCE_LENGTH = 12;

function getMasterKey() {
  const key = process.env.ENCRYPTION_MASTER_KEY;
  if (!key) throw new Error("ENCRYPTION_MASTER_KEY is not set");
  const buf = Buffer.from(key, "hex");
  if (buf.length !== KEY_LENGTH) {
    throw new Error("ENCRYPTION_MASTER_KEY must be 32 bytes (64 hex chars)");
  }
  return buf;
}

/**
 * Encrypt a plaintext string using AES-256-GCM.
 * Returns a JSONB-ready object with all components needed for decryption.
 */
export async function encrypt(plaintext) {
  if (!plaintext) return null;

  const masterKey = getMasterKey();
  const salt = crypto.randomBytes(SALT_LENGTH);
  const derivedKey = await scrypt(masterKey, salt, KEY_LENGTH);
  const nonce = crypto.randomBytes(NONCE_LENGTH);

  const cipher = crypto.createCipheriv(ALGORITHM, derivedKey, nonce);
  let ciphertext = cipher.update(plaintext, "utf-8", "hex");
  ciphertext += cipher.final("hex");
  const authTag = cipher.getAuthTag();

  return {
    c: ciphertext,
    s: salt.toString("hex"),
    n: nonce.toString("hex"),
    t: authTag.toString("hex"),
  };
}

/**
 * Decrypt a previously encrypted object back to plaintext.
 */
export async function decrypt(encrypted) {
  if (!encrypted) return null;

  const masterKey = getMasterKey();
  const salt = Buffer.from(encrypted.s, "hex");
  const derivedKey = await scrypt(masterKey, salt, KEY_LENGTH);
  const nonce = Buffer.from(encrypted.n, "hex");

  const decipher = crypto.createDecipheriv(ALGORITHM, derivedKey, nonce);
  decipher.setAuthTag(Buffer.from(encrypted.t, "hex"));

  let plaintext = decipher.update(encrypted.c, "hex", "utf-8");
  plaintext += decipher.final("utf-8");
  return plaintext;
}
