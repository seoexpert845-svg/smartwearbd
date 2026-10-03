import { randomUUID } from 'node:crypto';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';

const MAX_FILE_SIZE = 5 * 1024 * 1024;
const imageTypes = new Map([
  ['image/jpeg', { extension: '.jpg', signature: (bytes: Uint8Array) => bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff }],
  ['image/png', { extension: '.png', signature: (bytes: Uint8Array) => bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47 }],
  ['image/webp', { extension: '.webp', signature: (bytes: Uint8Array) => String.fromCharCode(...bytes.slice(0, 4)) === 'RIFF' && String.fromCharCode(...bytes.slice(8, 12)) === 'WEBP' }],
  ['image/gif', { extension: '.gif', signature: (bytes: Uint8Array) => String.fromCharCode(...bytes.slice(0, 3)) === 'GIF' }],
]);

export class ImageUploadValidationError extends Error {}

export function imageFileFromDataUrl(dataUrl: string): File | undefined {
  const match = /^data:(image\/(?:jpeg|png|webp|gif));base64,([A-Za-z0-9+/]+={0,2})$/i.exec(dataUrl);
  if (!match) return undefined;
  const bytes = Buffer.from(match[2]!, 'base64');
  if (bytes.length > MAX_FILE_SIZE) {
    throw new ImageUploadValidationError('ছবিটি সর্বোচ্চ ৫ MB-এর হতে পারে।');
  }
  return new File([bytes], 'uploaded-image', { type: match[1]!.toLowerCase() });
}

export async function validateImageFile(file: File): Promise<{ bytes: Uint8Array; extension: string }> {
  const imageType = imageTypes.get(file.type);
  if (!imageType || file.size > MAX_FILE_SIZE) {
    throw new ImageUploadValidationError('শুধু JPG, PNG, WEBP বা GIF ছবি দিন; প্রতিটি ছবি সর্বোচ্চ ৫ MB।');
  }

  const bytes = new Uint8Array(await file.arrayBuffer());
  if (!imageType.signature(bytes)) {
    throw new ImageUploadValidationError('একটি বা একাধিক ফাইল বৈধ ছবি নয়।');
  }

  return { bytes, extension: imageType.extension };
}

export async function storeImageFile(bytes: Uint8Array, extension: string): Promise<string> {
  const uploadDirectory = path.join(process.cwd(), 'public', 'uploads');
  await mkdir(uploadDirectory, { recursive: true });
  const filename = `${randomUUID()}${extension}`;
  await writeFile(path.join(uploadDirectory, filename), bytes, { flag: 'wx' });
  return `/uploads/${filename}`;
}
