/**
 * Helper Utilities
 */

/**
 * Get current time in Vietnam timezone (UTC+7)
 * @returns {Date}
 */
const getVietnamTime = () => {
  const now = new Date();
  const vnOffset = 7 * 60; // UTC+7 in minutes
  const utcOffset = now.getTimezoneOffset();
  return new Date(now.getTime() + (utcOffset + vnOffset) * 60000);
};

/**
 * Get start of day in Vietnam timezone
 * @param {Date} date - Optional date, defaults to today
 * @returns {Date}
 */
const startOfDay = (date) => {
  const d = date ? new Date(date) : getVietnamTime();
  d.setHours(0, 0, 0, 0);
  return d;
};

/**
 * Get end of day in Vietnam timezone
 * @param {Date} date - Optional date, defaults to today
 * @returns {Date}
 */
const endOfDay = (date) => {
  const d = date ? new Date(date) : getVietnamTime();
  d.setHours(23, 59, 59, 999);
  return d;
};

/**
 * Calculate quarter from month
 * @param {number} month - Month (1-12)
 * @returns {number} Quarter (1-4)
 */
const calculateQuarter = (month) => {
  return Math.ceil(month / 3);
};

/**
 * Generate employee code
 * @param {number} sequence - Sequence number
 * @returns {string} Employee code like NV00001
 */
const generateEmployeeCode = (sequence) => {
  return `NV${String(sequence).padStart(5, '0')}`;
};

/**
 * Parse time string "HH:mm" to minutes from midnight
 * @param {string} timeStr - Time string in HH:mm format
 * @returns {number} Minutes from midnight
 */
const timeToMinutes = (timeStr) => {
  const [hours, minutes] = timeStr.split(':').map(Number);
  return hours * 60 + minutes;
};

/**
 * Calculate total hours between two dates, minus break time
 * @param {Date} checkIn - Check-in time
 * @param {Date} checkOut - Check-out time
 * @param {number} breakMinutes - Break time in minutes
 * @returns {number} Total hours (rounded to 2 decimals)
 */
const calculateTotalHours = (checkIn, checkOut, breakMinutes = 0) => {
  const diffMs = checkOut.getTime() - checkIn.getTime();
  const diffMinutes = diffMs / 60000;
  const workMinutes = Math.max(0, diffMinutes - breakMinutes);
  return Math.round((workMinutes / 60) * 100) / 100;
};

/**
 * Calculate late minutes based on shift start time and actual check-in
 * @param {Date} checkInTime - Actual check-in time
 * @param {string} shiftStartTime - Shift start time "HH:mm"
 * @param {number} graceMinutes - Grace period in minutes
 * @returns {number} Late minutes (0 if not late)
 */
const calculateLateMinutes = (checkInTime, shiftStartTime, graceMinutes = 0) => {
  const checkInMinutes = checkInTime.getHours() * 60 + checkInTime.getMinutes();
  const shiftMinutes = timeToMinutes(shiftStartTime);
  const effectiveStart = shiftMinutes + graceMinutes;

  if (checkInMinutes > effectiveStart) {
    return checkInMinutes - shiftMinutes;
  }
  return 0;
};

/**
 * Build pagination object
 * @param {number} page - Current page
 * @param {number} limit - Items per page
 * @param {number} total - Total items
 * @returns {Object} Pagination metadata
 */
const buildPagination = (page, limit, total) => {
  return {
    page: parseInt(page),
    limit: parseInt(limit),
    total,
    totalPages: Math.ceil(total / limit),
    hasNextPage: page * limit < total,
    hasPrevPage: page > 1,
  };
};

export { 
  getVietnamTime,
  startOfDay,
  endOfDay,
  calculateQuarter,
  generateEmployeeCode,
  timeToMinutes,
  calculateTotalHours,
  calculateLateMinutes,
  buildPagination,
 };
