import express from 'express';
import authMiddleware from '../middleware/auth.js';
import statusMiddleware from '../middleware/status.js';
import authorize from '../middleware/role.js';
import branchScopeMiddleware from '../middleware/branchScope.js';
import ownerReadOnlyMiddleware from '../middleware/ownerReadOnly.js';
import {  getEmployees, getEmployeeById, getMyProfile, createEmployee, updateEmployee, deleteEmployee  } from '../controllers/employeeController.js';

const router = express.Router();

router.use(authMiddleware, statusMiddleware);
// Employee self-view (must be before /:id to avoid conflict)
router.get('/me', getMyProfile);
// List & Detail - admin, owner, branch_manager
router.get('/', authorize('admin', 'owner', 'branch_manager'), branchScopeMiddleware, ownerReadOnlyMiddleware, getEmployees);
router.get('/:id', authorize('admin', 'owner', 'branch_manager'), branchScopeMiddleware, ownerReadOnlyMiddleware, getEmployeeById);
// CRUD - admin only
router.post('/', authorize('admin'), createEmployee);
router.put('/:id', authorize('admin'), updateEmployee);
router.delete('/:id', authorize('admin'), deleteEmployee);
export default router;