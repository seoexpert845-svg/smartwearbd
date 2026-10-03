import { Schema, model, models } from 'mongoose';

const VariantAttributeSchema = new Schema({
  name: { type: String, required: true, unique: true, trim: true },
  values: { type: [String], default: [] },
}, { timestamps: true });

const VariantAttribute = models.VariantAttribute || model('VariantAttribute', VariantAttributeSchema);
export default VariantAttribute;
