import express from 'express';
import authMiddleware from '../middleware/auth.js';
import statusMiddleware from '../middleware/status.js';
import authorize from '../middleware/role.js';
import branchScopeMiddleware from '../middleware/branchScope.js';
import {
  getDashboard,
  getMonthlyReport,
  getQuarterlyReport,
  getYearlyReport,
} from '../controllers/reportController.js';

const router = express.Router();

router.use(
  authMiddleware,
  statusMiddleware,
  authorize('admin', 'owner', 'branch_manager'),
  branchScopeMiddleware
);

router.get('/dashboard', getDashboard);
router.get('/monthly', getMonthlyReport);
router.get('/quarterly', getQuarterlyReport);
router.get('/yearly', getYearlyReport);

export default router;
