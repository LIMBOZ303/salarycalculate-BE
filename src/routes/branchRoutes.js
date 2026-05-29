import express from 'express';
import { protect, authorize } from '../middleware/authMiddleware.js';
import {
  getBranches,
  getBranchById,
  createBranch,
  updateBranch,
  deleteBranch,
} from '../controllers/branchController.js';

const router = express.Router();

router.use(protect);

router.get('/', authorize('admin', 'owner', 'branch_manager'), getBranches);
router.get('/:id', authorize('admin', 'owner', 'branch_manager'), getBranchById);
router.post('/', authorize('admin'), createBranch);
router.put('/:id', authorize('admin'), updateBranch);
router.delete('/:id', authorize('admin'), deleteBranch);

export default router;
