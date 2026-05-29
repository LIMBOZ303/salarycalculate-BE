import mongoose from 'mongoose';

const penaltySchema = new mongoose.Schema(
  {
    employeeId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Employee',
      required: true,
    },
    payrollId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Payroll',
      default: null,
    },
    date: {
      type: Date,
      required: true,
    },
    type: {
      type: String,
      enum: ['late', 'absence', 'violation', 'damage', 'other'],
      required: [true, 'Loại phạt là bắt buộc'],
    },
    reason: {
      type: String,
      required: [true, 'Lý do phạt là bắt buộc'],
    },
    description: {
      type: String,
      default: null,
    },
    amount: {
      type: Number,
      required: [true, 'Số tiền phạt là bắt buộc'],
      min: [0, 'Số tiền phạt không được âm'],
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    note: {
      type: String,
      default: null,
    },
  },
  {
    timestamps: true,
  }
);

penaltySchema.index({ employeeId: 1 });
penaltySchema.index({ payrollId: 1 });
penaltySchema.index({ date: 1 });

export default mongoose.model('Penalty', penaltySchema);
