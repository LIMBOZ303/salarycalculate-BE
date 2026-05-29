import Attendance from '../models/Attendance.js';
import Employee from '../models/Employee.js';
import Branch from '../models/Branch.js';
import Shift from '../models/Shift.js';
import { successResponse, errorResponse } from '../utils/response.js';
import { calculateDistanceMeters } from '../utils/distanceCalculator.js';
import {
  calculateTotalHours,
  calculateLateMinutes,
  getStartOfDay,
  getMonthRange,
} from '../utils/attendanceCalculator.js';

const MAX_GPS_ACCURACY = 100;

const getEmployeeForUser = async (userId) => {
  return Employee.findOne({ userId });
};

const validateGpsForBranch = (latitude, longitude, accuracy, branch) => {
  if (latitude == null || longitude == null) {
    return {
      ok: false,
      status: 400,
      message: 'Vui lòng gửi tọa độ GPS (latitude, longitude)',
      error: 'Missing GPS',
    };
  }

  if (accuracy != null && accuracy > MAX_GPS_ACCURACY) {
    return {
      ok: false,
      status: 400,
      message: 'Vị trí chưa đủ chính xác',
      error: 'Low GPS accuracy',
    };
  }

  const distanceFromBranch = calculateDistanceMeters(
    latitude,
    longitude,
    branch.latitude,
    branch.longitude
  );

  if (distanceFromBranch > branch.allowedRadiusMeters) {
    return {
      ok: false,
      status: 403,
      message: 'Bạn đang ở ngoài khu vực chấm công',
      error: 'Out of allowed radius',
    };
  }

  return {
    ok: true,
    distanceFromBranch,
    location: { latitude, longitude, accuracy: accuracy ?? null, distanceFromBranch },
  };
};

export const checkIn = async (req, res) => {
  try {
    if (req.user.role !== 'employee') {
      return errorResponse(res, 'Chỉ nhân viên mới được check-in', 403, 'Forbidden');
    }

    const { latitude, longitude, accuracy, deviceInfo } = req.body;

    const employee = await getEmployeeForUser(req.user._id);
    if (!employee) {
      return errorResponse(res, 'Không tìm thấy hồ sơ nhân sự', 404, 'Employee not found');
    }
    if (employee.status !== 'active') {
      return errorResponse(res, 'Hồ sơ nhân sự không còn hoạt động', 403, 'Inactive employee');
    }

    const branch = await Branch.findById(employee.branchId);
    if (!branch) {
      return errorResponse(res, 'Chi nhánh không tồn tại', 404, 'Branch not found');
    }
    if (!branch.isActive) {
      return errorResponse(res, 'Chi nhánh đã bị vô hiệu hóa', 400, 'Branch inactive');
    }

    const today = getStartOfDay(new Date());
    const existing = await Attendance.findOne({ employeeId: employee._id, date: today });
    if (existing) {
      return errorResponse(res, 'Bạn đã check-in hôm nay rồi', 400, 'Already checked in');
    }

    const gps = validateGpsForBranch(latitude, longitude, accuracy, branch);
    if (!gps.ok) {
      return errorResponse(res, gps.message, gps.status, gps.error);
    }

    const now = new Date();
    const shift = employee.shiftId ? await Shift.findById(employee.shiftId) : null;

    let lateMinutes = 0;
    let breakMinutes = 0;
    let status = 'checked_in';

    if (shift) {
      lateMinutes = calculateLateMinutes(now, shift.startTime, shift.graceMinutes);
      breakMinutes = shift.breakMinutes || 0;
      status = lateMinutes > 0 ? 'late' : 'checked_in';
    }

    const attendance = await Attendance.create({
      employeeId: employee._id,
      userId: req.user._id,
      branchId: employee.branchId,
      shiftId: employee.shiftId || null,
      date: today,
      checkInTime: now,
      breakMinutes,
      lateMinutes,
      status,
      checkInLocation: gps.location,
      deviceInfo: deviceInfo || null,
      isSuspicious: false,
      suspiciousReasons: [],
    });

    return successResponse(res, { attendance }, 'Check-in thành công', 201);
  } catch (error) {
    return errorResponse(res, 'Check-in thất bại', 500, error.message);
  }
};

export const checkOut = async (req, res) => {
  try {
    if (req.user.role !== 'employee') {
      return errorResponse(res, 'Chỉ nhân viên mới được check-out', 403, 'Forbidden');
    }

    const { latitude, longitude, accuracy, deviceInfo } = req.body;

    const employee = await getEmployeeForUser(req.user._id);
    if (!employee) {
      return errorResponse(res, 'Không tìm thấy hồ sơ nhân sự', 404, 'Employee not found');
    }

    const today = getStartOfDay(new Date());
    const attendance = await Attendance.findOne({ employeeId: employee._id, date: today });

    if (!attendance || !attendance.checkInTime) {
      return errorResponse(res, 'Bạn chưa check-in hôm nay', 400, 'Not checked in');
    }
    if (attendance.checkOutTime) {
      return errorResponse(res, 'Bạn đã check-out rồi', 400, 'Already checked out');
    }
    if (attendance.isLocked) {
      return errorResponse(res, 'Bản công đã bị khóa', 400, 'Attendance locked');
    }

    const branch = await Branch.findById(employee.branchId);
    if (!branch) {
      return errorResponse(res, 'Chi nhánh không tồn tại', 404, 'Branch not found');
    }

    const gps = validateGpsForBranch(latitude, longitude, accuracy, branch);
    if (!gps.ok) {
      return errorResponse(res, gps.message, gps.status, gps.error);
    }

    const now = new Date();
    const totalHours = calculateTotalHours(
      attendance.checkInTime,
      now,
      attendance.breakMinutes
    );

    attendance.checkOutTime = now;
    attendance.totalHours = totalHours;
    attendance.status = 'completed';
    attendance.checkOutLocation = gps.location;
    if (deviceInfo) attendance.deviceInfo = deviceInfo;
    await attendance.save();

    return successResponse(res, { attendance, totalHours }, 'Check-out thành công');
  } catch (error) {
    return errorResponse(res, 'Check-out thất bại', 500, error.message);
  }
};

export const getMyTodayAttendance = async (req, res) => {
  try {
    const employee = await getEmployeeForUser(req.user._id);
    if (!employee) {
      return errorResponse(res, 'Không tìm thấy hồ sơ nhân sự', 404, 'Employee not found');
    }

    const today = getStartOfDay(new Date());
    const attendance = await Attendance.findOne({
      employeeId: employee._id,
      date: today,
    }).populate('shiftId', 'name startTime endTime');

    if (!attendance) {
      return successResponse(
        res,
        { status: 'not_checked_in', attendance: null },
        'Chưa chấm công hôm nay'
      );
    }

    return successResponse(res, { attendance, status: attendance.status }, 'Lấy công hôm nay thành công');
  } catch (error) {
    return errorResponse(res, 'Lấy công hôm nay thất bại', 500, error.message);
  }
};

export const getMyAttendanceSummary = async (req, res) => {
  try {
    const employee = await getEmployeeForUser(req.user._id);
    if (!employee) {
      return errorResponse(res, 'Không tìm thấy hồ sơ nhân sự', 404, 'Employee not found');
    }

    const month = parseInt(req.query.month, 10) || new Date().getMonth() + 1;
    const year = parseInt(req.query.year, 10) || new Date().getFullYear();
    const { startDate, endDate } = getMonthRange(month, year);

    const attendances = await Attendance.find({
      employeeId: employee._id,
      date: { $gte: startDate, $lte: endDate },
    });

    const totalHours = attendances.reduce((s, a) => s + (a.totalHours || 0), 0);
    const completedDays = attendances.filter((a) => a.status === 'completed').length;
    const lateCount = attendances.filter((a) => (a.lateMinutes || 0) > 0).length;
    const lateMinutes = attendances.reduce((s, a) => s + (a.lateMinutes || 0), 0);
    const missingCheckoutDays = attendances.filter(
      (a) =>
        a.status === 'missing_checkout' ||
        (['checked_in', 'late'].includes(a.status) && !a.checkOutTime)
    ).length;
    const totalWorkingDays = attendances.filter((a) => a.checkInTime).length;

    return successResponse(
      res,
      {
        month,
        year,
        totalHours: Math.round(totalHours * 100) / 100,
        totalWorkingDays,
        lateCount,
        lateMinutes,
        completedDays,
        missingCheckoutDays,
      },
      'Lấy tổng hợp chấm công thành công'
    );
  } catch (error) {
    return errorResponse(res, 'Lấy tổng hợp thất bại', 500, error.message);
  }
};

export const getMyAttendanceHistory = async (req, res) => {
  try {
    const employee = await getEmployeeForUser(req.user._id);
    if (!employee) {
      return errorResponse(res, 'Không tìm thấy hồ sơ nhân sự', 404, 'Employee not found');
    }

    const month = parseInt(req.query.month, 10) || new Date().getMonth() + 1;
    const year = parseInt(req.query.year, 10) || new Date().getFullYear();
    const { startDate, endDate } = getMonthRange(month, year);

    const history = await Attendance.find({
      employeeId: employee._id,
      date: { $gte: startDate, $lte: endDate },
    })
      .populate('shiftId', 'name startTime endTime')
      .populate('branchId', 'name')
      .sort({ date: -1 });

    return successResponse(res, { history }, 'Lấy lịch sử chấm công thành công');
  } catch (error) {
    return errorResponse(res, 'Lấy lịch sử thất bại', 500, error.message);
  }
};

export const getAttendances = async (req, res) => {
  try {
    if (req.user.role === 'employee') {
      return errorResponse(res, 'Bạn không có quyền xem bảng công', 403, 'Forbidden');
    }

    const { branchId, employeeId, month, year, status } = req.query;
    const filter = {};

    if (req.user.role === 'branch_manager') {
      if (!req.user.branchId) {
        return errorResponse(res, 'Bạn chưa được gán chi nhánh', 403, 'No branch');
      }
      filter.branchId = req.user.branchId;
      if (branchId && String(branchId) !== String(req.user.branchId)) {
        return errorResponse(
          res,
          'Không được xem bảng công chi nhánh khác',
          403,
          'Forbidden branch'
        );
      }
    } else if (branchId && req.user.role === 'admin') {
      filter.branchId = branchId;
    }

    if (employeeId) filter.employeeId = employeeId;
    if (status) filter.status = status;

    if (month && year) {
      const { startDate, endDate } = getMonthRange(month, year);
      filter.date = { $gte: startDate, $lte: endDate };
    }

    const attendances = await Attendance.find(filter)
      .populate('employeeId', 'fullName employeeCode')
      .populate('branchId', 'name')
      .populate('shiftId', 'name startTime endTime')
      .sort({ date: -1 });

    return successResponse(res, { attendances }, 'Lấy bảng công thành công');
  } catch (error) {
    return errorResponse(res, 'Lấy bảng công thất bại', 500, error.message);
  }
};

export const getSuspiciousAttendances = async (req, res) => {
  try {
    const { month, year } = req.query;
    const filter = { isSuspicious: true };

    if (req.user.role === 'branch_manager') {
      if (!req.user.branchId) {
        return errorResponse(res, 'Bạn chưa được gán chi nhánh', 403, 'No branch');
      }
      filter.branchId = req.user.branchId;
    }

    if (month && year) {
      const { startDate, endDate } = getMonthRange(month, year);
      filter.date = { $gte: startDate, $lte: endDate };
    }

    const attendances = await Attendance.find(filter)
      .populate('employeeId', 'fullName employeeCode')
      .populate('branchId', 'name')
      .sort({ date: -1 });

    return successResponse(res, { attendances }, 'Lấy công đáng ngờ thành công');
  } catch (error) {
    return errorResponse(res, 'Lấy công đáng ngờ thất bại', 500, error.message);
  }
};

export const updateAttendance = async (req, res) => {
  try {
    const { reason, checkInTime, checkOutTime, breakMinutes, status, note } = req.body;

    if (!reason) {
      return errorResponse(res, 'Vui lòng nhập lý do sửa công', 400, 'reason required');
    }

    const attendance = await Attendance.findById(req.params.id);
    if (!attendance) {
      return errorResponse(res, 'Không tìm thấy bản công', 404, 'Not found');
    }
    if (attendance.isLocked) {
      return errorResponse(res, 'Bản công đã bị khóa', 400, 'Locked');
    }

    const oldValue = {
      checkInTime: attendance.checkInTime,
      checkOutTime: attendance.checkOutTime,
      breakMinutes: attendance.breakMinutes,
      status: attendance.status,
      note: attendance.note,
      totalHours: attendance.totalHours,
    };

    if (checkInTime !== undefined) attendance.checkInTime = new Date(checkInTime);
    if (checkOutTime !== undefined) attendance.checkOutTime = new Date(checkOutTime);
    if (breakMinutes !== undefined) attendance.breakMinutes = breakMinutes;
    if (status !== undefined) attendance.status = status;
    if (note !== undefined) attendance.note = note;

    if (attendance.checkInTime && attendance.checkOutTime) {
      attendance.totalHours = calculateTotalHours(
        attendance.checkInTime,
        attendance.checkOutTime,
        attendance.breakMinutes
      );
      if (!status) attendance.status = 'edited';
    }

    attendance.editHistory.push({
      editedBy: req.user._id,
      editedAt: new Date(),
      reason,
      oldValue,
      newValue: {
        checkInTime: attendance.checkInTime,
        checkOutTime: attendance.checkOutTime,
        breakMinutes: attendance.breakMinutes,
        status: attendance.status,
        note: attendance.note,
        totalHours: attendance.totalHours,
      },
    });

    await attendance.save();

    return successResponse(res, { attendance }, 'Cập nhật bản công thành công');
  } catch (error) {
    return errorResponse(res, 'Cập nhật bản công thất bại', 500, error.message);
  }
};

export const lockAttendance = async (req, res) => {
  try {
    const attendance = await Attendance.findById(req.params.id);
    if (!attendance) {
      return errorResponse(res, 'Không tìm thấy bản công', 404, 'Not found');
    }

    attendance.isLocked = true;
    await attendance.save();

    return successResponse(res, { attendance }, 'Đã khóa bản công');
  } catch (error) {
    return errorResponse(res, 'Khóa bản công thất bại', 500, error.message);
  }
};

// Alias tương thích route cũ
export const getMyToday = getMyTodayAttendance;
export const getMySummary = getMyAttendanceSummary;
export const getMyHistory = getMyAttendanceHistory;
export const getSuspicious = getSuspiciousAttendances;
