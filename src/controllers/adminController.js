import User from '../models/User.js';
import Employee from '../models/Employee.js';
import {  successResponse, errorResponse, paginatedResponse  } from '../utils/response.js';
import {  logAction  } from '../utils/auditLogger.js';
import {  buildPagination  } from '../utils/helpers.js';

/**
 * @desc    Get all users
 * @route   GET /api/admin/users
 * @access  Admin only
 */
const getUsers = async (req, res, next) => {
  try {
    const { page = 1, limit = 20, role, status, search } = req.query;
    const skip = (parseInt(page) - 1) * parseInt(limit);

    const filter = {};
    if (role) filter.role = role;
    if (status) filter.status = status;
    if (search) {
      filter.$or = [
        { fullName: { $regex: search, $options: 'i' } },
        { email: { $regex: search, $options: 'i' } },
        { phone: { $regex: search, $options: 'i' } },
      ];
    }

    const [users, total] = await Promise.all([
      User.find(filter)
        .select('-password')
        .populate('branchId', 'name')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(parseInt(limit)),
      User.countDocuments(filter),
    ]);

    return paginatedResponse(
      res,
      users,
      buildPagination(page, limit, total),
      'Lấy danh sách users thành công'
    );
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Change user role
 * @route   PATCH /api/admin/users/:id/role
 * @access  Admin only
 */
const changeRole = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { role } = req.body;

    const validRoles = ['admin', 'owner', 'branch_manager', 'employee'];
    if (!role || !validRoles.includes(role)) {
      return errorResponse(res, `Role không hợp lệ. Chỉ chấp nhận: ${validRoles.join(', ')}`, 400);
    }

    const user = await User.findById(id);
    if (!user) {
      return errorResponse(res, 'Không tìm thấy user', 404);
    }

    const oldRole = user.role;

    user.role = role;
    user.roleAssignedBy = req.user.id;
    user.roleAssignedAt = new Date();
    await user.save();

    // Audit log
    await logAction({
      userId: req.user.id,
      role: req.user.role,
      action: 'CHANGE_ROLE',
      resource: 'User',
      resourceId: user._id,
      oldValue: { role: oldRole },
      newValue: { role },
      req,
    });

    return successResponse(res, { user }, `Đổi role thành ${role} thành công`);
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Change user status
 * @route   PATCH /api/admin/users/:id/status
 * @access  Admin only
 */
const changeStatus = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { status, reason } = req.body;

    const validStatuses = ['pending', 'active', 'inactive', 'locked', 'resigned', 'rejected'];
    if (!status || !validStatuses.includes(status)) {
      return errorResponse(res, `Status không hợp lệ. Chỉ chấp nhận: ${validStatuses.join(', ')}`, 400);
    }

    const user = await User.findById(id);
    if (!user) {
      return errorResponse(res, 'Không tìm thấy user', 404);
    }

    const oldStatus = user.status;

    user.status = status;

    // If deactivating (inactive, locked, resigned, rejected)
    if (['inactive', 'locked', 'resigned', 'rejected'].includes(status)) {
      user.deactivatedBy = req.user.id;
      user.deactivatedAt = new Date();
      user.deactivationReason = reason || null;

      // Also update employee status
      await Employee.findOneAndUpdate(
        { userId: user._id },
        { status }
      );
    }

    // If reactivating
    if (status === 'active') {
      user.deactivatedBy = null;
      user.deactivatedAt = null;
      user.deactivationReason = null;

      await Employee.findOneAndUpdate(
        { userId: user._id },
        { status: 'active' }
      );
    }

    await user.save();

    // Audit log
    await logAction({
      userId: req.user.id,
      role: req.user.role,
      action: 'CHANGE_STATUS',
      resource: 'User',
      resourceId: user._id,
      oldValue: { status: oldStatus },
      newValue: { status, reason },
      req,
    });

    return successResponse(res, { user }, `Đổi status thành ${status} thành công`);
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Get pending employees
 * @route   GET /api/admin/employees/pending
 * @access  Admin only
 */
const getPendingEmployees = async (req, res, next) => {
  try {
    const employees = await Employee.find({ status: 'pending' })
      .populate('userId', 'fullName email phone status')
      .populate('branchId', 'name')
      .sort({ createdAt: -1 });

    return successResponse(res, employees, 'Lấy danh sách chờ duyệt thành công');
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Approve employee
 * @route   POST /api/admin/employees/:id/approve
 * @access  Admin only
 */
const approveEmployee = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { branchId, shiftId, hourlyRate, position } = req.body;

    const employee = await Employee.findById(id);
    if (!employee) {
      return errorResponse(res, 'Không tìm thấy nhân viên', 404);
    }

    if (employee.status !== 'pending') {
      return errorResponse(res, 'Nhân viên này không ở trạng thái chờ duyệt', 400);
    }

    // Update employee
    employee.status = 'active';
    employee.approvedBy = req.user.id;
    employee.approvedAt = new Date();
    if (branchId) employee.branchId = branchId;
    if (shiftId) employee.shiftId = shiftId;
    if (hourlyRate) employee.hourlyRate = hourlyRate;
    if (position) employee.position = position;
    await employee.save();

    // Update user status to active
    await User.findByIdAndUpdate(employee.userId, {
      status: 'active',
      branchId: employee.branchId,
    });

    // Audit log
    await logAction({
      userId: req.user.id,
      role: req.user.role,
      action: 'APPROVE',
      resource: 'Employee',
      resourceId: employee._id,
      newValue: { status: 'active', branchId, shiftId, hourlyRate },
      req,
    });

    return successResponse(res, { employee }, 'Duyệt nhân viên thành công');
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Reject employee
 * @route   POST /api/admin/employees/:id/reject
 * @access  Admin only
 */
const rejectEmployee = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { reason } = req.body;

    const employee = await Employee.findById(id);
    if (!employee) {
      return errorResponse(res, 'Không tìm thấy nhân viên', 404);
    }

    employee.status = 'rejected';
    employee.note = reason || 'Bị từ chối bởi admin';
    await employee.save();

    // Update user status
    await User.findByIdAndUpdate(employee.userId, {
      status: 'rejected',
      deactivatedBy: req.user.id,
      deactivatedAt: new Date(),
      deactivationReason: reason || 'Bị từ chối',
    });

    // Audit log
    await logAction({
      userId: req.user.id,
      role: req.user.role,
      action: 'REJECT',
      resource: 'Employee',
      resourceId: employee._id,
      newValue: { status: 'rejected', reason },
      req,
    });

    return successResponse(res, { employee }, 'Đã từ chối nhân viên');
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Lock employee account
 * @route   POST /api/admin/employees/:id/lock
 * @access  Admin only
 */
const lockEmployee = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { reason } = req.body;

    const employee = await Employee.findById(id);
    if (!employee) {
      return errorResponse(res, 'Không tìm thấy nhân viên', 404);
    }

    employee.status = 'locked';
    await employee.save();

    await User.findByIdAndUpdate(employee.userId, {
      status: 'locked',
      deactivatedBy: req.user.id,
      deactivatedAt: new Date(),
      deactivationReason: reason || 'Bị khóa bởi admin',
    });

    await logAction({
      userId: req.user.id,
      role: req.user.role,
      action: 'LOCK',
      resource: 'Employee',
      resourceId: employee._id,
      newValue: { status: 'locked', reason },
      req,
    });

    return successResponse(res, { employee }, 'Đã khóa tài khoản nhân viên');
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Unlock employee account
 * @route   POST /api/admin/employees/:id/unlock
 * @access  Admin only
 */
const unlockEmployee = async (req, res, next) => {
  try {
    const { id } = req.params;

    const employee = await Employee.findById(id);
    if (!employee) {
      return errorResponse(res, 'Không tìm thấy nhân viên', 404);
    }

    employee.status = 'active';
    await employee.save();

    await User.findByIdAndUpdate(employee.userId, {
      status: 'active',
      deactivatedBy: null,
      deactivatedAt: null,
      deactivationReason: null,
    });

    await logAction({
      userId: req.user.id,
      role: req.user.role,
      action: 'UNLOCK',
      resource: 'Employee',
      resourceId: employee._id,
      newValue: { status: 'active' },
      req,
    });

    return successResponse(res, { employee }, 'Đã mở khóa tài khoản nhân viên');
  } catch (error) {
    next(error);
  }
};

export { 
  getUsers,
  changeRole,
  changeStatus,
  getPendingEmployees,
  approveEmployee,
  rejectEmployee,
  lockEmployee,
  unlockEmployee,
 };
