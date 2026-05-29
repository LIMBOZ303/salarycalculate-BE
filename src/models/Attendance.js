import mongoose from 'mongoose';

const locationSchema = new mongoose.Schema(
  {
    latitude: { type: Number, required: true },
    longitude: { type: Number, required: true },
    accuracy: { type: Number, default: null },
    distanceFromBranch: { type: Number, default: null },
  },
  { _id: false }
);

const deviceInfoSchema = new mongoose.Schema(
  {
    deviceId: { type: String, default: null },
    deviceName: { type: String, default: null },
    platform: { type: String, default: null },
  },
  { _id: false }
);

const editHistorySchema = new mongoose.Schema(
  {
    editedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    editedAt: { type: Date, default: Date.now },
    reason: { type: String },
    oldValue: { type: mongoose.Schema.Types.Mixed },
    newValue: { type: mongoose.Schema.Types.Mixed },
  },
  { _id: false }
);

const attendanceSchema = new mongoose.Schema(
  {
    employeeId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Employee',
      required: true,
    },
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    branchId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Branch',
      required: true,
    },
    shiftId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Shift',
      default: null,
    },
    date: {
      type: Date,
      required: true,
    },
    checkInTime: { type: Date, default: null },
    checkOutTime: { type: Date, default: null },
    breakMinutes: { type: Number, default: 0 },
    totalHours: { type: Number, default: 0 },
    lateMinutes: { type: Number, default: 0 },
    status: {
      type: String,
      enum: [
        'not_checked_in',
        'checked_in',
        'late',
        'completed',
        'missing_checkout',
        'absent',
        'leave',
        'edited',
      ],
      default: 'not_checked_in',
    },
    checkInLocation: { type: locationSchema, default: null },
    checkOutLocation: { type: locationSchema, default: null },
    deviceInfo: { type: deviceInfoSchema, default: null },
    checkInSelfieUrl: { type: String, default: null },
    checkOutSelfieUrl: { type: String, default: null },
    qrCodeId: { type: mongoose.Schema.Types.ObjectId, default: null },
    isSuspicious: { type: Boolean, default: false },
    suspiciousReasons: { type: [String], default: [] },
    requestEditStatus: { type: String, default: null },
    requestEditReason: { type: String, default: null },
    editHistory: { type: [editHistorySchema], default: [] },
    isLocked: { type: Boolean, default: false },
    note: { type: String, default: null },
  },
  { timestamps: true }
);

attendanceSchema.index({ employeeId: 1, date: 1 }, { unique: true });
attendanceSchema.index({ branchId: 1, date: 1 });
attendanceSchema.index({ userId: 1, date: 1 });
attendanceSchema.index({ isSuspicious: 1 });
attendanceSchema.index({ status: 1 });

export default mongoose.model('Attendance', attendanceSchema);
