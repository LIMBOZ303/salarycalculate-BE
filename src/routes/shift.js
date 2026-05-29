import express from 'express';
import authMiddleware from '../middleware/auth.js';
import statusMiddleware from '../middleware/status.js';
import authorize from '../middleware/role.js';
import {  getShifts, getShiftById, createShift, updateShift, deleteShift  } from '../controllers/shiftController.js';

const router = express.Router();

router.use(authMiddleware, statusMiddleware);
router.get('/', authorize('admin', 'owner', 'branch_manager', 'employee'), getShifts);
router.get('/:id', authorize('admin', 'owner', 'branch_manager', 'employee'), getShiftById);
router.post('/', authorize('admin'), createShift);
router.put('/:id', authorize('admin'), updateShift);
router.delete('/:id', authorize('admin'), deleteShift);
export default router;