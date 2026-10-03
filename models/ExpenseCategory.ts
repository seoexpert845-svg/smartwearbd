import { model, models, Schema } from 'mongoose';

const ExpenseCategorySchema = new Schema(
  { name: { type: String, required: true, trim: true, maxlength: 80, unique: true } },
  { timestamps: true }
);

const ExpenseCategory = models.ExpenseCategory || model('ExpenseCategory', ExpenseCategorySchema);
export default ExpenseCategory;
