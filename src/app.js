import express from 'express';
import cors from 'cors';
import morgan from 'morgan';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import config from './config/index.js';
import errorHandler from './middleware/errorHandler.js';
import authRoutes from './routes/authRoutes.js';
import adminUserRoutes from './routes/adminUserRoutes.js';
import employeeRoutes from './routes/employeeRoutes.js';
import branchRoutes from './routes/branchRoutes.js';
import shiftRoutes from './routes/shift.js';
import attendanceRoutes from './routes/attendance.js';
import revenueRoutes from './routes/revenue.js';
import payrollRoutes from './routes/payroll.js';
import reportRoutes from './routes/report.js';
import auditLogRoutes from './routes/auditLog.js';

const app = express();

app.use(cors());
app.use(express.json());
app.use(morgan('dev'));
app.use(helmet());

app.use(express.urlencoded({ extended: true, limit: '10mb' }));

const globalLimiter = rateLimit({
  windowMs: config.rateLimitWindowMs,
  max: config.rateLimitMax,
  message: { success: false, message: 'Quá nhiều request, vui lòng thử lại sau.' },
});

const authLimiter = rateLimit({
  windowMs: config.rateLimitWindowMs,
  max: config.authRateLimitMax,
  message: {
    success: false,
    message: 'Quá nhiều request đăng nhập/đăng ký, vui lòng thử lại sau.',
  },
});

app.use('/api', globalLimiter);
app.use('/api/auth', authLimiter);

app.get('/', (req, res) => {
  res.status(200).json({
    success: true,
    message: 'Payroll API is running',
  });
});

app.get('/health', (req, res) => {
  res.status(200).json({ status: 'OK', timestamp: new Date() });
});

app.use('/api/auth', authRoutes);
app.use('/api/admin', adminUserRoutes);
app.use('/api/employees', employeeRoutes);
app.use('/api/branches', branchRoutes);
app.use('/api/shifts', shiftRoutes);
app.use('/api/attendance', attendanceRoutes);
app.use('/api/revenue', revenueRoutes);
app.use('/api/payroll', payrollRoutes);
app.use('/api/reports', reportRoutes);
app.use('/api/audit-logs', auditLogRoutes);

app.use((req, res) => {
  res.status(404).json({
    success: false,
    message: 'Endpoint không tồn tại',
  });
});

app.use(errorHandler);

export default app;
