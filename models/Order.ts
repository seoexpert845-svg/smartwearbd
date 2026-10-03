import mongoose, { Schema, models, model } from 'mongoose';

export const ORDER_STATUSES = [
  'New', 'Incomplete', 'Pending Response', 'No Response', 'Fake', 'Advance Payment',
  'Confirmed', 'On Hold', 'Processing', 'Ready For Pickup', 'Pending (Courier)',
  'In Transit', 'Delivered', 'Partial Delivered', 'Returned', 'Cancelled', 'Lost',
  'Pending', 'Shipped',
];
const ORDER_SOURCES = ['Website', 'Landing Page', 'Direct Order', 'App', 'WhatsApp', 'Facebook', 'Instagram', 'TikTok', 'Google'];
const ActivityLogSchema = new Schema({
  action: { type: String, required: true, trim: true },
  actor: { type: String, default: 'Admin', trim: true },
  details: { type: String, default: '', trim: true },
  createdAt: { type: Date, default: Date.now },
}, { _id: false });

const OrderItemSchema = new Schema(
  {
    productId: { type: String },
    name: { type: String, required: true },
    price: { type: Number, required: true, min: 0 },
    buyingPrice: { type: Number, min: 0 },
    quantity: { type: Number, required: true, min: 1 },
    imageUrl: { type: String, default: '' },
    variant: { type: String, trim: true },
    size: { type: String, trim: true },
  },
  { _id: false }
);

const OrderSchema = new Schema(
  {
    customerName: { type: String, required: true, trim: true },
    customerPhone: { type: String, required: true, trim: true },
    customerAddress: { type: String, required: true, trim: true },
    shippingAddress: { type: String, trim: true },
    district: { type: String, trim: true },
    thana: { type: String, trim: true },
    shippingFee: { type: Number, required: true, default: 0, min: 0 },
    discountAmount: { type: Number, default: 0, min: 0 },
    couponCode: { type: String, trim: true, uppercase: true, default: '' },
    discountType: { type: String, enum: ['flat', 'percentage'], default: 'flat' },
    discountValue: { type: Number, default: 0, min: 0 },
    taxAmount: { type: Number, default: 0, min: 0 },
    paymentMethod: { type: String, default: 'ক্যাশ অন ডেলিভারি', trim: true },
    source: { type: String, enum: ORDER_SOURCES, default: 'Website' },
    isFake: { type: Boolean, default: false },
    assignedStaff: { type: String, trim: true, default: '' },
    courierName: { type: String, trim: true, default: '' },
    courierStatus: { type: String, trim: true, default: '' },
    trackingId: { type: String, trim: true, default: '' },
    courierResponse: { type: Schema.Types.Mixed },
    courierPaymentStatus: { type: String, enum: ['Unpaid', 'Paid'], default: 'Unpaid', index: true },
    courierCollectedAmount: { type: Number, default: 0, min: 0 },
    advancePayment: {
      amount: { type: Number, default: 0, min: 0 },
      gateway: { type: String, enum: ['', 'bKash', 'Nagad', 'Rocket'], default: '' },
      transactionId: { type: String, trim: true, default: '' },
      receivedBy: { type: String, trim: true, default: '' },
      receivedAt: { type: Date },
    },
    customerIp: { type: String, trim: true, default: '' },
    addressCorrection: { type: String, trim: true, default: '' },
    fraudCheck: {
      totalOrders: { type: Number, min: 0 },
      delivered: { type: Number, min: 0 },
      returned: { type: Number, min: 0 },
      cancelled: { type: Number, min: 0 },
      successRate: { type: Number, min: 0, max: 100 },
      returnRate: { type: Number, min: 0, max: 100 },
      cancellationRate: { type: Number, min: 0, max: 100 },
      checkedPhone: { type: String, trim: true },
      provider: { type: String, trim: true, default: '' },
      mock: { type: Boolean, default: false },
      checkedAt: { type: Date },
    },
    activityLog: { type: [ActivityLogSchema], default: [] },
    userEmail: { type: String, required: true, default: 'guest@example.com', trim: true, lowercase: true },
    userId: { type: Schema.Types.ObjectId, ref: 'User', index: true },
    items: { type: [OrderItemSchema], required: true, default: [] },
    totalAmount: { type: Number, required: true, min: 0 },
    status: { type: String, enum: ORDER_STATUSES, default: 'Pending' },
  },
  { timestamps: true, strict: false }
);

const cachedOrderModel = models.Order;
const cachedStatusEnum = cachedOrderModel?.schema.path('status')?.options.enum;
const cachedStatusValues = Array.isArray(cachedStatusEnum) ? cachedStatusEnum : [];
const cachedSourceEnum = cachedOrderModel?.schema.path('source')?.options.enum;
const cachedSourceValues = Array.isArray(cachedSourceEnum) ? cachedSourceEnum : [];
const cachedShippingAddress = cachedOrderModel?.schema.path('shippingAddress');
const cachedFraudCheckPhone = cachedOrderModel?.schema.path('fraudCheck.checkedPhone');
const cachedUserId = cachedOrderModel?.schema.path('userId');

if (cachedOrderModel && (!cachedShippingAddress || cachedShippingAddress.isRequired || !cachedStatusValues.includes('Lost') || !cachedSourceValues.includes('Google') || !cachedFraudCheckPhone || !cachedUserId || !cachedOrderModel.schema.path('courierPaymentStatus'))) {
  mongoose.deleteModel('Order');
}

const Order = models.Order || model('Order', OrderSchema);
export default Order;