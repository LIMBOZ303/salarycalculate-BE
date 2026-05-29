import express from 'express';
import authMiddleware from '../middleware/auth.js';
import statusMiddleware from '../middleware/status.js';
import authorize from '../middleware/role.js';
import branchScopeMiddleware from '../middleware/branchScope.js';
import ownerReadOnlyMiddleware from '../middleware/ownerReadOnly.js';
import {
  checkIn,
  checkOut,
  getMyToday,
  getMySummary,
  getMyHistory,
  requestEdit,
  getAttendances,
  getSuspicious,
  updateAttendance,
  lockAttendance,
  closeMonth,
} from '../controllers/attendanceController.js';

const router = express.Router();

router.use(authMiddleware, statusMiddleware);

router.post('/check-in', authorize('employee'), checkIn);
router.post('/check-out', authorize('employee'), checkOut);
router.get('/me/today', authorize('employee'), getMyToday);
router.get('/me/summary', authorize('employee'), getMySummary);
router.get('/me/history', authorize('employee'), getMyHistory);
router.post('/me/request-edit', authorize('employee'), requestEdit);

router.get(
  '/suspicious',
  authorize('admin', 'owner', 'branch_manager'),
  branchScopeMiddleware,
  ownerReadOnlyMiddleware,
  getSuspicious
);
router.get(
  '/',
  authorize('admin', 'owner', 'branch_manager'),
  branchScopeMiddleware,
  ownerReadOnlyMiddleware,
  getAttendances
);
router.put('/:id', authorize('admin'), updateAttendance);
router.post('/:id/lock', authorize('admin'), lockAttendance);
router.post('/close-month', authorize('admin'), closeMonth);

export default router;
