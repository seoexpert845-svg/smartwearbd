import mongoose, { Schema, model, models } from 'mongoose';

export interface IProduct {
  name: string;
  description: string;
  price: number;
  regularPrice?: number;
  salePrice?: number;
  category: string;
  imageUrl?: string;
  images?: string[];
  stock: number;
  sku?: string;
  shortDescription?: string;
  subCategory?: string;
  brand?: string;
  sectionIds?: string[];
  buyingPrice?: number;
  productType?: 'single' | 'variant';
  variants?: { sku?: string; attributes: Record<string, string>; price?: number; stock: number }[];
  inStock?: boolean;
  isPublic?: boolean;
  featured?: boolean;
  freeShipping?: boolean;
  stockAlert?: boolean;
  stockAlertThreshold?: number;
  maxOrderQuantity?: number;
  sortingRank?: number;
  seoMetaTitle?: string;
  seoMetaDescription?: string;
  seoKeywords?: string[];
  createdAt?: Date;
}

const ProductVariantSchema = new Schema({
  sku: { type: String, trim: true, default: '' },
  attributes: { type: Schema.Types.Mixed, default: {} },
  price: { type: Number, min: 0 },
  stock: { type: Number, min: 0, default: 0 },
}, { _id: false });

const ProductSchema = new Schema<IProduct>(
  {
    name: { type: String, required: true, trim: true },
    description: { type: String, required: true, trim: true },
    price: { type: Number, required: true, min: 0 },
    regularPrice: { type: Number, min: 0 },
    salePrice: { type: Number, min: 0 },
    category: { type: String, required: true, trim: true },
    imageUrl: { type: String, default: '', trim: true },
    images: { type: [String], default: [] },
    stock: { type: Number, required: true, min: 0, default: 0 },
    sku: { type: String, trim: true, default: undefined, sparse: true },
    shortDescription: { type: String, default: '', trim: true, maxlength: 500 },
    subCategory: { type: String, default: '', trim: true },
    brand: { type: String, default: '', trim: true },
    sectionIds: { type: [String], default: [] },
    buyingPrice: { type: Number, min: 0, default: 0, select: false },
    productType: { type: String, enum: ['single', 'variant'], default: 'single' },
    variants: { type: [ProductVariantSchema], default: [] },
    inStock: { type: Boolean, default: true },
    isPublic: { type: Boolean, default: true },
    featured: { type: Boolean, default: false },
    freeShipping: { type: Boolean, default: false },
    stockAlert: { type: Boolean, default: false },
    stockAlertThreshold: { type: Number, min: 0, default: 5 },
    maxOrderQuantity: { type: Number, min: 0, default: 0 },
    sortingRank: { type: Number, default: 0 },
    seoMetaTitle: { type: String, default: '', trim: true, maxlength: 160 },
    seoMetaDescription: { type: String, default: '', trim: true, maxlength: 320 },
    seoKeywords: { type: [String], default: [] },
  },
  { timestamps: true, strict: true }
);

const cachedProductModel = models.Product;
if (cachedProductModel && (
  !cachedProductModel.schema.path('buyingPrice')
  || cachedProductModel.schema.path('maxOrderQuantity')?.options.min !== 0
)) mongoose.deleteModel('Product');
const Product = models.Product || model<IProduct>('Product', ProductSchema);

export default Product;