import express from 'express';
import { protect, authorize } from '../middleware/authMiddleware.js';
import {
  getShifts,
  getShiftById,
  createShift,
  updateShift,
  deleteShift,
} from '../controllers/shiftController.js';

const router = express.Router();

router.use(protect);

router.get('/', authorize('admin', 'owner', 'branch_manager'), getShifts);
router.get('/:id', authorize('admin', 'owner', 'branch_manager'), getShiftById);
router.post('/', authorize('admin'), createShift);
router.put('/:id', authorize('admin'), updateShift);
router.delete('/:id', authorize('admin'), deleteShift);

export default router;
