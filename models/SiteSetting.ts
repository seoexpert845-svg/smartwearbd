import mongoose, { Schema, models, model } from 'mongoose';

const SiteSettingSchema = new Schema(
  {
    key: { type: String, required: true, unique: true, default: 'store' },
    storeName: { type: String, required: true, default: 'ঘরবাজার', trim: true },
    logoUrl: { type: String, default: '' },
    heroTitle: { type: String, required: true, default: 'প্রতিদিনের পছন্দ, এবার আরও সাশ্রয়ে', trim: true },
    heroSubtitle: { type: String, default: 'বিশ্বস্ত ব্র্যান্ড, ন্যায্য দাম আর দ্রুত ডেলিভারি—আপনার দরজায় পৌঁছে দিচ্ছি আমরা।', trim: true },
    heroImageUrl: { type: String, default: '' },
    promotionLabel: { type: String, default: 'সাপ্তাহিক শপিং ফেস্ট · ২০২৬', trim: true },
    promotionText: { type: String, default: '৩০% পর্যন্ত ছাড়', trim: true },
    bannersInitialized: { type: Boolean, default: false, select: false },
    courierSettings: { type: Schema.Types.Mixed, default: {}, select: false },
    deliveryZones: { type: [{ name: { type: String, trim: true }, fee: { type: Number, min: 0 } }], default: [] },
    slogan: { type: String, default: '', trim: true, maxlength: 240 },
    description: { type: String, default: '', trim: true, maxlength: 2000 },
    banners: { type: [Schema.Types.Mixed], default: [] },
    primaryColor: { type: String, default: '#8c6d3f', match: /^#[0-9a-fA-F]{6}$/ },
    backgroundColor: { type: String, default: '#fdfbf7', match: /^#[0-9a-fA-F]{6}$/ },
    phone1: { type: String, default: '', trim: true },
    phone2: { type: String, default: '', trim: true },
    whatsapp1: { type: String, default: '', trim: true },
    whatsapp2: { type: String, default: '', trim: true },
    contactEmail: { type: String, default: '', trim: true, lowercase: true },
    address: { type: String, default: '', trim: true },
    mapEmbedUrl: { type: String, default: '', trim: true },
    marqueeText: { type: String, default: '', trim: true, maxlength: 240 },
    orderNote: { type: String, default: '', trim: true },
    socialLinks: { type: Schema.Types.Mixed, default: {} },
    orderSettings: { type: Schema.Types.Mixed, default: {} },
    policyPages: { type: Schema.Types.Mixed, default: {} },
    pixelSettings: { type: Schema.Types.Mixed, default: {} },
  },
  { timestamps: true }
);

const cachedSiteSetting = models.SiteSetting;
if (cachedSiteSetting && (!cachedSiteSetting.schema.path('orderSettings') || !cachedSiteSetting.schema.path('bannersInitialized') || !cachedSiteSetting.schema.path('courierSettings') || !cachedSiteSetting.schema.path('deliveryZones') || !cachedSiteSetting.schema.path('marqueeText'))) {
  mongoose.deleteModel('SiteSetting');
}
const SiteSetting = models.SiteSetting || model('SiteSetting', SiteSettingSchema);
export default SiteSetting;