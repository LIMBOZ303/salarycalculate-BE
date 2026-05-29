import express from 'express';
import authMiddleware from '../middleware/auth.js';
import statusMiddleware from '../middleware/status.js';
import authorize from '../middleware/role.js';
import {
  getRevenues,
  getRevenueSummary,
  getMyBranchRevenue,
  createMyBranchRevenue,
  updateMyBranchRevenue,
  createRevenue,
  updateRevenue,
  deleteRevenue,
} from '../controllers/revenueController.js';

const router = express.Router();

router.use(authMiddleware, statusMiddleware);

router.get('/my-branch', authorize('branch_manager'), getMyBranchRevenue);
router.post('/my-branch', authorize('branch_manager'), createMyBranchRevenue);
router.put('/my-branch/:id', authorize('branch_manager'), updateMyBranchRevenue);
router.get('/summary', authorize('admin', 'owner'), getRevenueSummary);
router.get('/', authorize('admin', 'owner'), getRevenues);
router.post('/', authorize('admin'), createRevenue);
router.put('/:id', authorize('admin'), updateRevenue);
router.delete('/:id', authorize('admin'), deleteRevenue);

export default router;
