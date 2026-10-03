import { Schema, model, models } from 'mongoose';

const AbandonedCartSchema = new Schema({
  sessionId: { type: String, required: true, unique: true, trim: true },
  customerName: { type: String, trim: true, default: '' },
  customerPhone: { type: String, trim: true, default: '' },
  userEmail: { type: String, trim: true, lowercase: true, default: '' },
  district: { type: String, trim: true, default: '' },
  thana: { type: String, trim: true, default: '' },
  customerAddress: { type: String, trim: true, default: '' },
  items: [{ productId: String, name: String, price: Number, quantity: Number, imageUrl: String }],
  stage: { type: String, enum: ['cart', 'checkout', 'converted'], default: 'cart' },
  convertedAt: { type: Date },
}, { timestamps: true });

AbandonedCartSchema.index({ updatedAt: -1 });

const AbandonedCart = models.AbandonedCart || model('AbandonedCart', AbandonedCartSchema);
export default AbandonedCart;