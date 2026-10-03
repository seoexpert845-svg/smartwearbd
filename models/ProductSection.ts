import { Schema, model, models } from 'mongoose';

const ProductSectionSchema = new Schema({
  name: { type: String, required: true, unique: true, trim: true },
  slug: { type: String, required: true, unique: true, trim: true, lowercase: true },
  description: { type: String, default: '', trim: true },
  sortOrder: { type: Number, default: 0, min: 0 },
  isActive: { type: Boolean, default: true },
}, { timestamps: true });

const ProductSection = models.ProductSection || model('ProductSection', ProductSectionSchema);
export default ProductSection;
