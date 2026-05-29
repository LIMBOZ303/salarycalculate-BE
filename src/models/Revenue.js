import mongoose from 'mongoose';

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
    month: {
      type: Number,
      required: true,
      min: 1,
      max: 12,
    },
    quarter: {
      type: Number,
      required: true,
      min: 1,
      max: 4,
    },
    year: {
      type: Number,
      required: true,
    },
    amount: {
      type: Number,
      required: [true, 'Số tiền là bắt buộc'],
      min: [0, 'Số tiền không được âm'],
    },
    note: {
      type: String,
      default: null,
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    updatedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
  },
  {
    timestamps: true,
  }
);

// Indexes
revenueSchema.index({ branchId: 1, date: 1 });
revenueSchema.index({ branchId: 1, month: 1, year: 1 });
revenueSchema.index({ branchId: 1, quarter: 1, year: 1 });
revenueSchema.index({ year: 1 });

// Auto-calculate month, quarter, year from date
revenueSchema.pre('save', function (next) {
  if (this.date) {
    const d = new Date(this.date);
    this.month = d.getMonth() + 1;
    this.year = d.getFullYear();
    this.quarter = Math.ceil(this.month / 3);
  }
  next();
});

export default mongoose.model('Revenue', revenueSchema);
