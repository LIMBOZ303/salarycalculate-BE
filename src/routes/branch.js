import express from 'express';
import authMiddleware from '../middleware/auth.js';
import statusMiddleware from '../middleware/status.js';
import authorize from '../middleware/role.js';
import ownerReadOnlyMiddleware from '../middleware/ownerReadOnly.js';
import {  getBranches, getBranchById, createBranch, updateBranch, deleteBranch  } from '../controllers/branchController.js';

const router = express.Router();

router.use(authMiddleware, statusMiddleware);
router.get('/', authorize('admin', 'owner', 'branch_manager'), ownerReadOnlyMiddleware, getBranches);
router.get('/:id', authorize('admin', 'owner', 'branch_manager'), ownerReadOnlyMiddleware, getBranchById);
router.post('/', authorize('admin'), createBranch);
router.put('/:id', authorize('admin'), updateBranch);
router.delete('/:id', authorize('admin'), deleteBranch);
export default router;