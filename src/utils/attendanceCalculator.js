/**
 * Parse "HH:mm" -> phút từ 00:00
 */
export const timeToMinutes = (timeStr) => {
  const [hours, minutes] = timeStr.split(':').map(Number);
  return hours * 60 + minutes;
};

export const calculateTotalHours = (checkInTime, checkOutTime, breakMinutes = 0) => {
  if (!checkInTime || !checkOutTime) return 0;
  const diffMs = new Date(checkOutTime).getTime() - new Date(checkInTime).getTime();
  const diffMinutes = diffMs / 60000;
  const workMinutes = Math.max(0, diffMinutes - (breakMinutes || 0));
  const hours = workMinutes / 60;
  return Math.max(0, Math.round(hours * 100) / 100);
};

export const calculateLateMinutes = (checkInTime, shiftStartTime, graceMinutes = 0) => {
  if (!checkInTime || !shiftStartTime) return 0;
  const checkIn = new Date(checkInTime);
  const checkInMinutes = checkIn.getHours() * 60 + checkIn.getMinutes();
  const shiftMinutes = timeToMinutes(shiftStartTime);
  const effectiveStart = shiftMinutes + (graceMinutes || 0);

  if (checkInMinutes > effectiveStart) {
    return checkInMinutes - shiftMinutes;
  }
  return 0;
};

export const getStartOfDay = (date = new Date()) => {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d;
};

export const getEndOfDay = (date = new Date()) => {
  const d = new Date(date);
  d.setHours(23, 59, 59, 999);
  return d;
};

export const getMonthRange = (month, year) => {
  const m = parseInt(month, 10);
  const y = parseInt(year, 10);
  const startDate = new Date(y, m - 1, 1);
  const endDate = new Date(y, m, 0, 23, 59, 59, 999);
  return { startDate, endDate };
};
