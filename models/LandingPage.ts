import mongoose, { model, models, Schema } from 'mongoose';

const LandingSectionSchema = new Schema(
  {
    type: { type: String, enum: ['hero', 'features', 'gallery', 'feature-list', 'text'], required: true },
    layout: { type: String, enum: ['centered', 'split'], default: 'centered' },
    title: { type: String, default: '', trim: true, maxlength: 240 },
    subtitle: { type: String, default: '', trim: true, maxlength: 2000 },
    mediaUrl: { type: String, default: '', trim: true, maxlength: 2048 },
    buttonText: { type: String, default: '', trim: true, maxlength: 80 },
    buttonUrl: { type: String, default: '', trim: true, maxlength: 2048 },
    content: { type: String, default: '', trim: true, maxlength: 10000 },
    images: { type: [String], default: [] },
  },
  { _id: true }
);

const LandingPageSchema = new Schema(
  {
    title: { type: String, required: true, trim: true, maxlength: 160 },
    slug: { type: String, required: true, trim: true, lowercase: true, match: /^[a-z0-9]+(?:-[a-z0-9]+)*$/, unique: true },
    status: { type: String, enum: ['published', 'draft', 'demo'], default: 'draft', index: true },
    sections: { type: [LandingSectionSchema], default: [] },
    headerTemplate: { type: String, enum: ['standard', 'minimal', 'campaign'], default: 'standard' },
    metaTitle: { type: String, default: '', trim: true, maxlength: 160 },
    metaDescription: { type: String, default: '', trim: true, maxlength: 320 },
    metaKeywords: { type: String, default: '', trim: true, maxlength: 500 },
    fontFamily: { type: String, enum: ['Hind Siliguri', 'SolaimanLipi', 'Kalpurush', 'Noto Sans Bengali'], default: 'Hind Siliguri' },
    primaryColor: { type: String, default: '#123d3a', match: /^#[0-9a-fA-F]{6}$/ },
    featuredProducts: { type: [String], default: [] },
  },
  { timestamps: true }
);

const cachedLandingPage = models.LandingPage;
if (cachedLandingPage && !cachedLandingPage.schema.path('featuredProducts')) mongoose.deleteModel('LandingPage');
const LandingPage = models.LandingPage || model('LandingPage', LandingPageSchema);
export default LandingPage;
