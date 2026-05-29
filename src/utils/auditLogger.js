import AuditLog from '../models/AuditLog.js';

/**
 * Log an action to audit trail
 * @param {Object} params
 * @param {string} params.userId - User performing the action
 * @param {string} params.role - User's role
 * @param {string} params.action - Action type (CREATE, UPDATE, DELETE, etc.)
 * @param {string} params.resource - Resource type (User, Employee, Attendance, etc.)
 * @param {string} params.resourceId - ID of the affected resource
 * @param {*} params.oldValue - Previous value (for updates)
 * @param {*} params.newValue - New value (for updates)
 * @param {Object} req - Express request object (for IP and device info)
 */
const logAction = async ({
  userId,
  role,
  action,
  resource,
  resourceId = null,
  oldValue = null,
  newValue = null,
  req = null,
}) => {
  try {
    const logEntry = {
      userId,
      role,
      action,
      resource,
      resourceId,
      oldValue,
      newValue,
      ipAddress: req ? getClientIp(req) : null,
      deviceInfo: req ? req.headers['user-agent'] || null : null,
    };

    await AuditLog.create(logEntry);
  } catch (error) {
    // Don't throw - audit logging should not break the main flow
    console.error('❌ Audit log error:', error.message);
  }
};

/**
 * Get client IP from request
 */
const getClientIp = (req) => {
  return (
    req.headers['x-forwarded-for']?.split(',')[0]?.trim() ||
    req.headers['x-real-ip'] ||
    req.connection?.remoteAddress ||
    req.socket?.remoteAddress ||
    null
  );
};

export {  logAction, getClientIp  };
