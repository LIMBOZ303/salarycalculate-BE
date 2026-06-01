import express from 'express';
import { protect, authorize } from '../middleware/authMiddleware.js';
import ownerReadOnly from '../middleware/ownerReadOnly.js';
import {
  getRevenues,
  getRevenueById,
  createRevenue,
  updateRevenue,
  deleteRevenue,
  confirmRevenue,
  getMonthlySummary,
  getQuarterlySummary,
} from '../controllers/revenueController.js';

const router = express.Router();

router.use(protect, ownerReadOnly);

router.get(
  '/summary/monthly',
  authorize('admin', 'owner', 'branch_manager'),
  getMonthlySummary
);
router.get(
  '/summary/quarterly',
  authorize('admin', 'owner', 'branch_manager'),
  getQuarterlySummary
);

router.get('/', authorize('admin', 'owner', 'branch_manager'), getRevenues);
router.get('/:id', authorize('admin', 'owner', 'branch_manager'), getRevenueById);

router.post('/', authorize('admin', 'branch_manager'), createRevenue);
router.put('/:id', authorize('admin', 'branch_manager'), updateRevenue);
router.delete('/:id', authorize('admin'), deleteRevenue);
router.post('/:id/confirm', authorize('admin'), confirmRevenue);

export default router;
