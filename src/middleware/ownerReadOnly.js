import {  errorResponse  } from '../utils/response.js';

/**
 * Owner Read-Only Middleware
 * Blocks write operations (POST, PUT, PATCH, DELETE) for owner role
 * Owner can only perform GET requests
 * Must be used AFTER authMiddleware
 */
const ownerReadOnlyMiddleware = (req, res, next) => {
  if (req.user.role === 'owner' && req.method !== 'GET') {
    return errorResponse(
      res,
      'Owner chỉ có quyền xem dữ liệu, không được thêm/sửa/xóa',
      403
    );
  }

  next();
};

export default ownerReadOnlyMiddleware;
