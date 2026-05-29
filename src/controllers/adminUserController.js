import User from '../models/User.js';
import Employee from '../models/Employee.js';
import Branch from '../models/Branch.js';
import { successResponse, errorResponse } from '../utils/response.js';

const VALID_ROLES = ['admin', 'owner', 'branch_manager', 'employee'];
const VALID_STATUSES = ['pending', 'active', 'inactive', 'locked', 'resigned', 'rejected'];
const DEACTIVATED_STATUSES = ['inactive', 'locked', 'resigned', 'rejected'];

const syncEmployeeStatus = async (userId, userStatus) => {
  const employee = await Employee.findOne({ userId });
  if (!employee) return null;

  if (userStatus === 'active') employee.status = 'active';
  else if (userStatus === 'locked') employee.status = 'locked';
  else if (userStatus === 'resigned') employee.status = 'resigned';
  else if (['inactive', 'rejected'].includes(userStatus)) employee.status = 'inactive';

  await employee.save();
  return employee;
};

const clearBranchManager = async (userId) => {
  await Branch.updateMany({ managerId: userId }, { $set: { managerId: null } });
};

export const getUsers = async (req, res) => {
  try {
    const filter = {};
    if (req.query.role) filter.role = req.query.role;
    if (req.query.status) filter.status = req.query.status;

    const users = await User.find(filter)
      .select('-password')
      .populate('branchId', 'name address')
      .sort({ createdAt: -1 });

    return successResponse(res, { users }, 'Lấy danh sách tài khoản thành công');
  } catch (error) {
    return errorResponse(res, 'Lấy danh sách tài khoản thất bại', 500, error.message);
  }
};

export const getPendingEmployees = async (req, res) => {
  try {
    const users = await User.find({ role: 'employee', status: 'pending' })
      .select('-password')
      .sort({ createdAt: -1 });

    return successResponse(res, { users }, 'Lấy danh sách chờ duyệt thành công');
  } catch (error) {
    return errorResponse(res, 'Lấy danh sách chờ duyệt thất bại', 500, error.message);
  }
};

export const approveEmployee = async (req, res) => {
  try {
    const userId = req.params.id;
    const { branchId, position, hourlyRate, shiftId, startDate, note } = req.body;

    if (!branchId || !position || hourlyRate == null) {
      return errorResponse(
        res,
        'Vui lòng nhập branchId, position và hourlyRate',
        400,
        'Validation failed'
      );
    }

    const user = await User.findById(userId);
    if (!user) {
      return errorResponse(res, 'Không tìm thấy tài khoản', 404, 'User not found');
    }
    if (user.role !== 'employee') {
      return errorResponse(res, 'Tài khoản không phải employee', 400, 'Invalid role');
    }
    if (user.status !== 'pending') {
      return errorResponse(res, 'Tài khoản không ở trạng thái chờ duyệt', 400, 'Invalid status');
    }

    const branch = await Branch.findById(branchId);
    if (!branch) {
      return errorResponse(res, 'Không tìm thấy chi nhánh', 404, 'Branch not found');
    }

    const existingEmployee = await Employee.findOne({ userId: user._id });
    if (existingEmployee) {
      return errorResponse(res, 'User đã có hồ sơ nhân sự', 409, 'Duplicate employee');
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

    user.status = 'active';
    user.branchId = branchId;
    await user.save();

    return successResponse(
      res,
      { user, employee },
      'Duyệt nhân viên thành công'
    );
  } catch (error) {
    return errorResponse(res, 'Duyệt nhân viên thất bại', 500, error.message);
  }
};

export const rejectEmployee = async (req, res) => {
  try {
    const userId = req.params.id;
    const { reason } = req.body;

    const user = await User.findById(userId);
    if (!user) {
      return errorResponse(res, 'Không tìm thấy tài khoản', 404, 'User not found');
    }
    if (user.role !== 'employee') {
      return errorResponse(res, 'Tài khoản không phải employee', 400, 'Invalid role');
    }
    if (user.status !== 'pending') {
      return errorResponse(res, 'Tài khoản không ở trạng thái chờ duyệt', 400, 'Invalid status');
    }

    user.status = 'rejected';
    user.deactivatedBy = req.user._id;
    user.deactivatedAt = new Date();
    user.deactivationReason = reason || 'Bị từ chối bởi admin';
    await user.save();

    return successResponse(res, { user }, 'Đã từ chối tài khoản nhân viên');
  } catch (error) {
    return errorResponse(res, 'Từ chối nhân viên thất bại', 500, error.message);
  }
};

export const lockUser = async (req, res) => {
  try {
    const userId = req.params.id;
    const { reason } = req.body;

    const user = await User.findById(userId);
    if (!user) {
      return errorResponse(res, 'Không tìm thấy tài khoản', 404, 'User not found');
    }

    user.status = 'locked';
    user.deactivatedBy = req.user._id;
    user.deactivatedAt = new Date();
    user.deactivationReason = reason || 'Bị khóa bởi admin';
    await user.save();

    if (user.role === 'branch_manager') {
      await clearBranchManager(user._id);
    }

    const employee = await syncEmployeeStatus(user._id, 'locked');

    return successResponse(res, { user, employee }, 'Đã khóa tài khoản');
  } catch (error) {
    return errorResponse(res, 'Khóa tài khoản thất bại', 500, error.message);
  }
};

export const unlockUser = async (req, res) => {
  try {
    const userId = req.params.id;

    const user = await User.findById(userId);
    if (!user) {
      return errorResponse(res, 'Không tìm thấy tài khoản', 404, 'User not found');
    }

    user.status = 'active';
    user.deactivatedBy = null;
    user.deactivatedAt = null;
    user.deactivationReason = null;
    await user.save();

    const employee = await syncEmployeeStatus(user._id, 'active');

    return successResponse(res, { user, employee }, 'Đã mở khóa tài khoản');
  } catch (error) {
    return errorResponse(res, 'Mở khóa tài khoản thất bại', 500, error.message);
  }
};

export const updateUserStatus = async (req, res) => {
  try {
    const userId = req.params.id;
    const { status, reason } = req.body;

    if (!status || !VALID_STATUSES.includes(status)) {
      return errorResponse(
        res,
        `Status không hợp lệ. Chỉ chấp nhận: ${VALID_STATUSES.join(', ')}`,
        400,
        'Invalid status'
      );
    }

    const user = await User.findById(userId);
    if (!user) {
      return errorResponse(res, 'Không tìm thấy tài khoản', 404, 'User not found');
    }

    user.status = status;

    if (DEACTIVATED_STATUSES.includes(status)) {
      user.deactivatedBy = req.user._id;
      user.deactivatedAt = new Date();
      user.deactivationReason = reason || null;

      if (user.role === 'branch_manager') {
        await clearBranchManager(user._id);
      }
    }

    if (status === 'active') {
      user.deactivatedBy = null;
      user.deactivatedAt = null;
      user.deactivationReason = null;
    }

    await user.save();
    const employee = await syncEmployeeStatus(user._id, status);

    return successResponse(res, { user, employee }, 'Cập nhật trạng thái thành công');
  } catch (error) {
    return errorResponse(res, 'Cập nhật trạng thái thất bại', 500, error.message);
  }
};

export const updateUserRole = async (req, res) => {
  try {
    const userId = req.params.id;
    const { role, branchId } = req.body;

    if (!role || !VALID_ROLES.includes(role)) {
      return errorResponse(
        res,
        `Role không hợp lệ. Chỉ chấp nhận: ${VALID_ROLES.join(', ')}`,
        400,
        'Invalid role'
      );
    }

    const user = await User.findById(userId);
    if (!user) {
      return errorResponse(res, 'Không tìm thấy tài khoản', 404, 'User not found');
    }

    if (role === 'branch_manager' && !branchId) {
      return errorResponse(
        res,
        'Role branch_manager bắt buộc phải có branchId',
        400,
        'branchId required'
      );
    }

    if (user.role === 'branch_manager' && user.branchId) {
      await Branch.findByIdAndUpdate(user.branchId, { managerId: null });
    }

    user.role = role;
    user.roleAssignedBy = req.user._id;
    user.roleAssignedAt = new Date();

    if (role === 'branch_manager') {
      const branch = await Branch.findById(branchId);
      if (!branch) {
        return errorResponse(res, 'Không tìm thấy chi nhánh', 404, 'Branch not found');
      }
      user.branchId = branchId;
      await user.save();
      branch.managerId = user._id;
      await branch.save();
    } else {
      if (branchId) user.branchId = branchId;
      await user.save();
    }

    return successResponse(res, { user }, 'Cập nhật role thành công');
  } catch (error) {
    return errorResponse(res, 'Cập nhật role thất bại', 500, error.message);
  }
};

// Alias tương thích code cũ
export const changeRole = updateUserRole;
export const changeStatus = updateUserStatus;
export const lockEmployee = lockUser;
export const unlockEmployee = unlockUser;
