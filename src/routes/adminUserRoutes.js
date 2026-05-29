import express from 'express';
import { protect, authorize } from '../middleware/authMiddleware.js';
import {
  getUsers,
  getPendingEmployees,
  approveEmployee,
  rejectEmployee,
  lockUser,
  unlockUser,
  updateUserStatus,
  updateUserRole,
} from '../controllers/adminUserController.js';

const router = express.Router();

router.use(protect, authorize('admin'));

router.get('/users', getUsers);
router.patch('/users/:id/role', updateUserRole);
router.patch('/users/:id/status', updateUserStatus);
router.get('/employees/pending', getPendingEmployees);
router.post('/employees/:id/approve', approveEmployee);
router.post('/employees/:id/reject', rejectEmployee);
router.post('/employees/:id/lock', lockUser);
router.post('/employees/:id/unlock', unlockUser);

export default router;
