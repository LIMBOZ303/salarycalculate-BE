export const normalizeDateOnly = (dateInput) => {
  const d = new Date(dateInput);
  if (Number.isNaN(d.getTime())) {
    throw new Error('Invalid date');
  }
  const normalized = new Date(d);
  normalized.setHours(0, 0, 0, 0);
  return normalized;
};

export const getDayRange = (dateInput) => {
  const startDate = normalizeDateOnly(dateInput);
  const endDate = new Date(startDate);
  endDate.setHours(23, 59, 59, 999);
  return { startDate, endDate };
};

export const getMonthRange = (month, year) => {
  const m = parseInt(month, 10);
  const y = parseInt(year, 10);
  const startDate = new Date(y, m - 1, 1);
  startDate.setHours(0, 0, 0, 0);
  const endDate = new Date(y, m, 0, 23, 59, 59, 999);
  return { startDate, endDate };
};

export const getQuarterRange = (quarter, year) => {
  const q = parseInt(quarter, 10);
  const y = parseInt(year, 10);
  if (q < 1 || q > 4) {
    throw new Error('Quarter must be between 1 and 4');
  }
  const startMonth = (q - 1) * 3;
  const startDate = new Date(y, startMonth, 1);
  startDate.setHours(0, 0, 0, 0);
  const endDate = new Date(y, startMonth + 3, 0, 23, 59, 59, 999);
  return { startDate, endDate };
};

export const getYearRange = (year) => {
  const y = parseInt(year, 10);
  const startDate = new Date(y, 0, 1);
  startDate.setHours(0, 0, 0, 0);
  const endDate = new Date(y, 11, 31, 23, 59, 59, 999);
  return { startDate, endDate };
};
