import { Schema, model, models } from 'mongoose';

const ProductReviewSchema = new Schema({
  productId: { type: Schema.Types.ObjectId, ref: 'Product', required: true, index: true },
  productName: { type: String, default: '' },
  userId: { type: Schema.Types.ObjectId, ref: 'User' },
  reviewerName: { type: String, required: true, trim: true, maxlength: 120 },
  phone: { type: String, default: '', trim: true },
  rating: { type: Number, required: true, min: 1, max: 5 },
  text: { type: String, required: true, trim: true, maxlength: 3000 },
  imageUrl: { type: String, default: '' },
  status: { type: String, enum: ['Pending', 'Approved', 'Rejected'], default: 'Pending', index: true },
  verifiedBuyer: { type: Boolean, default: false },
  createdByAdmin: { type: Boolean, default: false },
}, { timestamps: true });
ProductReviewSchema.index({ productId: 1, userId: 1 }, { unique: true, partialFilterExpression: { userId: { $exists: true } } });

const ProductReview = models.ProductReview || model('ProductReview', ProductReviewSchema);
export default ProductReview;
