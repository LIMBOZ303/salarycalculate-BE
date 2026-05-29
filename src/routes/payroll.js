import express from 'express';
import authMiddleware from '../middleware/auth.js';
import statusMiddleware from '../middleware/status.js';
import authorize from '../middleware/role.js';
import branchScopeMiddleware from '../middleware/branchScope.js';
import ownerReadOnlyMiddleware from '../middleware/ownerReadOnly.js';
import {
  getPayrolls,
  getPayrollDetail,
  calculatePayroll,
  closePayrollMonth,
  markPaid,
  getPayslip,
  exportPDF,
} from '../controllers/payrollController.js';

const router = express.Router();

router.use(authMiddleware, statusMiddleware);

router.get(
  '/',
  authorize('admin', 'owner', 'branch_manager'),
  branchScopeMiddleware,
  ownerReadOnlyMiddleware,
  getPayrolls
);
router.get(
  '/:employeeId/:month/:year',
  authorize('admin', 'owner', 'branch_manager', 'employee'),
  getPayrollDetail
);
router.get(
  '/:id/payslip',
  authorize('admin', 'owner', 'branch_manager', 'employee'),
  getPayslip
);
router.get(
  '/:id/export-pdf',
  authorize('admin', 'owner', 'branch_manager', 'employee'),
  exportPDF
);
router.post('/calculate', authorize('admin'), calculatePayroll);
router.post('/close-month', authorize('admin'), closePayrollMonth);
router.post('/:id/mark-paid', authorize('admin'), markPaid);

export default router;
