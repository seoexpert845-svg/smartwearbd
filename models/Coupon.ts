import { Schema, model, models } from 'mongoose';

const CouponSchema = new Schema({
  code: { type: String, required: true, unique: true, uppercase: true, trim: true, minlength: 3, maxlength: 40 },
  discountType: { type: String, enum: ['percentage', 'amount'], required: true },
  discountValue: { type: Number, required: true, min: 0.01 },
  maxDiscount: { type: Number, min: 0, default: null },
  minimumPurchase: { type: Number, min: 0, default: 0 },
  expiresAt: { type: Date, default: null },
  isActive: { type: Boolean, default: true },
  redeemedCount: { type: Number, default: 0, min: 0 },
}, { timestamps: true });

const Coupon = models.Coupon || model('Coupon', CouponSchema);
export default Coupon;
