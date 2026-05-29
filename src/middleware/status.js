import { errorResponse } from '../utils/response.js';

const statusMiddleware = (req, res, next) => {
  const { status } = req.user;

  const statusMessages = {
    pending: 'Tài khoản đang chờ duyệt. Vui lòng liên hệ admin.',
    inactive: 'Tài khoản đã bị vô hiệu hóa.',
    locked: 'Tài khoản đã bị khóa. Vui lòng liên hệ admin.',
    resigned: 'Tài khoản đã nghỉ việc.',
    rejected: 'Tài khoản đã bị từ chối.',
  };

  if (status !== 'active') {
    return errorResponse(
      res,
      statusMessages[status] || 'Tài khoản không hoạt động',
      403
    );
  }

  next();
};

export default statusMiddleware;
