import mongoose from 'mongoose';
import Revenue from '../models/Revenue.js';
import Branch from '../models/Branch.js';
import { successResponse, errorResponse } from '../utils/response.js';
import {
  normalizeDateOnly,
  getDayRange,
  getMonthRange,
  getQuarterRange,
} from '../utils/dateRange.js';

const POPULATE_FIELDS = [
  { path: 'branchId', select: 'name address' },
  { path: 'createdBy', select: 'fullName email' },
  { path: 'updatedBy', select: 'fullName email' },
];

const calculateAmount = (body) => {
  const hasBreakdown =
    body.cashAmount != null || body.transferAmount != null || body.otherAmount != null;

  if (hasBreakdown) {
    const cash = Math.max(0, Number(body.cashAmount) || 0);
    const transfer = Math.max(0, Number(body.transferAmount) || 0);
    const other = Math.max(0, Number(body.otherAmount) || 0);
    return cash + transfer + other;
  }

  if (body.amount != null) {
    return Math.max(0, Number(body.amount) || 0);
  }

  return 0;
};

const resolveBranchIdForUser = (req, requestedBranchId) => {
  if (req.user.role === 'branch_manager') {
    if (!req.user.branchId) {
      return { error: 'Bạn chưa được gán chi nhánh' };
    }
    if (
      requestedBranchId &&
      requestedBranchId.toString() !== req.user.branchId.toString()
    ) {
      return { error: 'Không được thao tác doanh thu chi nhánh khác' };
    }
    return { branchId: req.user.branchId };
  }

  if (req.user.role === 'admin') {
    if (!requestedBranchId) {
      return { error: 'Vui lòng cung cấp branchId' };
    }
    return { branchId: requestedBranchId };
  }

  return { error: 'Không có quyền thực hiện' };
};

const buildListFilter = (req) => {
  const filter = {};
  const { branchId, date, month, year, quarter, status } = req.query;

  if (req.user.role === 'branch_manager') {
    filter.branchId = req.user.branchId;
  } else if (branchId) {
    filter.branchId = branchId;
  }

  if (date) {
    const { startDate, endDate } = getDayRange(date);
    filter.date = { $gte: startDate, $lte: endDate };
  } else if (month && year) {
    const { startDate, endDate } = getMonthRange(month, year);
    filter.date = { $gte: startDate, $lte: endDate };
  } else if (quarter && year) {
    const { startDate, endDate } = getQuarterRange(quarter, year);
    filter.date = { $gte: startDate, $lte: endDate };
  } else if (year) {
    const y = parseInt(year, 10);
    filter.date = {
      $gte: new Date(y, 0, 1),
      $lte: new Date(y, 11, 31, 23, 59, 59, 999),
    };
  }

  if (status) {
    filter.status = status;
  }

  return filter;
};

const buildScopeFilter = (req, branchId) => {
  const filter = {};

  if (req.user.role === 'branch_manager') {
    filter.branchId = req.user.branchId;
  } else if (branchId) {
    filter.branchId = new mongoose.Types.ObjectId(branchId);
  }

  return filter;
};

const canAccessRevenue = (req, revenue) => {
  if (req.user.role === 'admin' || req.user.role === 'owner') {
    return true;
  }
  if (req.user.role === 'branch_manager') {
    return revenue.branchId.toString() === req.user.branchId?.toString();
  }
  return false;
};

export const getRevenues = async (req, res) => {
  try {
    const filter = buildListFilter(req);
    const revenues = await Revenue.find(filter)
      .populate(POPULATE_FIELDS)
      .sort({ date: -1 });

    return successResponse(res, { revenues }, 'Lấy danh sách doanh thu thành công');
  } catch (error) {
    return errorResponse(res, 'Lấy danh sách doanh thu thất bại', 500, error.message);
  }
};

export const getRevenueById = async (req, res) => {
  try {
    const revenue = await Revenue.findById(req.params.id).populate(POPULATE_FIELDS);
    if (!revenue) {
      return errorResponse(res, 'Không tìm thấy doanh thu', 404, 'Not found');
    }

    if (!canAccessRevenue(req, revenue)) {
      return errorResponse(res, 'Bạn không có quyền xem doanh thu này', 403, 'Forbidden');
    }

    return successResponse(res, { revenue }, 'Lấy doanh thu thành công');
  } catch (error) {
    return errorResponse(res, 'Lấy doanh thu thất bại', 500, error.message);
  }
};

export const createRevenue = async (req, res) => {
  try {
    const { date, note, orderCount, status } = req.body;
    if (!date) {
      return errorResponse(res, 'Vui lòng nhập ngày doanh thu', 400, 'Missing date');
    }

    const branchResult = resolveBranchIdForUser(req, req.body.branchId);
    if (branchResult.error) {
      return errorResponse(res, branchResult.error, 403, 'Forbidden');
    }

    const branch = await Branch.findById(branchResult.branchId);
    if (!branch) {
      return errorResponse(res, 'Chi nhánh không tồn tại', 404, 'Branch not found');
    }

    let normalizedDate;
    try {
      normalizedDate = normalizeDateOnly(date);
    } catch {
      return errorResponse(res, 'Ngày không hợp lệ', 400, 'Invalid date');
    }

    const amount = calculateAmount(req.body);
    const payload = {
      branchId: branchResult.branchId,
      date: normalizedDate,
      amount,
      cashAmount: Math.max(0, Number(req.body.cashAmount) || 0),
      transferAmount: Math.max(0, Number(req.body.transferAmount) || 0),
      otherAmount: Math.max(0, Number(req.body.otherAmount) || 0),
      orderCount: Math.max(0, Number(orderCount) || 0),
      note: note ?? null,
      updatedBy: req.user._id,
    };

    if (req.user.role === 'admin' && status) {
      payload.status = status;
    }

    const existing = await Revenue.findOne({
      branchId: branchResult.branchId,
      date: normalizedDate,
    });

    let revenue;
    let message;

    if (existing) {
      if (existing.status === 'confirmed' && req.user.role !== 'admin') {
        return errorResponse(
          res,
          'Doanh thu đã xác nhận, không thể cập nhật',
          403,
          'Confirmed revenue'
        );
      }
      Object.assign(existing, payload);
      if (!existing.createdBy) {
        existing.createdBy = req.user._id;
      }
      await existing.save();
      revenue = existing;
      message = 'Cập nhật doanh thu thành công';
    } else {
      revenue = await Revenue.create({
        ...payload,
        createdBy: req.user._id,
      });
      message = 'Tạo doanh thu thành công';
    }

    await revenue.populate(POPULATE_FIELDS);
    return successResponse(res, { revenue }, message, existing ? 200 : 201);
  } catch (error) {
    if (error.code === 11000) {
      return errorResponse(res, 'Doanh thu ngày này đã tồn tại', 409, 'Duplicate revenue');
    }
    return errorResponse(res, 'Tạo doanh thu thất bại', 500, error.message);
  }
};

export const updateRevenue = async (req, res) => {
  try {
    const revenue = await Revenue.findById(req.params.id);
    if (!revenue) {
      return errorResponse(res, 'Không tìm thấy doanh thu', 404, 'Not found');
    }

    if (req.user.role === 'branch_manager') {
      if (revenue.branchId.toString() !== req.user.branchId?.toString()) {
        return errorResponse(
          res,
          'Không có quyền sửa doanh thu chi nhánh khác',
          403,
          'Forbidden'
        );
      }
      if (revenue.status === 'confirmed') {
        return errorResponse(
          res,
          'Doanh thu đã xác nhận, không thể cập nhật',
          403,
          'Confirmed revenue'
        );
      }
    }

    if (req.body.branchId && req.user.role === 'branch_manager') {
      if (req.body.branchId.toString() !== req.user.branchId?.toString()) {
        return errorResponse(
          res,
          'Không được chuyển doanh thu sang chi nhánh khác',
          403,
          'Forbidden'
        );
      }
    }

    const updatable = { ...req.body };
    delete updatable.createdBy;

    if (updatable.date) {
      try {
        updatable.date = normalizeDateOnly(updatable.date);
      } catch {
        return errorResponse(res, 'Ngày không hợp lệ', 400, 'Invalid date');
      }
    }

    if (
      updatable.cashAmount != null ||
      updatable.transferAmount != null ||
      updatable.otherAmount != null ||
      updatable.amount != null
    ) {
      updatable.amount = calculateAmount({ ...revenue.toObject(), ...updatable });
    }

    if (updatable.cashAmount != null) {
      updatable.cashAmount = Math.max(0, Number(updatable.cashAmount) || 0);
    }
    if (updatable.transferAmount != null) {
      updatable.transferAmount = Math.max(0, Number(updatable.transferAmount) || 0);
    }
    if (updatable.otherAmount != null) {
      updatable.otherAmount = Math.max(0, Number(updatable.otherAmount) || 0);
    }
    if (updatable.orderCount != null) {
      updatable.orderCount = Math.max(0, Number(updatable.orderCount) || 0);
    }

    if (req.user.role !== 'admin') {
      delete updatable.status;
    }

    Object.assign(revenue, updatable);
    revenue.updatedBy = req.user._id;
    await revenue.save();
    await revenue.populate(POPULATE_FIELDS);

    return successResponse(res, { revenue }, 'Cập nhật doanh thu thành công');
  } catch (error) {
    if (error.code === 11000) {
      return errorResponse(res, 'Doanh thu ngày này đã tồn tại', 409, 'Duplicate revenue');
    }
    return errorResponse(res, 'Cập nhật doanh thu thất bại', 500, error.message);
  }
};

export const deleteRevenue = async (req, res) => {
  try {
    const revenue = await Revenue.findById(req.params.id);
    if (!revenue) {
      return errorResponse(res, 'Không tìm thấy doanh thu', 404, 'Not found');
    }

    await Revenue.findByIdAndDelete(req.params.id);
    return successResponse(res, null, 'Xóa doanh thu thành công');
  } catch (error) {
    return errorResponse(res, 'Xóa doanh thu thất bại', 500, error.message);
  }
};

export const confirmRevenue = async (req, res) => {
  try {
    const revenue = await Revenue.findById(req.params.id);
    if (!revenue) {
      return errorResponse(res, 'Không tìm thấy doanh thu', 404, 'Not found');
    }

    revenue.status = 'confirmed';
    revenue.updatedBy = req.user._id;
    await revenue.save();
    await revenue.populate(POPULATE_FIELDS);

    return successResponse(res, { revenue }, 'Xác nhận doanh thu thành công');
  } catch (error) {
    return errorResponse(res, 'Xác nhận doanh thu thất bại', 500, error.message);
  }
};

export const getMonthlySummary = async (req, res) => {
  try {
    const month = parseInt(req.query.month, 10) || new Date().getMonth() + 1;
    const year = parseInt(req.query.year, 10) || new Date().getFullYear();
    const { branchId } = req.query;

    const { startDate, endDate } = getMonthRange(month, year);
    const match = {
      date: { $gte: startDate, $lte: endDate },
      ...buildScopeFilter(req, branchId),
    };

    const [totals, byBranch, byDay] = await Promise.all([
      Revenue.aggregate([
        { $match: match },
        {
          $group: {
            _id: null,
            totalRevenue: { $sum: '$amount' },
            totalCash: { $sum: '$cashAmount' },
            totalTransfer: { $sum: '$transferAmount' },
            totalOther: { $sum: '$otherAmount' },
            totalOrders: { $sum: '$orderCount' },
            daysCount: { $sum: 1 },
          },
        },
      ]),
      Revenue.aggregate([
        { $match: match },
        {
          $group: {
            _id: '$branchId',
            totalRevenue: { $sum: '$amount' },
            totalCash: { $sum: '$cashAmount' },
            totalTransfer: { $sum: '$transferAmount' },
            totalOther: { $sum: '$otherAmount' },
            totalOrders: { $sum: '$orderCount' },
            daysCount: { $sum: 1 },
          },
        },
        {
          $lookup: {
            from: 'branches',
            localField: '_id',
            foreignField: '_id',
            as: 'branch',
          },
        },
        { $unwind: { path: '$branch', preserveNullAndEmptyArrays: true } },
        {
          $project: {
            branchId: '$_id',
            branchName: '$branch.name',
            totalRevenue: 1,
            totalCash: 1,
            totalTransfer: 1,
            totalOther: 1,
            totalOrders: 1,
            daysCount: 1,
          },
        },
        { $sort: { totalRevenue: -1 } },
      ]),
      Revenue.aggregate([
        { $match: match },
        {
          $group: {
            _id: '$date',
            totalRevenue: { $sum: '$amount' },
            totalCash: { $sum: '$cashAmount' },
            totalTransfer: { $sum: '$transferAmount' },
            totalOther: { $sum: '$otherAmount' },
            totalOrders: { $sum: '$orderCount' },
          },
        },
        { $sort: { _id: 1 } },
        {
          $project: {
            date: '$_id',
            totalRevenue: 1,
            totalCash: 1,
            totalTransfer: 1,
            totalOther: 1,
            totalOrders: 1,
            _id: 0,
          },
        },
      ]),
    ]);

    const summary = totals[0] || {
      totalRevenue: 0,
      totalCash: 0,
      totalTransfer: 0,
      totalOther: 0,
      totalOrders: 0,
      daysCount: 0,
    };

    const averageDailyRevenue =
      summary.daysCount > 0 ? Math.round(summary.totalRevenue / summary.daysCount) : 0;

    return successResponse(
      res,
      {
        totalRevenue: summary.totalRevenue,
        totalCash: summary.totalCash,
        totalTransfer: summary.totalTransfer,
        totalOther: summary.totalOther,
        totalOrders: summary.totalOrders,
        averageDailyRevenue,
        daysCount: summary.daysCount,
        byBranch,
        byDay,
      },
      'Lấy thống kê doanh thu tháng thành công'
    );
  } catch (error) {
    return errorResponse(res, 'Lấy thống kê doanh thu tháng thất bại', 500, error.message);
  }
};

export const getQuarterlySummary = async (req, res) => {
  try {
    const quarter = parseInt(req.query.quarter, 10) || Math.ceil((new Date().getMonth() + 1) / 3);
    const year = parseInt(req.query.year, 10) || new Date().getFullYear();
    const { branchId } = req.query;

    const { startDate, endDate } = getQuarterRange(quarter, year);
    const match = {
      date: { $gte: startDate, $lte: endDate },
      ...buildScopeFilter(req, branchId),
    };

    const [totals, byMonth, byBranch] = await Promise.all([
      Revenue.aggregate([
        { $match: match },
        {
          $group: {
            _id: null,
            totalRevenue: { $sum: '$amount' },
            totalOrders: { $sum: '$orderCount' },
          },
        },
      ]),
      Revenue.aggregate([
        { $match: match },
        {
          $group: {
            _id: { $month: '$date' },
            totalRevenue: { $sum: '$amount' },
            totalOrders: { $sum: '$orderCount' },
          },
        },
        { $sort: { _id: 1 } },
        {
          $project: {
            month: '$_id',
            totalRevenue: 1,
            totalOrders: 1,
            _id: 0,
          },
        },
      ]),
      Revenue.aggregate([
        { $match: match },
        {
          $group: {
            _id: '$branchId',
            totalRevenue: { $sum: '$amount' },
            totalOrders: { $sum: '$orderCount' },
          },
        },
        {
          $lookup: {
            from: 'branches',
            localField: '_id',
            foreignField: '_id',
            as: 'branch',
          },
        },
        { $unwind: { path: '$branch', preserveNullAndEmptyArrays: true } },
        {
          $project: {
            branchId: '$_id',
            branchName: '$branch.name',
            totalRevenue: 1,
            totalOrders: 1,
          },
        },
        { $sort: { totalRevenue: -1 } },
      ]),
    ]);

    const summary = totals[0] || { totalRevenue: 0, totalOrders: 0 };

    return successResponse(
      res,
      {
        totalRevenue: summary.totalRevenue,
        totalOrders: summary.totalOrders,
        byMonth,
        byBranch,
      },
      'Lấy thống kê doanh thu quý thành công'
    );
  } catch (error) {
    return errorResponse(res, 'Lấy thống kê doanh thu quý thất bại', 500, error.message);
  }
};
