import express from 'express';
import authMiddleware from '../middleware/auth.js';
import statusMiddleware from '../middleware/status.js';
import authorize from '../middleware/role.js';
import {  getAuditLogs  } from '../controllers/auditLogController.js';

const router = express.Router();

router.use(authMiddleware, statusMiddleware, authorize('admin'));
router.get('/', getAuditLogs);
export default router;