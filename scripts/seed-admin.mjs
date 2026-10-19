import { randomBytes, scryptSync } from 'node:crypto';
import { readFile, writeFile } from 'node:fs/promises';
import mongoose from 'mongoose';
import nextEnv from '@next/env';

const { loadEnvConfig } = nextEnv;

loadEnvConfig(process.cwd());

const email = process.env.ADMIN_EMAIL?.trim().toLowerCase();
const password = process.env.ADMIN_PASSWORD;
const envPath = '.env.local';

if (!email || !password || password.length < 8) {
  throw new Error('Set ADMIN_EMAIL and an ADMIN_PASSWORD of at least 8 characters before running this seed.');
}

const salt = randomBytes(16).toString('hex');
const passwordHash = `${salt}:${scryptSync(password, salt, 64).toString('hex')}`;
const sessionSecret = process.env.SESSION_SECRET || process.env.NEXTAUTH_SECRET || randomBytes(32).toString('base64url');
const existing = await readFile(envPath, 'utf8');
const values = new Map([
  ['SESSION_SECRET', sessionSecret],
  ['ADMIN_EMAIL', email],
  ['ADMIN_PASSWORD_HASH', passwordHash],
]);
const seen = new Set();
const lines = existing.split(/\r?\n/).flatMap((line) => {
  const match = line.match(/^\s*([A-Za-z0-9_]+)\s*=/);
  if (!match) return [line];
  const key = match[1];
  if (key === 'ADMIN_PASSWORD') return [];
  if (!values.has(key)) return [line];
  if (seen.has(key)) return [];
  seen.add(key);
  return [`${key}=${values.get(key)}`];
});
for (const [key, value] of values) {
  if (!seen.has(key)) lines.push(`${key}=${value}`);
}
await writeFile(envPath, lines.join('\n').replace(/\n*$/, '\n'), 'utf8');

if (!process.env.MONGODB_URI) throw new Error('MONGODB_URI is required to seed the admin account.');
await mongoose.connect(process.env.MONGODB_URI);
const users = mongoose.connection.collection('users');
const now = new Date();
await users.updateOne(
  { email },
  { $set: { name: 'SmartWearBD Admin', email, passwordHash, role: 'admin', updatedAt: now }, $setOnInsert: { createdAt: now } },
  { upsert: true }
);
await mongoose.disconnect();
console.log('Admin credentials seeded; secrets were not printed.');
