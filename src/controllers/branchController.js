import Branch from '../models/Branch.js';
import {  successResponse, errorResponse  } from '../utils/response.js';
import {  logAction  } from '../utils/auditLogger.js';

const getBranches = async (req, res, next) => {
  try {
    const filter = {};
    if (req.query.isActive) filter.isActive = req.query.isActive === 'true';
    // Branch manager only sees their own branch
    if (req.user.role === 'branch_manager') {
      filter._id = req.user.branchId;
    }
    const branches = await Branch.find(filter)
      .populate('managerId', 'fullName email phone')
      .sort({ createdAt: -1 });
    return successResponse(res, branches, 'Lấy danh sách chi nhánh thành công');
  } catch (error) { next(error); }
};

const getBranchById = async (req, res, next) => {
  try {
    const branch = await Branch.findById(req.params.id)
      .populate('managerId', 'fullName email phone');
    if (!branch) return errorResponse(res, 'Không tìm thấy chi nhánh', 404);
    if (req.user.role === 'branch_manager' && branch._id.toString() !== req.user.branchId?.toString()) {
      return errorResponse(res, 'Bạn không có quyền xem chi nhánh khác', 403);
    }
    return successResponse(res, branch);
  } catch (error) { next(error); }
};

const createBranch = async (req, res, next) => {
  try {
    const { name, address, phone, managerId, latitude, longitude, allowedRadiusMeters } = req.body;
    if (!name || !address || latitude == null || longitude == null) {
      return errorResponse(res, 'Vui lòng điền: tên, địa chỉ, vĩ độ, kinh độ', 400);
    }
    const branch = await Branch.create({ name, address, phone, managerId, latitude, longitude, allowedRadiusMeters: allowedRadiusMeters || 100 });
    await logAction({ userId: req.user.id, role: req.user.role, action: 'CREATE', resource: 'Branch', resourceId: branch._id, newValue: { name, address, latitude, longitude }, req });
    return successResponse(res, branch, 'Tạo chi nhánh thành công', 201);
  } catch (error) { next(error); }
};

const updateBranch = async (req, res, next) => {
  try {
    const branch = await Branch.findById(req.params.id);
    if (!branch) return errorResponse(res, 'Không tìm thấy chi nhánh', 404);
    const oldValue = branch.toObject();
    Object.assign(branch, req.body);
    await branch.save();
    await logAction({ userId: req.user.id, role: req.user.role, action: 'UPDATE', resource: 'Branch', resourceId: branch._id, oldValue, newValue: req.body, req });
    return successResponse(res, branch, 'Cập nhật chi nhánh thành công');
  } catch (error) { next(error); }
};

const deleteBranch = async (req, res, next) => {
  try {
    const branch = await Branch.findById(req.params.id);
    if (!branch) return errorResponse(res, 'Không tìm thấy chi nhánh', 404);
    branch.isActive = false;
    await branch.save();
    await logAction({ userId: req.user.id, role: req.user.role, action: 'DELETE', resource: 'Branch', resourceId: branch._id, req });
    return successResponse(res, null, 'Đã vô hiệu hóa chi nhánh');
  } catch (error) { next(error); }
};

export {  getBranches, getBranchById, createBranch, updateBranch, deleteBranch  };
