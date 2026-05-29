import mongoose from 'mongoose';

const payrollSchema = new mongoose.Schema(
  {
    employeeId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Employee',
      required: true,
    },
    branchId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Branch',
      required: true,
    },
    month: {
      type: Number,
      required: true,
      min: 1,
      max: 12,
    },
    year: {
      type: Number,
      required: true,
    },
    hourlyRate: {
      type: Number,
      default: 0,
    },
    totalHours: {
      type: Number,
      default: 0,
    },
    totalWorkingDays: {
      type: Number,
      default: 0,
    },
    lateCount: {
      type: Number,
      default: 0,
    },
    lateMinutes: {
      type: Number,
      default: 0,
    },
    baseSalary: {
      type: Number,
      default: 0,
    },
    totalPenalty: {
      type: Number,
      default: 0,
    },
    fixedDeduction: {
      type: Number,
      default: 0,
    },
    lateDeduction: {
      type: Number,
      default: 0,
    },
    heldSalary: {
      type: Number,
      default: 0,
    },
    nextPeriodSalary: {
      type: Number,
      default: 0,
    },
    finalSalary: {
      type: Number,
      default: 0,
    },
    paymentStatus: {
      type: String,
      enum: ['draft', 'calculated', 'closed', 'paid'],
      default: 'draft',
    },
    paidDate: {
      type: Date,
      default: null,
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

// Compound index: one payroll per employee per month
payrollSchema.index({ employeeId: 1, month: 1, year: 1 }, { unique: true });
payrollSchema.index({ branchId: 1, month: 1, year: 1 });
payrollSchema.index({ paymentStatus: 1 });

export default mongoose.model('Payroll', payrollSchema);
