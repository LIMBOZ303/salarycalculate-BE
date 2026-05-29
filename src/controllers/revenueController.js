import Revenue from '../models/Revenue.js';
import {  successResponse, errorResponse, paginatedResponse  } from '../utils/response.js';
import {  logAction  } from '../utils/auditLogger.js';
import {  buildPagination  } from '../utils/helpers.js';

const getRevenues = async (req, res, next) => {
  try {
    const { page = 1, limit = 20, branchId, month, year } = req.query;
    const skip = (parseInt(page) - 1) * parseInt(limit);
    const filter = {};
    if (branchId) filter.branchId = branchId;
    if (month) filter.month = parseInt(month);
    if (year) filter.year = parseInt(year);
    const [revenues, total] = await Promise.all([
      Revenue.find(filter).populate('branchId', 'name').populate('createdBy', 'fullName').sort({ date: -1 }).skip(skip).limit(parseInt(limit)),
      Revenue.countDocuments(filter),
    ]);
    return paginatedResponse(res, revenues, buildPagination(page, limit, total));
  } catch (error) { next(error); }
};

const getRevenueSummary = async (req, res, next) => {
  try {
    const { month, year, quarter } = req.query;
    const match = {};
    if (year) match.year = parseInt(year);
    if (month) match.month = parseInt(month);
    if (quarter) match.quarter = parseInt(quarter);

    const summary = await Revenue.aggregate([
      { $match: match },
      { $group: { _id: '$branchId', totalAmount: { $sum: '$amount' }, count: { $sum: 1 } } },
      { $lookup: { from: 'branches', localField: '_id', foreignField: '_id', as: 'branch' } },
      { $unwind: { path: '$branch', preserveNullAndEmptyArrays: true } },
      { $project: { branchId: '$_id', branchName: '$branch.name', totalAmount: 1, count: 1 } },
      { $sort: { totalAmount: -1 } },
    ]);
    const grandTotal = summary.reduce((s, r) => s + r.totalAmount, 0);
    return successResponse(res, { summary, grandTotal });
  } catch (error) { next(error); }
};

const getMyBranchRevenue = async (req, res, next) => {
  try {
    if (!req.user.branchId) return errorResponse(res, 'Bạn chưa được gán chi nhánh', 400);
    const { month, year, quarter } = req.query;
    const filter = { branchId: req.user.branchId };
    if (month) filter.month = parseInt(month);
    if (year) filter.year = parseInt(year);
    if (quarter) filter.quarter = parseInt(quarter);
    const revenues = await Revenue.find(filter).sort({ date: -1 });
    const total = revenues.reduce((s, r) => s + r.amount, 0);
    return successResponse(res, { revenues, total });
  } catch (error) { next(error); }
};

const createMyBranchRevenue = async (req, res, next) => {
  try {
    if (!req.user.branchId) return errorResponse(res, 'Bạn chưa được gán chi nhánh', 400);
    const { date, amount, note } = req.body;
    if (!date || amount == null) return errorResponse(res, 'Vui lòng nhập ngày và số tiền', 400);
    const revenue = await Revenue.create({ branchId: req.user.branchId, date: new Date(date), amount, note, createdBy: req.user.id });
    await logAction({ userId: req.user.id, role: req.user.role, action: 'CREATE', resource: 'Revenue', resourceId: revenue._id, newValue: { date, amount, note }, req });
    return successResponse(res, revenue, 'Nhập doanh thu thành công', 201);
  } catch (error) { next(error); }
};

const updateMyBranchRevenue = async (req, res, next) => {
  try {
    const revenue = await Revenue.findById(req.params.id);
    if (!revenue) return errorResponse(res, 'Không tìm thấy doanh thu', 404);
    if (revenue.branchId.toString() !== req.user.branchId?.toString()) return errorResponse(res, 'Không có quyền sửa doanh thu chi nhánh khác', 403);
    const oldValue = revenue.toObject();
    if (req.body.amount != null) revenue.amount = req.body.amount;
    if (req.body.note) revenue.note = req.body.note;
    if (req.body.date) revenue.date = new Date(req.body.date);
    revenue.updatedBy = req.user.id;
    await revenue.save();
    await logAction({ userId: req.user.id, role: req.user.role, action: 'UPDATE', resource: 'Revenue', resourceId: revenue._id, oldValue, newValue: req.body, req });
    return successResponse(res, revenue, 'Cập nhật doanh thu thành công');
  } catch (error) { next(error); }
};

const createRevenue = async (req, res, next) => {
  try {
    const { branchId, date, amount, note } = req.body;
    if (!branchId || !date || amount == null) return errorResponse(res, 'Thiếu thông tin', 400);
    const revenue = await Revenue.create({ branchId, date: new Date(date), amount, note, createdBy: req.user.id });
    await logAction({ userId: req.user.id, role: req.user.role, action: 'CREATE', resource: 'Revenue', resourceId: revenue._id, newValue: { branchId, date, amount }, req });
    return successResponse(res, revenue, 'Tạo doanh thu thành công', 201);
  } catch (error) { next(error); }
};

const updateRevenue = async (req, res, next) => {
  try {
    const revenue = await Revenue.findById(req.params.id);
    if (!revenue) return errorResponse(res, 'Không tìm thấy', 404);
    const oldValue = revenue.toObject();
    Object.assign(revenue, req.body);
    revenue.updatedBy = req.user.id;
    await revenue.save();
    await logAction({ userId: req.user.id, role: req.user.role, action: 'UPDATE', resource: 'Revenue', resourceId: revenue._id, oldValue, newValue: req.body, req });
    return successResponse(res, revenue, 'Cập nhật thành công');
  } catch (error) { next(error); }
};

const deleteRevenue = async (req, res, next) => {
  try {
    const revenue = await Revenue.findById(req.params.id);
    if (!revenue) return errorResponse(res, 'Không tìm thấy', 404);
    await Revenue.findByIdAndDelete(req.params.id);
    await logAction({ userId: req.user.id, role: req.user.role, action: 'DELETE', resource: 'Revenue', resourceId: revenue._id, req });
    return successResponse(res, null, 'Xóa doanh thu thành công');
  } catch (error) { next(error); }
};

export {  getRevenues, getRevenueSummary, getMyBranchRevenue, createMyBranchRevenue, updateMyBranchRevenue, createRevenue, updateRevenue, deleteRevenue  };
