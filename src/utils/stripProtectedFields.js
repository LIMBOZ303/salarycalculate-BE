/**
 * Loại bỏ các field nhạy cảm khỏi body request
 */
export const stripProtectedFields = (body, fields = ['role', 'status']) => {
  const cleaned = { ...body };
  for (const field of fields) {
    delete cleaned[field];
  }
  return cleaned;
};

export const hasProtectedFields = (body, fields = ['role', 'status']) => {
  return fields.some((field) => body[field] !== undefined);
};
