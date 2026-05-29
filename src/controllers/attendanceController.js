import Attendance from '../models/Attendance.js';
import Employee from '../models/Employee.js';
import Branch from '../models/Branch.js';
import Shift from '../models/Shift.js';
import {  successResponse, errorResponse, paginatedResponse  } from '../utils/response.js';
import {  isWithinRadius, validateLocationAccuracy  } from '../utils/gps.js';
import {  logAction, getClientIp  } from '../utils/auditLogger.js';
import {  startOfDay, endOfDay, calculateTotalHours, calculateLateMinutes, buildPagination  } from '../utils/helpers.js';

/**
 * @desc    Check-in (anti-fraud)
 * @route   POST /api/attendance/check-in
 * @access  Employee
 */
const checkIn = async (req, res, next) => {
  try {
    const { latitude, longitude, accuracy, deviceInfo, selfieUrl, qrCodeId } = req.body;

    // 1. Get employeeId from JWT (NEVER from body)
    const employee = await Employee.findOne({ userId: req.user.id });
    if (!employee) return errorResponse(res, 'Không tìm thấy hồ sơ nhân viên', 404);
    if (!employee.branchId) return errorResponse(res, 'Bạn chưa được gán chi nhánh', 400);

    // 2. Use SERVER time (never client time)
    const now = new Date();
    const today = startOfDay(now);

    // 3. Check if already checked in today
    const existing = await Attendance.findOne({ employeeId: employee._id, date: today });
    if (existing) return errorResponse(res, 'Bạn đã chấm công vào hôm nay rồi', 400);

    // 4. Get branch and shift
    const branch = await Branch.findById(employee.branchId);
    if (!branch) return errorResponse(res, 'Chi nhánh không tồn tại', 404);
    if (!branch.isActive) return errorResponse(res, 'Chi nhánh đã bị vô hiệu hóa', 400);

    const shift = employee.shiftId ? await Shift.findById(employee.shiftId) : null;

    // 5. Validate GPS
    const suspiciousReasons = [];
    let checkInLocation = null;

    if (latitude != null && longitude != null) {
      const gpsResult = isWithinRadius(latitude, longitude, branch.latitude, branch.longitude, branch.allowedRadiusMeters);
      checkInLocation = { latitude, longitude, accuracy: accuracy || null, distanceFromBranch: gpsResult.distance };

      if (!gpsResult.isWithin) {
        suspiciousReasons.push(`GPS ngoài bán kính: ${gpsResult.distance}m (cho phép: ${branch.allowedRadiusMeters}m)`);
      }
      if (accuracy && !validateLocationAccuracy(accuracy)) {
        suspiciousReasons.push(`Độ chính xác GPS thấp: ${accuracy}m`);
      }
    } else {
      suspiciousReasons.push('Không có dữ liệu GPS');
    }

    // 6. Calculate late minutes
    let lateMinutes = 0;
    if (shift) {
      lateMinutes = calculateLateMinutes(now, shift.startTime, shift.graceMinutes);
      if (lateMinutes > 0) suspiciousReasons.push(`Đi trễ ${lateMinutes} phút`);
    }

    // 7. Create attendance
    const attendance = await Attendance.create({
      employeeId: employee._id,
      userId: req.user.id,
      branchId: employee.branchId,
      shiftId: employee.shiftId || null,
      date: today,
      checkInTime: now,
      breakMinutes: shift ? shift.breakMinutes : 0,
      lateMinutes,
      status: 'checked_in',
      checkInLocation,
      deviceInfo: deviceInfo || null,
      checkInSelfieUrl: selfieUrl || null,
      qrCodeId: qrCodeId || null,
      isSuspicious: suspiciousReasons.length > 0,
      suspiciousReasons,
      ipAddress: getClientIp(req),
    });

    await logAction({ userId: req.user.id, role: req.user.role, action: 'CHECK_IN', resource: 'Attendance', resourceId: attendance._id, newValue: { checkInTime: now, lateMinutes, isSuspicious: attendance.isSuspicious }, req });

    return successResponse(res, {
      attendance,
      message: lateMinutes > 0 ? `Chấm công vào thành công (trễ ${lateMinutes} phút)` : 'Chấm công vào thành công',
    }, 'Chấm công vào thành công', 201);
  } catch (error) { next(error); }
};

/**
 * @desc    Check-out
 * @route   POST /api/attendance/check-out
 * @access  Employee
 */
const checkOut = async (req, res, next) => {
  try {
    const { latitude, longitude, accuracy, deviceInfo, selfieUrl } = req.body;

    const employee = await Employee.findOne({ userId: req.user.id });
    if (!employee) return errorResponse(res, 'Không tìm thấy hồ sơ nhân viên', 404);

    const now = new Date();
    const today = startOfDay(now);

    // Find today's attendance
    const attendance = await Attendance.findOne({ employeeId: employee._id, date: today });
    if (!attendance) return errorResponse(res, 'Bạn chưa chấm công vào hôm nay', 400);
    if (attendance.checkOutTime) return errorResponse(res, 'Bạn đã chấm công ra rồi', 400);
    if (attendance.isLocked) return errorResponse(res, 'Bản công đã bị khóa', 400);

    // Validate GPS
    const branch = await Branch.findById(employee.branchId);
    let checkOutLocation = null;
    const reasons = [...attendance.suspiciousReasons];

    if (latitude != null && longitude != null && branch) {
      const gpsResult = isWithinRadius(latitude, longitude, branch.latitude, branch.longitude, branch.allowedRadiusMeters);
      checkOutLocation = { latitude, longitude, accuracy: accuracy || null, distanceFromBranch: gpsResult.distance };
      if (!gpsResult.isWithin) reasons.push(`Check-out ngoài bán kính: ${gpsResult.distance}m`);
      if (accuracy && !validateLocationAccuracy(accuracy)) reasons.push(`Check-out GPS accuracy thấp: ${accuracy}m`);
    } else {
      reasons.push('Không có GPS khi check-out');
    }

    // Calculate total hours
    const totalHours = calculateTotalHours(attendance.checkInTime, now, attendance.breakMinutes);

    attendance.checkOutTime = now;
    attendance.totalHours = totalHours;
    attendance.status = 'checked_out';
    attendance.checkOutLocation = checkOutLocation;
    attendance.checkOutSelfieUrl = selfieUrl || null;
    attendance.isSuspicious = reasons.length > 0;
    attendance.suspiciousReasons = reasons;
    await attendance.save();

    await logAction({ userId: req.user.id, role: req.user.role, action: 'CHECK_OUT', resource: 'Attendance', resourceId: attendance._id, newValue: { checkOutTime: now, totalHours }, req });

    return successResponse(res, { attendance, totalHours }, 'Chấm công ra thành công');
  } catch (error) { next(error); }
};

/**
 * @desc    Get my today's attendance
 * @route   GET /api/attendance/me/today
 */
const getMyToday = async (req, res, next) => {
  try {
    const employee = await Employee.findOne({ userId: req.user.id });
    if (!employee) return errorResponse(res, 'Không tìm thấy hồ sơ', 404);
    const today = startOfDay(new Date());
    const attendance = await Attendance.findOne({ employeeId: employee._id, date: today })
      .populate('shiftId', 'name startTime endTime');
    return successResponse(res, attendance || null);
  } catch (error) { next(error); }
};

/**
 * @desc    Get my monthly summary
 * @route   GET /api/attendance/me/summary?month=&year=
 */
const getMySummary = async (req, res, next) => {
  try {
    const employee = await Employee.findOne({ userId: req.user.id });
    if (!employee) return errorResponse(res, 'Không tìm thấy hồ sơ', 404);
    const month = parseInt(req.query.month) || new Date().getMonth() + 1;
    const year = parseInt(req.query.year) || new Date().getFullYear();
    const startDate = new Date(year, month - 1, 1);
    const endDate = new Date(year, month, 0, 23, 59, 59);

    const attendances = await Attendance.find({ employeeId: employee._id, date: { $gte: startDate, $lte: endDate } });
    const totalHours = attendances.reduce((sum, a) => sum + (a.totalHours || 0), 0);
    const totalWorkingDays = attendances.filter(a => a.status === 'checked_out').length;
    const lateCount = attendances.filter(a => a.lateMinutes > 0).length;
    const totalLateMinutes = attendances.reduce((sum, a) => sum + (a.lateMinutes || 0), 0);

    return successResponse(res, { month, year, totalHours: Math.round(totalHours * 100) / 100, totalWorkingDays, lateCount, totalLateMinutes, totalRecords: attendances.length });
  } catch (error) { next(error); }
};

/**
 * @desc    Get my attendance history
 * @route   GET /api/attendance/me/history?month=&year=
 */
const getMyHistory = async (req, res, next) => {
  try {
    const employee = await Employee.findOne({ userId: req.user.id });
    if (!employee) return errorResponse(res, 'Không tìm thấy hồ sơ', 404);
    const month = parseInt(req.query.month) || new Date().getMonth() + 1;
    const year = parseInt(req.query.year) || new Date().getFullYear();
    const startDate = new Date(year, month - 1, 1);
    const endDate = new Date(year, month, 0, 23, 59, 59);

    const history = await Attendance.find({ employeeId: employee._id, date: { $gte: startDate, $lte: endDate } })
      .populate('shiftId', 'name startTime endTime')
      .sort({ date: -1 });
    return successResponse(res, history);
  } catch (error) { next(error); }
};

/**
 * @desc    Request edit attendance
 * @route   POST /api/attendance/me/request-edit
 */
const requestEdit = async (req, res, next) => {
  try {
    const { attendanceId, reason } = req.body;
    if (!attendanceId || !reason) return errorResponse(res, 'Vui lòng cung cấp ID bản công và lý do', 400);
    const employee = await Employee.findOne({ userId: req.user.id });
    if (!employee) return errorResponse(res, 'Không tìm thấy hồ sơ', 404);

    const attendance = await Attendance.findOne({ _id: attendanceId, employeeId: employee._id });
    if (!attendance) return errorResponse(res, 'Không tìm thấy bản công', 404);
    if (attendance.isLocked) return errorResponse(res, 'Bản công đã bị khóa', 400);

    attendance.requestEditStatus = 'pending';
    attendance.requestEditReason = reason;
    await attendance.save();

    await logAction({ userId: req.user.id, role: req.user.role, action: 'REQUEST_EDIT', resource: 'Attendance', resourceId: attendance._id, newValue: { reason }, req });
    return successResponse(res, attendance, 'Đã gửi yêu cầu sửa công');
  } catch (error) { next(error); }
};

/**
 * @desc    Get attendances (admin/owner/branch_manager)
 * @route   GET /api/attendance
 */
const getAttendances = async (req, res, next) => {
  try {
    const { page = 1, limit = 20, branchId, employeeId, month, year, status } = req.query;
    const skip = (parseInt(page) - 1) * parseInt(limit);
    const filter = { ...req.branchFilter };
    if (branchId && req.user.role === 'admin') filter.branchId = branchId;
    if (employeeId) filter.employeeId = employeeId;
    if (status) filter.status = status;
    if (month && year) {
      const start = new Date(parseInt(year), parseInt(month) - 1, 1);
      const end = new Date(parseInt(year), parseInt(month), 0, 23, 59, 59);
      filter.date = { $gte: start, $lte: end };
    }

    const [attendances, total] = await Promise.all([
      Attendance.find(filter)
        .populate('employeeId', 'fullName employeeCode')
        .populate('branchId', 'name')
        .populate('shiftId', 'name startTime endTime')
        .sort({ date: -1 }).skip(skip).limit(parseInt(limit)),
      Attendance.countDocuments(filter),
    ]);
    return paginatedResponse(res, attendances, buildPagination(page, limit, total));
  } catch (error) { next(error); }
};

/**
 * @desc    Get suspicious attendances
 * @route   GET /api/attendance/suspicious
 */
const getSuspicious = async (req, res, next) => {
  try {
    const { month, year } = req.query;
    const filter = { isSuspicious: true, ...req.branchFilter };
    if (month && year) {
      filter.date = { $gte: new Date(parseInt(year), parseInt(month) - 1, 1), $lte: new Date(parseInt(year), parseInt(month), 0, 23, 59, 59) };
    }
    const records = await Attendance.find(filter)
      .populate('employeeId', 'fullName employeeCode')
      .populate('branchId', 'name')
      .sort({ date: -1 });
    return successResponse(res, records);
  } catch (error) { next(error); }
};

/**
 * @desc    Update attendance (admin only)
 * @route   PUT /api/attendance/:id
 */
const updateAttendance = async (req, res, next) => {
  try {
    const attendance = await Attendance.findById(req.params.id);
    if (!attendance) return errorResponse(res, 'Không tìm thấy bản công', 404);
    if (attendance.isLocked) return errorResponse(res, 'Bản công đã bị khóa', 400);

    const oldValue = attendance.toObject();
    const updateData = req.body;
    // Recalculate total hours if times changed
    if (updateData.checkInTime && updateData.checkOutTime) {
      updateData.totalHours = calculateTotalHours(new Date(updateData.checkInTime), new Date(updateData.checkOutTime), attendance.breakMinutes);
    }
    attendance.editHistory.push({ editedBy: req.user.id, editedAt: new Date(), field: Object.keys(updateData).join(', '), oldValue: JSON.stringify(oldValue), newValue: JSON.stringify(updateData), reason: updateData.editReason || 'Admin edit' });
    Object.assign(attendance, updateData);
    await attendance.save();

    await logAction({ userId: req.user.id, role: req.user.role, action: 'UPDATE', resource: 'Attendance', resourceId: attendance._id, oldValue, newValue: updateData, req });
    return successResponse(res, attendance, 'Cập nhật bản công thành công');
  } catch (error) { next(error); }
};

/**
 * @desc    Lock attendance
 * @route   POST /api/attendance/:id/lock
 */
const lockAttendance = async (req, res, next) => {
  try {
    const attendance = await Attendance.findById(req.params.id);
    if (!attendance) return errorResponse(res, 'Không tìm thấy bản công', 404);
    attendance.isLocked = true;
    await attendance.save();
    await logAction({ userId: req.user.id, role: req.user.role, action: 'LOCK_ATTENDANCE', resource: 'Attendance', resourceId: attendance._id, req });
    return successResponse(res, attendance, 'Đã khóa bản công');
  } catch (error) { next(error); }
};

/**
 * @desc    Close month attendance
 * @route   POST /api/attendance/close-month
 */
const closeMonth = async (req, res, next) => {
  try {
    const { month, year, branchId } = req.body;
    if (!month || !year) return errorResponse(res, 'Vui lòng cung cấp tháng và năm', 400);
    const start = new Date(parseInt(year), parseInt(month) - 1, 1);
    const end = new Date(parseInt(year), parseInt(month), 0, 23, 59, 59);
    const filter = { date: { $gte: start, $lte: end } };
    if (branchId) filter.branchId = branchId;

    const result = await Attendance.updateMany(filter, { isLocked: true });
    await logAction({ userId: req.user.id, role: req.user.role, action: 'CLOSE_ATTENDANCE', resource: 'Attendance', resourceId: null, newValue: { month, year, branchId, lockedCount: result.modifiedCount }, req });
    return successResponse(res, { lockedCount: result.modifiedCount }, `Đã chốt công tháng ${month}/${year}`);
  } catch (error) { next(error); }
};

export {  checkIn, checkOut, getMyToday, getMySummary, getMyHistory, requestEdit, getAttendances, getSuspicious, updateAttendance, lockAttendance, closeMonth  };
