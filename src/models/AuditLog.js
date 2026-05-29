import mongoose from 'mongoose';

const auditLogSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    role: {
      type: String,
      required: true,
    },
    action: {
      type: String,
      required: true,
      enum: [
        'CREATE', 'UPDATE', 'DELETE',
        'LOGIN', 'LOGOUT', 'REGISTER',
        'APPROVE', 'REJECT', 'LOCK', 'UNLOCK',
        'CHANGE_ROLE', 'CHANGE_STATUS',
        'CHECK_IN', 'CHECK_OUT',
        'CALCULATE_PAYROLL', 'CLOSE_PAYROLL', 'MARK_PAID',
        'CLOSE_ATTENDANCE',
        'LOCK_ATTENDANCE',
        'REQUEST_EDIT',
        'EXPORT_PDF',
      ],
    },
    resource: {
      type: String,
      required: true,
    },
    resourceId: {
      type: mongoose.Schema.Types.ObjectId,
      default: null,
    },
    oldValue: {
      type: mongoose.Schema.Types.Mixed,
      default: null,
    },
    newValue: {
      type: mongoose.Schema.Types.Mixed,
      default: null,
    },
    ipAddress: {
      type: String,
      default: null,
    },
    deviceInfo: {
      type: String,
      default: null,
    },
  },
  {
    timestamps: { createdAt: true, updatedAt: false },
  }
);

// Indexes
auditLogSchema.index({ userId: 1 });
auditLogSchema.index({ action: 1 });
auditLogSchema.index({ resource: 1 });
auditLogSchema.index({ createdAt: -1 });

// TTL: auto-delete after 365 days (optional, remove if you want permanent logs)
// auditLogSchema.index({ createdAt: 1 }, { expireAfterSeconds: 31536000 });

export default mongoose.model('AuditLog', auditLogSchema);
