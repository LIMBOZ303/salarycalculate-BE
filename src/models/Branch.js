import mongoose from 'mongoose';

const branchSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, 'Tên chi nhánh là bắt buộc'],
      trim: true,
    },
    address: {
      type: String,
      required: [true, 'Địa chỉ là bắt buộc'],
      trim: true,
    },
    phone: {
      type: String,
      trim: true,
      default: null,
    },
    managerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
    latitude: {
      type: Number,
      required: [true, 'Vĩ độ là bắt buộc'],
      min: -90,
      max: 90,
    },
    longitude: {
      type: Number,
      required: [true, 'Kinh độ là bắt buộc'],
      min: -180,
      max: 180,
    },
    allowedRadiusMeters: {
      type: Number,
      default: 100,
      min: [10, 'Bán kính tối thiểu 10m'],
      max: [1000, 'Bán kính tối đa 1000m'],
    },
    isActive: {
      type: Boolean,
      default: true,
    },
  },
  {
    timestamps: true,
  }
);

branchSchema.index({ isActive: 1 });
branchSchema.index({ managerId: 1 });

export default mongoose.model('Branch', branchSchema);
