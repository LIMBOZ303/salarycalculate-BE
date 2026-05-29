import Shift from '../models/Shift.js';
import { successResponse, errorResponse } from '../utils/response.js';

const blockEmployee = (req, res) => {
  if (req.user.role === 'employee') {
    errorResponse(res, 'Nhân viên không có quyền xem ca làm', 403, 'Forbidden');
    return true;
  }
  return false;
};

export const getShifts = async (req, res) => {
  try {
    if (blockEmployee(req, res)) return;

    const filter = {};
    if (req.query.isActive !== undefined) {
      filter.isActive = req.query.isActive === 'true';
    }

    const shifts = await Shift.find(filter).sort({ startTime: 1 });
    return successResponse(res, { shifts }, 'Lấy danh sách ca làm thành công');
  } catch (error) {
    return errorResponse(res, 'Lấy danh sách ca làm thất bại', 500, error.message);
  }
};

export const getShiftById = async (req, res) => {
  try {
    if (blockEmployee(req, res)) return;

    const shift = await Shift.findById(req.params.id);
    if (!shift) {
      return errorResponse(res, 'Không tìm thấy ca làm', 404, 'Shift not found');
    }
    return successResponse(res, { shift }, 'Lấy ca làm thành công');
  } catch (error) {
    return errorResponse(res, 'Lấy ca làm thất bại', 500, error.message);
  }
};

export const createShift = async (req, res) => {
  try {
    const {
      name,
      startTime,
      endTime,
      breakMinutes,
      graceMinutes,
      allowCheckInBeforeMinutes,
      allowCheckOutAfterMinutes,
    } = req.body;

    if (!name || !startTime || !endTime) {
      return errorResponse(
        res,
        'Vui lòng nhập tên ca, giờ bắt đầu và giờ kết thúc',
        400,
        'Validation failed'
      );
    }

    const shift = await Shift.create({
      name,
      startTime,
      endTime,
      breakMinutes: breakMinutes ?? 0,
      graceMinutes: graceMinutes ?? 0,
      allowCheckInBeforeMinutes: allowCheckInBeforeMinutes ?? 30,
      allowCheckOutAfterMinutes: allowCheckOutAfterMinutes ?? 60,
    });

    return successResponse(res, { shift }, 'Tạo ca làm thành công', 201);
  } catch (error) {
    return errorResponse(res, 'Tạo ca làm thất bại', 500, error.message);
  }
};

export const updateShift = async (req, res) => {
  try {
    const shift = await Shift.findById(req.params.id);
    if (!shift) {
      return errorResponse(res, 'Không tìm thấy ca làm', 404, 'Shift not found');
    }

    const allowed = [
      'name',
      'startTime',
      'endTime',
      'breakMinutes',
      'graceMinutes',
      'allowCheckInBeforeMinutes',
      'allowCheckOutAfterMinutes',
      'isActive',
    ];

    for (const field of allowed) {
      if (req.body[field] !== undefined) {
        shift[field] = req.body[field];
      }
    }

    await shift.save();
    return successResponse(res, { shift }, 'Cập nhật ca làm thành công');
  } catch (error) {
    return errorResponse(res, 'Cập nhật ca làm thất bại', 500, error.message);
  }
};

export const deleteShift = async (req, res) => {
  try {
    const shift = await Shift.findById(req.params.id);
    if (!shift) {
      return errorResponse(res, 'Không tìm thấy ca làm', 404, 'Shift not found');
    }

    shift.isActive = false;
    await shift.save();

    return successResponse(res, { shift }, 'Đã vô hiệu hóa ca làm');
  } catch (error) {
    return errorResponse(res, 'Vô hiệu hóa ca làm thất bại', 500, error.message);
  }
};
