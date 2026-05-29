import PDFDocument from 'pdfkit';
import Payroll from '../models/Payroll.js';
import Penalty from '../models/Penalty.js';
import Employee from '../models/Employee.js';
import Attendance from '../models/Attendance.js';
import {  successResponse, errorResponse, paginatedResponse  } from '../utils/response.js';
import {  logAction  } from '../utils/auditLogger.js';
import {  buildPagination  } from '../utils/helpers.js';

const getPayrolls = async (req, res, next) => {
  try {
    const { page = 1, limit = 20, branchId, month, year, paymentStatus } = req.query;
    const skip = (parseInt(page) - 1) * parseInt(limit);
    const filter = { ...req.branchFilter };
    if (branchId && req.user.role === 'admin') filter.branchId = branchId;
    if (month) filter.month = parseInt(month);
    if (year) filter.year = parseInt(year);
    if (paymentStatus) filter.paymentStatus = paymentStatus;
    const [payrolls, total] = await Promise.all([
      Payroll.find(filter).populate('employeeId', 'fullName employeeCode').populate('branchId', 'name').sort({ createdAt: -1 }).skip(skip).limit(parseInt(limit)),
      Payroll.countDocuments(filter),
    ]);
    return paginatedResponse(res, payrolls, buildPagination(page, limit, total));
  } catch (error) { next(error); }
};

const getPayrollDetail = async (req, res, next) => {
  try {
    const { employeeId, month, year } = req.params;
    const payroll = await Payroll.findOne({ employeeId, month: parseInt(month), year: parseInt(year) })
      .populate('employeeId', 'fullName employeeCode phone email position hourlyRate')
      .populate('branchId', 'name');
    if (!payroll) return errorResponse(res, 'Không tìm thấy bảng lương', 404);
    const penalties = await Penalty.find({ employeeId, payrollId: payroll._id });
    return successResponse(res, { payroll, penalties });
  } catch (error) { next(error); }
};

/**
 * @desc    Calculate payroll for month
 * @route   POST /api/payroll/calculate
 * @access  Admin
 */
const calculatePayroll = async (req, res, next) => {
  try {
    const { month, year, branchId, employeeId } = req.body;
    if (!month || !year) return errorResponse(res, 'Vui lòng cung cấp tháng và năm', 400);

    const empFilter = { status: 'active' };
    if (branchId) empFilter.branchId = branchId;
    if (employeeId) empFilter._id = employeeId;
    const employees = await Employee.find(empFilter);

    const startDate = new Date(parseInt(year), parseInt(month) - 1, 1);
    const endDate = new Date(parseInt(year), parseInt(month), 0, 23, 59, 59);
    const results = [];

    for (const emp of employees) {
      const attendances = await Attendance.find({ employeeId: emp._id, date: { $gte: startDate, $lte: endDate } });
      const totalHours = attendances.reduce((s, a) => s + (a.totalHours || 0), 0);
      const totalWorkingDays = attendances.filter(a => a.status === 'checked_out').length;
      const lateCount = attendances.filter(a => a.lateMinutes > 0).length;
      const totalLateMinutes = attendances.reduce((s, a) => s + (a.lateMinutes || 0), 0);

      const baseSalary = Math.round(emp.hourlyRate * totalHours);
      const penalties = await Penalty.find({ employeeId: emp._id, date: { $gte: startDate, $lte: endDate } });
      const totalPenalty = penalties.reduce((s, p) => s + p.amount, 0);

      // Get previous payroll for heldSalary carry-over
      const prevMonth = parseInt(month) === 1 ? 12 : parseInt(month) - 1;
      const prevYear = parseInt(month) === 1 ? parseInt(year) - 1 : parseInt(year);
      const prevPayroll = await Payroll.findOne({ employeeId: emp._id, month: prevMonth, year: prevYear });
      const nextPeriodSalary = prevPayroll ? (prevPayroll.heldSalary || 0) : 0;

      const finalSalary = Math.max(0, baseSalary - totalPenalty + nextPeriodSalary);

      const payrollData = {
        employeeId: emp._id, branchId: emp.branchId, month: parseInt(month), year: parseInt(year),
        hourlyRate: emp.hourlyRate, totalHours: Math.round(totalHours * 100) / 100, totalWorkingDays,
        lateCount, lateMinutes: totalLateMinutes, baseSalary, totalPenalty,
        fixedDeduction: 0, lateDeduction: 0, heldSalary: 0, nextPeriodSalary, finalSalary,
        paymentStatus: 'calculated',
      };

      const payroll = await Payroll.findOneAndUpdate(
        { employeeId: emp._id, month: parseInt(month), year: parseInt(year) },
        payrollData, { upsert: true, new: true }
      );

      // Link penalties to payroll
      await Penalty.updateMany({ employeeId: emp._id, date: { $gte: startDate, $lte: endDate } }, { payrollId: payroll._id });
      results.push(payroll);
    }

    await logAction({ userId: req.user.id, role: req.user.role, action: 'CALCULATE_PAYROLL', resource: 'Payroll', resourceId: null, newValue: { month, year, branchId, count: results.length }, req });
    return successResponse(res, { count: results.length, payrolls: results }, `Đã tính lương cho ${results.length} nhân viên`);
  } catch (error) { next(error); }
};

const closePayrollMonth = async (req, res, next) => {
  try {
    const { month, year } = req.body;
    if (!month || !year) return errorResponse(res, 'Thiếu tháng/năm', 400);
    const result = await Payroll.updateMany({ month: parseInt(month), year: parseInt(year), paymentStatus: 'calculated' }, { paymentStatus: 'closed' });
    await logAction({ userId: req.user.id, role: req.user.role, action: 'CLOSE_PAYROLL', resource: 'Payroll', newValue: { month, year, count: result.modifiedCount }, req });
    return successResponse(res, { closedCount: result.modifiedCount }, `Đã chốt lương tháng ${month}/${year}`);
  } catch (error) { next(error); }
};

const markPaid = async (req, res, next) => {
  try {
    const payroll = await Payroll.findById(req.params.id);
    if (!payroll) return errorResponse(res, 'Không tìm thấy', 404);
    payroll.paymentStatus = 'paid';
    payroll.paidDate = new Date();
    payroll.note = req.body.note || payroll.note;
    await payroll.save();
    await logAction({ userId: req.user.id, role: req.user.role, action: 'MARK_PAID', resource: 'Payroll', resourceId: payroll._id, req });
    return successResponse(res, payroll, 'Đã đánh dấu đã trả lương');
  } catch (error) { next(error); }
};

const getPayslip = async (req, res, next) => {
  try {
    const payroll = await Payroll.findById(req.params.id)
      .populate('employeeId', 'fullName employeeCode phone email position hourlyRate')
      .populate('branchId', 'name address');
    if (!payroll) return errorResponse(res, 'Không tìm thấy', 404);
    const penalties = await Penalty.find({ payrollId: payroll._id });
    return successResponse(res, { payroll, penalties });
  } catch (error) { next(error); }
};

const exportPDF = async (req, res, next) => {
  try {
    const payroll = await Payroll.findById(req.params.id)
      .populate('employeeId', 'fullName employeeCode phone email position')
      .populate('branchId', 'name address');
    if (!payroll) return errorResponse(res, 'Không tìm thấy', 404);

    const doc = new PDFDocument({ size: 'A4', margin: 50 });
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename=payslip-${payroll.employeeId?.employeeCode}-${payroll.month}-${payroll.year}.pdf`);
    doc.pipe(res);

    doc.fontSize(20).text('PHIEU LUONG', { align: 'center' });
    doc.moveDown();
    doc.fontSize(12).text(`Chi nhanh: ${payroll.branchId?.name || 'N/A'}`);
    doc.text(`Nhan vien: ${payroll.employeeId?.fullName || 'N/A'} (${payroll.employeeId?.employeeCode || 'N/A'})`);
    doc.text(`Thang: ${payroll.month}/${payroll.year}`);
    doc.moveDown();
    doc.text(`Luong gio: ${payroll.hourlyRate?.toLocaleString()} VND`);
    doc.text(`Tong gio lam: ${payroll.totalHours} gio`);
    doc.text(`Tong ngay lam: ${payroll.totalWorkingDays} ngay`);
    doc.text(`So lan tre: ${payroll.lateCount}`);
    doc.text(`Tong phut tre: ${payroll.lateMinutes}`);
    doc.moveDown();
    doc.text(`Luong co ban: ${payroll.baseSalary?.toLocaleString()} VND`);
    doc.text(`Tong phat: -${payroll.totalPenalty?.toLocaleString()} VND`);
    doc.text(`Khau tru co dinh: -${payroll.fixedDeduction?.toLocaleString()} VND`);
    doc.text(`Luong giu lai: -${payroll.heldSalary?.toLocaleString()} VND`);
    doc.text(`Luong ky truoc: +${payroll.nextPeriodSalary?.toLocaleString()} VND`);
    doc.moveDown();
    doc.fontSize(16).text(`THUC LANH: ${payroll.finalSalary?.toLocaleString()} VND`, { align: 'right' });
    doc.moveDown(2);
    doc.fontSize(10).text(`Trang thai: ${payroll.paymentStatus}`, { align: 'left' });
    doc.text(`Ngay xuat: ${new Date().toLocaleString('vi-VN')}`, { align: 'left' });

    doc.end();

    await logAction({ userId: req.user.id, role: req.user.role, action: 'EXPORT_PDF', resource: 'Payroll', resourceId: payroll._id, req });
  } catch (error) { next(error); }
};

export {  getPayrolls, getPayrollDetail, calculatePayroll, closePayrollMonth, markPaid, getPayslip, exportPDF  };
