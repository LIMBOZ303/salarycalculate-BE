import Shift from '../models/Shift.js';
import {  successResponse, errorResponse  } from '../utils/response.js';
import {  logAction  } from '../utils/auditLogger.js';

const getShifts = async (req, res, next) => {
  try {
    const filter = {};
    if (req.query.isActive) filter.isActive = req.query.isActive === 'true';
    const shifts = await Shift.find(filter).sort({ startTime: 1 });
    return successResponse(res, shifts, 'Lấy danh sách ca làm thành công');
  } catch (error) { next(error); }
};

const getShiftById = async (req, res, next) => {
  try {
    const shift = await Shift.findById(req.params.id);
    if (!shift) return errorResponse(res, 'Không tìm thấy ca làm', 404);
    return successResponse(res, shift);
  } catch (error) { next(error); }
};

const createShift = async (req, res, next) => {
  try {
    const { name, startTime, endTime, breakMinutes, graceMinutes, allowCheckInBeforeMinutes, allowCheckOutAfterMinutes } = req.body;
    if (!name || !startTime || !endTime) return errorResponse(res, 'Vui lòng điền: tên ca, giờ bắt đầu, giờ kết thúc', 400);
    const shift = await Shift.create({ name, startTime, endTime, breakMinutes: breakMinutes || 0, graceMinutes: graceMinutes || 15, allowCheckInBeforeMinutes: allowCheckInBeforeMinutes || 30, allowCheckOutAfterMinutes: allowCheckOutAfterMinutes || 30 });
    await logAction({ userId: req.user.id, role: req.user.role, action: 'CREATE', resource: 'Shift', resourceId: shift._id, newValue: { name, startTime, endTime }, req });
    return successResponse(res, shift, 'Tạo ca làm thành công', 201);
  } catch (error) { next(error); }
};

const updateShift = async (req, res, next) => {
  try {
    const shift = await Shift.findById(req.params.id);
    if (!shift) return errorResponse(res, 'Không tìm thấy ca làm', 404);
    const oldValue = shift.toObject();
    Object.assign(shift, req.body);
    await shift.save();
    await logAction({ userId: req.user.id, role: req.user.role, action: 'UPDATE', resource: 'Shift', resourceId: shift._id, oldValue, newValue: req.body, req });
    return successResponse(res, shift, 'Cập nhật ca làm thành công');
  } catch (error) { next(error); }
};

const deleteShift = async (req, res, next) => {
  try {
    const shift = await Shift.findById(req.params.id);
    if (!shift) return errorResponse(res, 'Không tìm thấy ca làm', 404);
    shift.isActive = false;
    await shift.save();
    await logAction({ userId: req.user.id, role: req.user.role, action: 'DELETE', resource: 'Shift', resourceId: shift._id, req });
    return successResponse(res, null, 'Đã vô hiệu hóa ca làm');
  } catch (error) { next(error); }
};

export {  getShifts, getShiftById, createShift, updateShift, deleteShift  };
