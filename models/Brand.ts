import { Schema, model, models } from 'mongoose';

const BrandSchema = new Schema({
  name: { type: String, required: true, unique: true, trim: true },
  description: { type: String, default: '', trim: true },
  logoUrl: { type: String, default: '' },
  isActive: { type: Boolean, default: true },
}, { timestamps: true });

const Brand = models.Brand || model('Brand', BrandSchema);
export default Brand;
