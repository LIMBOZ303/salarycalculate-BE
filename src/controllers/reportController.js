import mongoose from 'mongoose';
import Employee from '../models/Employee.js';
import Branch from '../models/Branch.js';
import Attendance from '../models/Attendance.js';
import Revenue from '../models/Revenue.js';
import Payroll from '../models/Payroll.js';
import User from '../models/User.js';
import {  successResponse, errorResponse  } from '../utils/response.js';

const getDashboard = async (req, res, next) => {
  try {
    const { month, year } = req.query;
    const m = parseInt(month) || new Date().getMonth() + 1;
    const y = parseInt(year) || new Date().getFullYear();
    const startDate = new Date(y, m - 1, 1);
    const endDate = new Date(y, m, 0, 23, 59, 59);
    const branchFilter = req.branchFilter || {};

    const [totalEmployees, totalBranches, activeEmployees, pendingEmployees] = await Promise.all([
      Employee.countDocuments({ ...branchFilter }),
      Branch.countDocuments({ isActive: true }),
      Employee.countDocuments({ status: 'active', ...branchFilter }),
      Employee.countDocuments({ status: 'pending' }),
    ]);

    const revenueMatch = { date: { $gte: startDate, $lte: endDate } };
    if (branchFilter.branchId) revenueMatch.branchId = branchFilter.branchId;
    const revenueAgg = await Revenue.aggregate([{ $match: revenueMatch }, { $group: { _id: null, total: { $sum: '$amount' } } }]);
    const totalRevenue = revenueAgg[0]?.total || 0;

    const payrollMatch = { month: m, year: y };
    if (branchFilter.branchId) payrollMatch.branchId = branchFilter.branchId;
    const payrollAgg = await Payroll.aggregate([{ $match: payrollMatch }, { $group: { _id: null, total: { $sum: '$finalSalary' } } }]);
    const totalPayroll = payrollAgg[0]?.total || 0;

    const attMatch = { date: { $gte: startDate, $lte: endDate } };
    if (branchFilter.branchId) attMatch.branchId = branchFilter.branchId;
    const [totalAttendance, lateCount, suspiciousCount] = await Promise.all([
      Attendance.countDocuments(attMatch),
      Attendance.countDocuments({ ...attMatch, lateMinutes: { $gt: 0 } }),
      Attendance.countDocuments({ ...attMatch, isSuspicious: true }),
    ]);

    return successResponse(res, {
      period: { month: m, year: y },
      employees: { total: totalEmployees, active: activeEmployees, pending: pendingEmployees },
      branches: totalBranches,
      revenue: totalRevenue,
      payroll: totalPayroll,
      profit: totalRevenue - totalPayroll,
      attendance: { total: totalAttendance, lateCount, suspiciousCount },
    });
  } catch (error) { next(error); }
};

const getMonthlyReport = async (req, res, next) => {
  try {
    const m = parseInt(req.query.month) || new Date().getMonth() + 1;
    const y = parseInt(req.query.year) || new Date().getFullYear();
    const { branchId } = req.query;
    const startDate = new Date(y, m - 1, 1);
    const endDate = new Date(y, m, 0, 23, 59, 59);

    const revenueMatch = { month: m, year: y };
    if (branchId) revenueMatch.branchId = mongoose.Types.ObjectId.createFromHexString(branchId);
    const revByBranch = await Revenue.aggregate([{ $match: revenueMatch }, { $group: { _id: '$branchId', total: { $sum: '$amount' } } }, { $lookup: { from: 'branches', localField: '_id', foreignField: '_id', as: 'branch' } }, { $unwind: { path: '$branch', preserveNullAndEmptyArrays: true } }]);

    const payrollMatch = { month: m, year: y };
    if (branchId) payrollMatch.branchId = mongoose.Types.ObjectId.createFromHexString(branchId);
    const payByBranch = await Payroll.aggregate([{ $match: payrollMatch }, { $group: { _id: '$branchId', totalSalary: { $sum: '$finalSalary' }, count: { $sum: 1 } } }, { $lookup: { from: 'branches', localField: '_id', foreignField: '_id', as: 'branch' } }, { $unwind: { path: '$branch', preserveNullAndEmptyArrays: true } }]);

    return successResponse(res, { period: { month: m, year: y }, revenue: revByBranch, payroll: payByBranch });
  } catch (error) { next(error); }
};

const getQuarterlyReport = async (req, res, next) => {
  try {
    const q = parseInt(req.query.quarter) || Math.ceil((new Date().getMonth() + 1) / 3);
    const y = parseInt(req.query.year) || new Date().getFullYear();
    const { branchId } = req.query;
    const match = { quarter: q, year: y };
    if (branchId) match.branchId = mongoose.Types.ObjectId.createFromHexString(branchId);
    const revenue = await Revenue.aggregate([{ $match: match }, { $group: { _id: { month: '$month' }, total: { $sum: '$amount' } } }, { $sort: { '_id.month': 1 } }]);
    return successResponse(res, { quarter: q, year: y, revenue });
  } catch (error) { next(error); }
};

const getYearlyReport = async (req, res, next) => {
  try {
    const y = parseInt(req.query.year) || new Date().getFullYear();
    const { branchId } = req.query;
    const match = { year: y };
    if (branchId) match.branchId = mongoose.Types.ObjectId.createFromHexString(branchId);
    const revenue = await Revenue.aggregate([{ $match: match }, { $group: { _id: { month: '$month' }, total: { $sum: '$amount' } } }, { $sort: { '_id.month': 1 } }]);
    const grandTotal = revenue.reduce((s, r) => s + r.total, 0);
    return successResponse(res, { year: y, revenue, grandTotal });
  } catch (error) { next(error); }
};

export {  getDashboard, getMonthlyReport, getQuarterlyReport, getYearlyReport  };
