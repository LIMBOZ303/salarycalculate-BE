import Branch from '../models/Branch.js';
import { successResponse, errorResponse } from '../utils/response.js';

const FORBIDDEN_ROLES = ['employee'];

const assertNotEmployee = (req, res) => {
  if (FORBIDDEN_ROLES.includes(req.user.role)) {
    errorResponse(res, 'Bạn không có quyền xem chi nhánh', 403, 'Forbidden');
    return false;
  }
  return true;
};

export const getBranches = async (req, res) => {
  try {
    if (!assertNotEmployee(req, res)) return;

    const filter = {};
    if (req.query.isActive !== undefined) {
      filter.isActive = req.query.isActive === 'true';
    }

    if (req.user.role === 'branch_manager') {
      if (!req.user.branchId) {
        return errorResponse(res, 'Bạn chưa được gán chi nhánh', 403, 'No branch assigned');
      }
      filter._id = req.user.branchId;
    }

    const branches = await Branch.find(filter)
      .populate('managerId', 'fullName email phone role')
      .sort({ createdAt: -1 });

    return successResponse(res, { branches }, 'Lấy danh sách chi nhánh thành công');
  } catch (error) {
    return errorResponse(res, 'Lấy danh sách chi nhánh thất bại', 500, error.message);
  }
};

export const getBranchById = async (req, res) => {
  try {
    if (!assertNotEmployee(req, res)) return;

    const branch = await Branch.findById(req.params.id).populate(
      'managerId',
      'fullName email phone role'
    );

    if (!branch) {
      return errorResponse(res, 'Không tìm thấy chi nhánh', 404, 'Branch not found');
    }

    if (
      req.user.role === 'branch_manager' &&
      branch._id.toString() !== req.user.branchId?.toString()
    ) {
      return errorResponse(res, 'Bạn không có quyền xem chi nhánh khác', 403, 'Forbidden');
    }

    return successResponse(res, { branch }, 'Lấy chi nhánh thành công');
  } catch (error) {
    return errorResponse(res, 'Lấy chi nhánh thất bại', 500, error.message);
  }
};

export const createBranch = async (req, res) => {
  try {
    const { name, address, phone, latitude, longitude, allowedRadiusMeters, managerId } =
      req.body;

    if (!name || !address || latitude == null || longitude == null) {
      return errorResponse(
        res,
        'Vui lòng nhập tên, địa chỉ, vĩ độ và kinh độ',
        400,
        'Validation failed'
      );
    }

    const branch = await Branch.create({
      name,
      address,
      phone,
      latitude,
      longitude,
      allowedRadiusMeters: allowedRadiusMeters ?? 100,
      managerId: managerId || null,
    });

    return successResponse(res, { branch }, 'Tạo chi nhánh thành công', 201);
  } catch (error) {
    return errorResponse(res, 'Tạo chi nhánh thất bại', 500, error.message);
  }
};

export const updateBranch = async (req, res) => {
  try {
    const branch = await Branch.findById(req.params.id);
    if (!branch) {
      return errorResponse(res, 'Không tìm thấy chi nhánh', 404, 'Branch not found');
    }

    const allowedFields = [
      'name',
      'address',
      'phone',
      'latitude',
      'longitude',
      'allowedRadiusMeters',
      'isActive',
      'managerId',
    ];

    for (const field of allowedFields) {
      if (req.body[field] !== undefined) {
        branch[field] = req.body[field];
      }
    }

    await branch.save();

    return successResponse(res, { branch }, 'Cập nhật chi nhánh thành công');
  } catch (error) {
    return errorResponse(res, 'Cập nhật chi nhánh thất bại', 500, error.message);
  }
};

export const deleteBranch = async (req, res) => {
  try {
    const branch = await Branch.findById(req.params.id);
    if (!branch) {
      return errorResponse(res, 'Không tìm thấy chi nhánh', 404, 'Branch not found');
    }

    branch.isActive = false;
    await branch.save();

    return successResponse(res, { branch }, 'Đã vô hiệu hóa chi nhánh');
  } catch (error) {
    return errorResponse(res, 'Vô hiệu hóa chi nhánh thất bại', 500, error.message);
  }
};
