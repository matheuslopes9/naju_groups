/**
 * Criptografia AES-256-GCM para segredos persistidos no DB.
 * Usa APP_ENCRYPTION_KEY (32 bytes em base64 ou hex) do .env.
 *
 * Fallback: se APP_ENCRYPTION_KEY não estiver setada, deriva da
 * DASHBOARD_PASSWORD via scrypt (não é tão bom quanto chave dedicada,
 * mas funciona — só não mude DASHBOARD_PASSWORD sem migrar os dados).
 *
 * Formato armazenado: base64(iv:12) + ":" + base64(authTag:16) + ":" + base64(ciphertext)
 */
import crypto from 'node:crypto';

let cachedKey = null;

function getKey() {
  if (cachedKey) return cachedKey;
  const env = process.env.APP_ENCRYPTION_KEY;
  if (env) {
    if (env.length === 44) cachedKey = Buffer.from(env, 'base64');
    else if (env.length === 64) cachedKey = Buffer.from(env, 'hex');
    else throw new Error('APP_ENCRYPTION_KEY deve ter 44 chars (base64) ou 64 chars (hex)');
    if (cachedKey.length !== 32) throw new Error('APP_ENCRYPTION_KEY decoded must be 32 bytes');
    return cachedKey;
  }
  const dash = process.env.DASHBOARD_PASSWORD;
  if (!dash) throw new Error('APP_ENCRYPTION_KEY ou DASHBOARD_PASSWORD obrigatória');
  cachedKey = crypto.scryptSync(dash, 'naju-groups-salt-v1', 32);
  return cachedKey;
}

export function encrypt(plaintext) {
  if (plaintext == null || plaintext === '') return '';
  const key = getKey();
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
  const enc = Buffer.concat([cipher.update(String(plaintext), 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `${iv.toString('base64')}:${tag.toString('base64')}:${enc.toString('base64')}`;
}

export function decrypt(blob) {
  if (!blob) return '';
  const parts = blob.split(':');
  if (parts.length !== 3) throw new Error('formato inválido de ciphertext');
  const [ivB64, tagB64, encB64] = parts;
  const key = getKey();
  const iv = Buffer.from(ivB64, 'base64');
  const tag = Buffer.from(tagB64, 'base64');
  const enc = Buffer.from(encB64, 'base64');
  const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(enc), decipher.final()]).toString('utf8');
}

export function generateKey() {
  return crypto.randomBytes(32).toString('base64');
}
