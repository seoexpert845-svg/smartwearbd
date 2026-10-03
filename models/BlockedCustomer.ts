import { Schema, model, models } from 'mongoose';

const BlockedCustomerSchema = new Schema({
  phone: { type: String, trim: true, default: '' },
  ip: { type: String, trim: true, default: '' },
  reason: { type: String, trim: true, default: '' },
  createdBy: { type: String, trim: true, default: 'Admin' },
}, { timestamps: true });

BlockedCustomerSchema.index({ phone: 1 });
BlockedCustomerSchema.index({ ip: 1 });

const BlockedCustomer = models.BlockedCustomer || model('BlockedCustomer', BlockedCustomerSchema);
export default BlockedCustomer;