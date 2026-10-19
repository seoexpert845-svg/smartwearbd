import { NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/auth-api';
import { ImageUploadValidationError, MAX_IMAGE_FILE_SIZE, storeImageFile, validateImageFile } from '@/lib/image-upload';

export const runtime = 'nodejs';

const MAX_IMAGES = 10;
const MAX_REQUEST_IMAGE_BYTES = 4 * 1024 * 1024;
const MAX_SETTINGS_IMAGE_BYTES = 900 * 1024;

function errorResponse(error: unknown, status: number) {
  const message = error instanceof Error ? error.message : String(error);
  return NextResponse.json({ success: false, message, error: message }, { status });
}

export async function POST(request: Request) {
  try {
    const unauthorized = requireAdmin(request);
    if (unauthorized) return unauthorized;

    const formData = await request.formData();
    const categoryImage = formData.get('categoryImage');
    const reviewImage = formData.get('reviewImage');
    const settingsImage = formData.get('settingsImage');
    const singleImage = categoryImage instanceof File && categoryImage.size > 0
      ? categoryImage
      : reviewImage instanceof File && reviewImage.size > 0 ? reviewImage
        : settingsImage instanceof File && settingsImage.size > 0 ? settingsImage : null;
    const isSingleImage = singleImage !== null;
    const files = isSingleImage
      ? [singleImage]
      : formData.getAll('images').filter((entry): entry is File => entry instanceof File && entry.size > 0);
    if (isSingleImage ? files.length !== 1 : files.length < 1 || files.length > MAX_IMAGES) {
      return errorResponse(new Error(isSingleImage ? 'একটি ছবি নির্বাচন করুন।' : 'একসাথে ১ থেকে ১০টি ছবি নির্বাচন করুন।'), 400);
    }
    const totalSize = files.reduce((sum, file) => sum + file.size, 0);
    if (settingsImage instanceof File && settingsImage.size > MAX_SETTINGS_IMAGE_BYTES) {
      return errorResponse(new Error('স্টোরের লোগো, favicon বা ব্যানার সর্বোচ্চ ৯০০ KB হতে পারে।'), 413);
    }
    if (files.some((file) => file.size > MAX_IMAGE_FILE_SIZE) || totalSize > MAX_REQUEST_IMAGE_BYTES) {
      return errorResponse(new Error('প্রতিটি ছবি সর্বোচ্চ ৪ MB এবং প্রতি অনুরোধে মোট ৪ MB পর্যন্ত ছবি দিন।'), 413);
    }

    const validatedFiles = [];
    for (const file of files) {
      try {
        validatedFiles.push(await validateImageFile(file));
      } catch (error) {
        if (error instanceof ImageUploadValidationError) {
          return errorResponse(error, 400);
        }
        throw error;
      }
    }

    const urls = await Promise.all(validatedFiles.map(({ bytes, extension }) => storeImageFile(bytes, extension)));

    return NextResponse.json({ success: true, data: urls }, { status: 201 });
  } catch (error) {
    console.error('Image Upload Error:', error);
    const message = error instanceof Error ? error.message : String(error);
    const tooLarge = /body.*(?:size|large)|(?:size|large).*body|payload.*large/i.test(message);
    return errorResponse(error, tooLarge ? 413 : 500);
  }
}
