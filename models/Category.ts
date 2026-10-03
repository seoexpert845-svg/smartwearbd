import mongoose, { Schema, models, model } from 'mongoose';

const CategorySchema = new Schema(
  {
    name: { type: String, required: true, unique: true, trim: true },
    description: { type: String, default: '', trim: true },
    imageUrl: { type: String, default: '' },
    parentCategory: { type: String, default: '', trim: true, index: true },
  },
  { timestamps: true }
);

const cachedCategoryModel = models.Category;
if (cachedCategoryModel && !cachedCategoryModel.schema.path('parentCategory')) {
  mongoose.deleteModel('Category');
}
const Category = models.Category || model('Category', CategorySchema);
export default Category;