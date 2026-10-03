import { model, models, Schema } from 'mongoose';

const CustomerMessageSchema = new Schema(
  {
    name: { type: String, required: true, trim: true, maxlength: 120 },
    phone: { type: String, required: true, trim: true, maxlength: 32, index: true },
    email: { type: String, default: '', trim: true, lowercase: true, maxlength: 254 },
    message: { type: String, required: true, trim: true, maxlength: 5000 },
  },
  { timestamps: true }
);

const CustomerMessage = models.CustomerMessage || model('CustomerMessage', CustomerMessageSchema);
export default CustomerMessage;
