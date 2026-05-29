import express from 'express';
import { protect, authorize } from '../middleware/authMiddleware.js';
import {
  checkIn,
  checkOut,
  getMyTodayAttendance,
  getMyAttendanceSummary,
  getMyAttendanceHistory,
  getAttendances,
  getSuspiciousAttendances,
  updateAttendance,
  lockAttendance,
} from '../controllers/attendanceController.js';

const router = express.Router();

router.use(protect);

router.post('/check-in', authorize('employee'), checkIn);
router.post('/check-out', authorize('employee'), checkOut);
router.get('/me/today', authorize('employee'), getMyTodayAttendance);
router.get('/me/summary', authorize('employee'), getMyAttendanceSummary);
router.get('/me/history', authorize('employee'), getMyAttendanceHistory);

router.get(
  '/suspicious',
  authorize('admin', 'owner', 'branch_manager'),
  getSuspiciousAttendances
);
router.get('/', authorize('admin', 'owner', 'branch_manager'), getAttendances);

router.put('/:id', authorize('admin'), updateAttendance);
router.post('/:id/lock', authorize('admin'), lockAttendance);

export default router;
