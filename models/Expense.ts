import { model, models, Schema } from 'mongoose';

const ExpenseSchema = new Schema(
  {
    categoryId: { type: Schema.Types.ObjectId, ref: 'ExpenseCategory', required: true, index: true },
    categoryName: { type: String, required: true, trim: true, maxlength: 80 },
    amount: { type: Number, required: true, min: 0.01 },
    date: { type: Date, required: true, index: true },
    note: { type: String, default: '', trim: true, maxlength: 1000 },
  },
  { timestamps: true }
);

const Expense = models.Expense || model('Expense', ExpenseSchema);
export default Expense;
