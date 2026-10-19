import mongoose, { Schema, model, models } from 'mongoose';

interface IImageAsset {
  contentType: string;
  data: Buffer;
}

const ImageAssetSchema = new Schema<IImageAsset>(
  {
    contentType: { type: String, required: true, enum: ['image/jpeg', 'image/png', 'image/webp', 'image/gif'] },
    data: { type: Buffer, required: true },
  },
  { timestamps: true }
);

const cachedImageAsset = models.ImageAsset;
if (cachedImageAsset && (!cachedImageAsset.schema.path('contentType') || !cachedImageAsset.schema.path('data'))) {
  mongoose.deleteModel('ImageAsset');
}

const ImageAsset = models.ImageAsset || model<IImageAsset>('ImageAsset', ImageAssetSchema);
export default ImageAsset;
