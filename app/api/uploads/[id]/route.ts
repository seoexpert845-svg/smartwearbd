import mongoose from 'mongoose';
import connectDB from '@/lib/db';
import ImageAsset from '@/models/ImageAsset';

export const runtime = 'nodejs';

type ImageRouteContext = { params: Promise<{ id: string }> | { id: string } };

export async function GET(_request: Request, context: ImageRouteContext) {
  const { id } = await context.params;
  if (!mongoose.isValidObjectId(id)) return new Response('Not found', { status: 404 });

  try {
    await connectDB();
    const image = await ImageAsset.findById(id).select('contentType data');
    if (!image) return new Response('Not found', { status: 404 });
    return new Response(new Uint8Array(image.data), {
      headers: {
        'Content-Type': image.contentType,
        'Cache-Control': 'public, max-age=31536000, immutable',
        'X-Content-Type-Options': 'nosniff',
      },
    });
  } catch (error) {
    console.error('Image asset could not be loaded:', error);
    return new Response('Image could not be loaded', { status: 500 });
  }
}
