import { createCipheriv, createDecipheriv, createHash, randomBytes } from 'node:crypto';
import SiteSetting from '@/models/SiteSetting';

export const COURIER_NAMES = ['Steadfast', 'Pathao', 'RedX', 'Carrybee'] as const;
export type CourierName = (typeof COURIER_NAMES)[number];
export type CourierCredentials = {
  apiKey: string;
  secretKey: string;
  webhookToken: string;
  storeId: string;
  baseApiUrl: string;
};

type StoredCourierConfig = {
  credentials: string;
  zones: { name: string; fee: number }[];
};

function encryptionKey() {
  const secret = process.env.COURIER_CREDENTIALS_ENCRYPTION_KEY;
  if (!secret || secret.length < 32) throw new Error('Set COURIER_CREDENTIALS_ENCRYPTION_KEY to at least 32 characters before saving courier credentials.');
  return createHash('sha256').update(secret).digest();
}

export function encryptCredentials(credentials: CourierCredentials) {
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', encryptionKey(), iv);
  const encrypted = Buffer.concat([cipher.update(JSON.stringify(credentials), 'utf8'), cipher.final()]);
  return `v1:${iv.toString('base64url')}:${cipher.getAuthTag().toString('base64url')}:${encrypted.toString('base64url')}`;
}

export function decryptCredentials(ciphertext: string): CourierCredentials {
  const [version, ivValue, tagValue, dataValue] = ciphertext.split(':');
  if (version !== 'v1' || !ivValue || !tagValue || !dataValue) throw new Error('Stored courier credentials are invalid.');
  const decipher = createDecipheriv('aes-256-gcm', encryptionKey(), Buffer.from(ivValue, 'base64url'));
  decipher.setAuthTag(Buffer.from(tagValue, 'base64url'));
  return JSON.parse(Buffer.concat([decipher.update(Buffer.from(dataValue, 'base64url')), decipher.final()]).toString('utf8')) as CourierCredentials;
}

export async function readCourierConfiguration() {
  const settings = await SiteSetting.findOne({ key: 'store' }).select('+courierSettings').lean();
  return (settings?.courierSettings || {}) as Record<string, StoredCourierConfig>;
}

export async function readCourierCredentials(name: CourierName) {
  const config = (await readCourierConfiguration())[name];
  return config?.credentials ? decryptCredentials(config.credentials) : null;
}
