import express from 'express';
import { protect, authorize } from '../middleware/authMiddleware.js';
import {
  getEmployees,
  getEmployeeById,
  getMeEmployee,
  createEmployee,
  updateEmployee,
  deleteEmployee,
} from '../controllers/employeeController.js';

const router = express.Router();

router.use(protect);

router.get('/me', authorize('employee', 'admin', 'owner', 'branch_manager'), getMeEmployee);
router.get('/', authorize('admin', 'owner', 'branch_manager'), getEmployees);
router.get('/:id', authorize('admin', 'owner', 'branch_manager', 'employee'), getEmployeeById);
router.post('/', authorize('admin'), createEmployee);
router.put('/:id', authorize('admin'), updateEmployee);
router.delete('/:id', authorize('admin'), deleteEmployee);

export default router;
