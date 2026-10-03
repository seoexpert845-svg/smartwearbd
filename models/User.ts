import mongoose, { Schema, model, models } from 'mongoose';

export interface IUser {
  name: string;
  email?: string;
  phone?: string;
  district?: string;
  thana?: string;
  passwordHash?: string;
  image?: string;
  role: 'user' | 'admin';
  createdAt?: Date;
}

const UserSchema = new Schema<IUser>(
  {
    name: { type: String, required: true },
    email: { type: String, unique: true, sparse: true, lowercase: true, trim: true },
    phone: { type: String, unique: true, sparse: true, trim: true },
    district: { type: String, trim: true },
    thana: { type: String, trim: true },
    passwordHash: { type: String, select: false },
    image: { type: String },
    role: { type: String, enum: ['user', 'admin'], default: 'user' },
  },
  { timestamps: true }
);

const cachedUserModel = models.User;
if (cachedUserModel && (!cachedUserModel.schema.path('phone') || !cachedUserModel.schema.path('passwordHash'))) {
  mongoose.deleteModel('User');
}

const User = models.User || model<IUser>('User', UserSchema);

export default User;