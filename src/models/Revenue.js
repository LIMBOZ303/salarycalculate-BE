import mongoose from 'mongoose';
import { normalizeDateOnly } from '../utils/dateRange.js';

const revenueSchema = new mongoose.Schema(
  {
    branchId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Branch',
      required: [true, 'Chi nhánh là bắt buộc'],
    },
    date: {
      type: Date,
      required: [true, 'Ngày là bắt buộc'],
    },
    amount: {
      type: Number,
      required: [true, 'Số tiền là bắt buộc'],
      min: [0, 'Số tiền không được âm'],
    },
    cashAmount: {
      type: Number,
      default: 0,
      min: [0, 'Tiền mặt không được âm'],
    },
    transferAmount: {
      type: Number,
      default: 0,
      min: [0, 'Chuyển khoản không được âm'],
    },
    otherAmount: {
      type: Number,
      default: 0,
      min: [0, 'Khoản khác không được âm'],
    },
    orderCount: {
      type: Number,
      default: 0,
      min: [0, 'Số đơn không được âm'],
    },
    note: {
      type: String,
      default: null,
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
    updatedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
    status: {
      type: String,
      enum: ['draft', 'submitted', 'confirmed'],
      default: 'submitted',
    },
  },
  {
    timestamps: true,
  }
);

revenueSchema.index({ branchId: 1, date: 1 }, { unique: true });
revenueSchema.index({ date: 1 });

revenueSchema.pre('save', function (next) {
  if (this.date) {
    this.date = normalizeDateOnly(this.date);
  }
  next();
});

export default mongoose.model('Revenue', revenueSchema);
