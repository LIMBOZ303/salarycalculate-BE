import mongoose from 'mongoose';

const shiftSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, 'Tên ca làm là bắt buộc'],
      trim: true,
    },
    startTime: {
      type: String,
      required: [true, 'Giờ bắt đầu là bắt buộc'],
      match: [/^([01]\d|2[0-3]):([0-5]\d)$/, 'Giờ bắt đầu không hợp lệ (HH:mm)'],
    },
    endTime: {
      type: String,
      required: [true, 'Giờ kết thúc là bắt buộc'],
      match: [/^([01]\d|2[0-3]):([0-5]\d)$/, 'Giờ kết thúc không hợp lệ (HH:mm)'],
    },
    breakMinutes: {
      type: Number,
      default: 0,
      min: 0,
    },
    graceMinutes: {
      type: Number,
      default: 0,
      min: 0,
    },
    allowCheckInBeforeMinutes: {
      type: Number,
      default: 30,
      min: 0,
    },
    allowCheckOutAfterMinutes: {
      type: Number,
      default: 60,
      min: 0,
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

export default mongoose.model('Shift', shiftSchema);
