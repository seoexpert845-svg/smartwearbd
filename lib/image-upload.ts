import connectDB from '@/lib/db';
import ImageAsset from '@/models/ImageAsset';

export const MAX_IMAGE_FILE_SIZE = 4 * 1024 * 1024;
const imageTypes = [
  { contentType: 'image/jpeg', extension: '.jpg', signature: (bytes: Uint8Array) => bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff },
  { contentType: 'image/png', extension: '.png', signature: (bytes: Uint8Array) => bytes.length >= 8 && bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47 && bytes[4] === 0x0d && bytes[5] === 0x0a && bytes[6] === 0x1a && bytes[7] === 0x0a },
  { contentType: 'image/webp', extension: '.webp', signature: (bytes: Uint8Array) => bytes.length >= 12 && String.fromCharCode(...bytes.slice(0, 4)) === 'RIFF' && String.fromCharCode(...bytes.slice(8, 12)) === 'WEBP' },
  { contentType: 'image/gif', extension: '.gif', signature: (bytes: Uint8Array) => bytes.length >= 6 && (String.fromCharCode(...bytes.slice(0, 6)) === 'GIF87a' || String.fromCharCode(...bytes.slice(0, 6)) === 'GIF89a') },
];
const contentTypeByExtension = new Map(imageTypes.map(({ contentType, extension }) => [extension, contentType]));

export class ImageUploadValidationError extends Error {}

export function imageFileFromDataUrl(dataUrl: string): File | undefined {
  const match = /^data:image\/(?:jpeg|jpg|png|webp|gif);base64,([A-Za-z0-9+/]+={0,2})$/i.exec(dataUrl);
  if (!match) return undefined;
  const encoded = match[1]!;
  if (encoded.length > Math.ceil(MAX_IMAGE_FILE_SIZE / 3) * 4) {
    throw new ImageUploadValidationError('ছবিটি সর্বোচ্চ ৪ MB-এর হতে পারে।');
  }
  const bytes = Buffer.from(encoded, 'base64');
  if (bytes.toString('base64').replace(/=+$/, '') !== encoded.replace(/=+$/, '')) {
    throw new ImageUploadValidationError('ছবির Base64 তথ্য সঠিক নয়।');
  }
  if (bytes.length > MAX_IMAGE_FILE_SIZE) {
    throw new ImageUploadValidationError('ছবিটি সর্বোচ্চ ৪ MB-এর হতে পারে।');
  }
  return new File([bytes], 'uploaded-image');
}

export async function validateImageFile(file: File): Promise<{ bytes: Uint8Array; extension: string }> {
  if (file.size > MAX_IMAGE_FILE_SIZE) {
    throw new ImageUploadValidationError('শুধু JPG, PNG, WEBP বা GIF ছবি দিন; প্রতিটি ছবি সর্বোচ্চ ৪ MB।');
  }

  const bytes = new Uint8Array(await file.arrayBuffer());
  const imageType = imageTypes.find(({ signature }) => signature(bytes));
  if (!imageType) {
    throw new ImageUploadValidationError('একটি বা একাধিক ফাইল বৈধ ছবি নয়।');
  }

  return { bytes, extension: imageType.extension };
}

export async function storeImageFile(bytes: Uint8Array, extension: string): Promise<string> {
  const contentType = contentTypeByExtension.get(extension);
  if (!contentType) throw new Error('Unsupported image file extension.');
  await connectDB();
  const image = await ImageAsset.create({ contentType, data: Buffer.from(bytes) });
  return `/api/uploads/${image.id}`;
}
