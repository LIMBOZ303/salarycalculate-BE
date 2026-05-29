import Employee from '../models/Employee.js';
import User from '../models/User.js';
import {  successResponse, errorResponse, paginatedResponse  } from '../utils/response.js';
import {  logAction  } from '../utils/auditLogger.js';
import {  buildPagination  } from '../utils/helpers.js';

const getEmployees = async (req, res, next) => {
  try {
    const { page = 1, limit = 20, status, search, branchId } = req.query;
    const skip = (parseInt(page) - 1) * parseInt(limit);
    const filter = { ...req.branchFilter };
    if (status) filter.status = status;
    if (branchId && req.user.role === 'admin') filter.branchId = branchId;
    if (search) {
      filter.$or = [
        { fullName: { $regex: search, $options: 'i' } },
        { email: { $regex: search, $options: 'i' } },
        { phone: { $regex: search, $options: 'i' } },
        { employeeCode: { $regex: search, $options: 'i' } },
      ];
    }
    const [employees, total] = await Promise.all([
      Employee.find(filter)
        .populate('branchId', 'name address')
        .populate('shiftId', 'name startTime endTime')
        .populate('userId', 'fullName email role status')
        .sort({ createdAt: -1 }).skip(skip).limit(parseInt(limit)),
      Employee.countDocuments(filter),
    ]);
    return paginatedResponse(res, employees, buildPagination(page, limit, total));
  } catch (error) { next(error); }
};

const getEmployeeById = async (req, res, next) => {
  try {
    const employee = await Employee.findById(req.params.id)
      .populate('branchId', 'name address phone')
      .populate('shiftId', 'name startTime endTime breakMinutes')
      .populate('userId', 'fullName email phone role status avatar')
      .populate('approvedBy', 'fullName');
    if (!employee) return errorResponse(res, 'Không tìm thấy nhân viên', 404);
    if (req.user.role === 'branch_manager' && employee.branchId &&
        employee.branchId._id.toString() !== req.user.branchId?.toString()) {
      return errorResponse(res, 'Bạn không có quyền xem nhân viên chi nhánh khác', 403);
    }
    return successResponse(res, employee);
  } catch (error) { next(error); }
};

const getMyProfile = async (req, res, next) => {
  try {
    const employee = await Employee.findOne({ userId: req.user.id })
      .populate('branchId', 'name address phone')
      .populate('shiftId', 'name startTime endTime breakMinutes graceMinutes');
    if (!employee) return errorResponse(res, 'Không tìm thấy hồ sơ nhân viên', 404);
    return successResponse(res, employee);
  } catch (error) { next(error); }
};

const createEmployee = async (req, res, next) => {
  try {
    const { fullName, phone, email, password, dateOfBirth, address, citizenId, branchId, position, hourlyRate, shiftId, role } = req.body;
    if (!fullName || !phone || !email || !password) return errorResponse(res, 'Thiếu thông tin bắt buộc', 400);
    const existingUser = await User.findOne({ $or: [{ email }, { phone }] });
    if (existingUser) return errorResponse(res, 'Email hoặc SĐT đã tồn tại', 409);
    const user = await User.create({ fullName, phone, email, password, role: role || 'employee', status: 'active', branchId: branchId || null, roleAssignedBy: req.user.id, roleAssignedAt: new Date() });
    const employee = await Employee.create({ userId: user._id, fullName, phone, email, dateOfBirth, address, citizenId, branchId, position: position || 'Nhân viên', hourlyRate: hourlyRate || 0, shiftId, status: 'active', approvedBy: req.user.id, approvedAt: new Date() });
    await logAction({ userId: req.user.id, role: req.user.role, action: 'CREATE', resource: 'Employee', resourceId: employee._id, newValue: { fullName, email, phone }, req });
    return successResponse(res, { user, employee }, 'Tạo nhân viên thành công', 201);
  } catch (error) { next(error); }
};

const updateEmployee = async (req, res, next) => {
  try {
    const updateData = req.body;
    delete updateData.role; delete updateData.status; delete updateData.approvedBy; delete updateData.approvedAt;
    const employee = await Employee.findById(req.params.id);
    if (!employee) return errorResponse(res, 'Không tìm thấy nhân viên', 404);
    const oldValue = employee.toObject();
    Object.assign(employee, updateData);
    await employee.save();
    const userUpdate = {};
    if (updateData.fullName) userUpdate.fullName = updateData.fullName;
    if (updateData.email) userUpdate.email = updateData.email;
    if (updateData.phone) userUpdate.phone = updateData.phone;
    if (updateData.branchId) userUpdate.branchId = updateData.branchId;
    if (Object.keys(userUpdate).length > 0) await User.findByIdAndUpdate(employee.userId, userUpdate);
    await logAction({ userId: req.user.id, role: req.user.role, action: 'UPDATE', resource: 'Employee', resourceId: employee._id, oldValue, newValue: updateData, req });
    return successResponse(res, { employee }, 'Cập nhật thành công');
  } catch (error) { next(error); }
};

const deleteEmployee = async (req, res, next) => {
  try {
    const employee = await Employee.findById(req.params.id);
    if (!employee) return errorResponse(res, 'Không tìm thấy nhân viên', 404);
    employee.status = 'resigned';
    await employee.save();
    await User.findByIdAndUpdate(employee.userId, { status: 'resigned', deactivatedBy: req.user.id, deactivatedAt: new Date(), deactivationReason: 'Đã bị xóa bởi admin' });
    await logAction({ userId: req.user.id, role: req.user.role, action: 'DELETE', resource: 'Employee', resourceId: employee._id, req });
    return successResponse(res, null, 'Xóa nhân viên thành công');
  } catch (error) { next(error); }
};

export {  getEmployees, getEmployeeById, getMyProfile, createEmployee, updateEmployee, deleteEmployee  };
