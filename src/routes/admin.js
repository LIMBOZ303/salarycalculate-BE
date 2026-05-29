import express from 'express';
import authMiddleware from '../middleware/auth.js';
import statusMiddleware from '../middleware/status.js';
import authorize from '../middleware/role.js';
import {
  getUsers,
  changeRole,
  changeStatus,
  getPendingEmployees,
  approveEmployee,
  rejectEmployee,
  lockEmployee,
  unlockEmployee,
} from '../controllers/adminController.js';

const router = express.Router();

router.use(authMiddleware, statusMiddleware, authorize('admin'));

router.get('/users', getUsers);
router.patch('/users/:id/role', changeRole);
router.patch('/users/:id/status', changeStatus);
router.get('/employees/pending', getPendingEmployees);
router.post('/employees/:id/approve', approveEmployee);
router.post('/employees/:id/reject', rejectEmployee);
router.post('/employees/:id/lock', lockEmployee);
router.post('/employees/:id/unlock', unlockEmployee);

export default router;
