import Employee from '../models/Employee.js';
import User from '../models/User.js';
import Branch from '../models/Branch.js';
import { successResponse, errorResponse } from '../utils/response.js';
import { stripProtectedFields, hasProtectedFields } from '../utils/stripProtectedFields.js';

export const getEmployees = async (req, res) => {
  try {
    if (req.user.role === 'employee') {
      return errorResponse(res, 'Bạn không có quyền xem danh sách nhân viên', 403, 'Forbidden');
    }

    const filter = {};

    if (req.user.role === 'branch_manager') {
      if (!req.user.branchId) {
        return errorResponse(res, 'Bạn chưa được gán chi nhánh', 403, 'No branch assigned');
      }
      filter.branchId = req.user.branchId;
    } else if (req.query.branchId && ['admin', 'owner'].includes(req.user.role)) {
      filter.branchId = req.query.branchId;
    }

    if (req.query.status) filter.status = req.query.status;

    const employees = await Employee.find(filter)
      .populate('userId', 'fullName email phone role status avatar')
      .populate('branchId', 'name address phone')
      .populate('shiftId', 'name startTime endTime')
      .sort({ createdAt: -1 });

    return successResponse(res, { employees }, 'Lấy danh sách nhân viên thành công');
  } catch (error) {
    return errorResponse(res, 'Lấy danh sách nhân viên thất bại', 500, error.message);
  }
};

export const getEmployeeById = async (req, res) => {
  try {
    const employee = await Employee.findById(req.params.id)
      .populate('userId', 'fullName email phone role status avatar')
      .populate('branchId', 'name address phone')
      .populate('shiftId', 'name startTime endTime')
      .populate('approvedBy', 'fullName email');

    if (!employee) {
      return errorResponse(res, 'Không tìm thấy nhân viên', 404, 'Employee not found');
    }

    if (req.user.role === 'employee') {
      if (employee.userId._id.toString() !== req.user._id.toString()) {
        return errorResponse(res, 'Bạn chỉ được xem hồ sơ của chính mình', 403, 'Forbidden');
      }
    } else if (req.user.role === 'branch_manager') {
      if (employee.branchId._id.toString() !== req.user.branchId?.toString()) {
        return errorResponse(
          res,
          'Bạn không có quyền xem nhân viên chi nhánh khác',
          403,
          'Forbidden'
        );
      }
    }

    return successResponse(res, { employee }, 'Lấy thông tin nhân viên thành công');
  } catch (error) {
    return errorResponse(res, 'Lấy thông tin nhân viên thất bại', 500, error.message);
  }
};

export const getMeEmployee = async (req, res) => {
  try {
    const employee = await Employee.findOne({ userId: req.user._id })
      .populate('branchId', 'name address phone latitude longitude')
      .populate('shiftId', 'name startTime endTime')
      .populate('approvedBy', 'fullName');

    if (!employee) {
      return errorResponse(res, 'Chưa có hồ sơ nhân sự', 404, 'Employee profile not found');
    }

    return successResponse(res, { employee }, 'Lấy thông tin nhân sự thành công');
  } catch (error) {
    return errorResponse(res, 'Lấy thông tin nhân sự thất bại', 500, error.message);
  }
};

export const createEmployee = async (req, res) => {
  try {
    const { userId, branchId, position, hourlyRate, shiftId, startDate, note } = req.body;

    if (hasProtectedFields(req.body)) {
      return errorResponse(res, 'Không được gửi role/status trong request', 403, 'Forbidden fields');
    }

    if (!userId || !branchId || !position || hourlyRate == null) {
      return errorResponse(
        res,
        'Vui lòng nhập userId, branchId, position và hourlyRate',
        400,
        'Validation failed'
      );
    }

    const user = await User.findById(userId);
    if (!user) {
      return errorResponse(res, 'Không tìm thấy tài khoản user', 404, 'User not found');
    }

    const branch = await Branch.findById(branchId);
    if (!branch) {
      return errorResponse(res, 'Không tìm thấy chi nhánh', 404, 'Branch not found');
    }

    const existingEmployee = await Employee.findOne({ userId });
    if (existingEmployee) {
      return errorResponse(res, 'User này đã có hồ sơ nhân sự', 409, 'Duplicate employee');
    }

    const employee = await Employee.create({
      userId: user._id,
      employeeCode: `EMP${Date.now()}`,
      fullName: user.fullName,
      phone: user.phone,
      email: user.email,
      avatar: user.avatar || '',
      branchId,
      position,
      hourlyRate,
      shiftId: shiftId || null,
      startDate: startDate ? new Date(startDate) : new Date(),
      status: 'active',
      approvedBy: req.user._id,
      approvedAt: new Date(),
      note: note || null,
    });

    user.branchId = branchId;
    if (user.status === 'pending') {
      user.status = 'active';
    }
    await user.save();

    return successResponse(res, { employee, user }, 'Tạo hồ sơ nhân sự thành công', 201);
  } catch (error) {
    return errorResponse(res, 'Tạo hồ sơ nhân sự thất bại', 500, error.message);
  }
};

export const updateEmployee = async (req, res) => {
  try {
    if (hasProtectedFields(req.body)) {
      return errorResponse(res, 'Không được cập nhật role/status tại đây', 403, 'Forbidden fields');
    }

    const employee = await Employee.findById(req.params.id);
    if (!employee) {
      return errorResponse(res, 'Không tìm thấy nhân viên', 404, 'Employee not found');
    }

    const updateData = stripProtectedFields(req.body);
    const allowedFields = [
      'fullName',
      'phone',
      'email',
      'dateOfBirth',
      'address',
      'citizenId',
      'branchId',
      'position',
      'hourlyRate',
      'shiftId',
      'status',
      'note',
      'avatar',
      'startDate',
    ];

    if (updateData.branchId) {
      const branch = await Branch.findById(updateData.branchId);
      if (!branch) {
        return errorResponse(res, 'Không tìm thấy chi nhánh', 404, 'Branch not found');
      }
    }

    for (const field of allowedFields) {
      if (updateData[field] !== undefined) {
        employee[field] = updateData[field];
      }
    }

    await employee.save();

    const user = await User.findById(employee.userId);
    if (user) {
      if (updateData.fullName) user.fullName = updateData.fullName;
      if (updateData.phone) user.phone = updateData.phone;
      if (updateData.email) user.email = updateData.email;
      if (updateData.branchId) user.branchId = updateData.branchId;
      if (updateData.status) {
        user.status = updateData.status === 'resigned' ? 'resigned' : user.status;
      }
      await user.save();
    }

    return successResponse(res, { employee }, 'Cập nhật nhân viên thành công');
  } catch (error) {
    return errorResponse(res, 'Cập nhật nhân viên thất bại', 500, error.message);
  }
};

export const deleteEmployee = async (req, res) => {
  try {
    const employee = await Employee.findById(req.params.id);
    if (!employee) {
      return errorResponse(res, 'Không tìm thấy nhân viên', 404, 'Employee not found');
    }

    employee.status = 'resigned';
    await employee.save();

    await User.findByIdAndUpdate(employee.userId, {
      status: 'resigned',
      deactivatedBy: req.user._id,
      deactivatedAt: new Date(),
      deactivationReason: 'Nghỉ việc theo quyết định admin',
    });

    return successResponse(res, { employee }, 'Đã đánh dấu nhân viên nghỉ việc');
  } catch (error) {
    return errorResponse(res, 'Xóa nhân viên thất bại', 500, error.message);
  }
};

// Giữ tên cũ để tương thích
export const getMyProfile = getMeEmployee;
