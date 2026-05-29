export default {
  port: process.env.PORT || 5000,
  nodeEnv: process.env.NODE_ENV || 'development',
  mongodbUri:
    process.env.MONGO_URI ||
    process.env.MONGODB_URI ||
    'mongodb://127.0.0.1:27017/payroll_system',
  jwtSecret: process.env.JWT_SECRET || 'default-jwt-secret',
  jwtExpiresIn: process.env.JWT_EXPIRES_IN || '7d',
  corsOrigin: process.env.CORS_ORIGIN || 'http://localhost:3000',
  rateLimitWindowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS, 10) || 900000,
  rateLimitMax: parseInt(process.env.RATE_LIMIT_MAX, 10) || 300,
  authRateLimitMax:
    parseInt(process.env.AUTH_RATE_LIMIT_MAX, 10) ||
    (process.env.NODE_ENV === 'development' ? 500 : 20),
};
