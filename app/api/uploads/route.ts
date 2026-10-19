import { NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/auth-api';
import { ImageUploadValidationError, MAX_IMAGE_FILE_SIZE, storeImageFile, validateImageFile } from '@/lib/image-upload';

export const runtime = 'nodejs';

const MAX_IMAGES = 10;
const MAX_REQUEST_IMAGE_BYTES = 4 * 1024 * 1024;

export async function POST(request: Request) {
  const unauthorized = requireAdmin(request);
  if (unauthorized) return unauthorized;

  try {
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
      return NextResponse.json({ success: false, error: isSingleImage ? 'একটি ছবি নির্বাচন করুন।' : 'একসাথে ১ থেকে ১০টি ছবি নির্বাচন করুন।' }, { status: 400 });
    }
    const totalSize = files.reduce((sum, file) => sum + file.size, 0);
    if (files.some((file) => file.size > MAX_IMAGE_FILE_SIZE) || totalSize > MAX_REQUEST_IMAGE_BYTES) {
      return NextResponse.json({ success: false, error: 'প্রতিটি ছবি সর্বোচ্চ ৪ MB এবং প্রতি অনুরোধে মোট ৪ MB পর্যন্ত ছবি দিন।' }, { status: 413 });
    }

    const validatedFiles = [];
    for (const file of files) {
      try {
        validatedFiles.push(await validateImageFile(file));
      } catch (error) {
        if (error instanceof ImageUploadValidationError) {
          return NextResponse.json({ success: false, error: error.message }, { status: 400 });
        }
        throw error;
      }
    }

    const urls = await Promise.all(validatedFiles.map(({ bytes, extension }) => storeImageFile(bytes, extension)));

    return NextResponse.json({ success: true, data: urls }, { status: 201 });
  } catch (error) {
    return NextResponse.json({ success: false, error: error instanceof Error ? error.message : 'ছবি আপলোড করা যায়নি।' }, { status: 500 });
  }
}
