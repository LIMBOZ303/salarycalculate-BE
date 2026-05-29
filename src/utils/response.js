export const successResponse = (
  res,
  data = null,
  message = 'Thành công',
  statusCode = 200
) => {
  return res.status(statusCode).json({
    success: true,
    message,
    data,
  });
};

export const errorResponse = (
  res,
  message = 'Có lỗi xảy ra',
  statusCode = 500,
  error = null
) => {
  return res.status(statusCode).json({
    success: false,
    message,
    error: error || message,
  });
};

export const paginatedResponse = (res, data, pagination, message = 'Thành công') => {
  return res.status(200).json({
    success: true,
    message,
    data,
    pagination,
  });
};
