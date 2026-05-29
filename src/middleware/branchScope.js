/**
 * Branch Scope Middleware
 * Restricts branch_manager to only see data from their assigned branch
 * Injects req.branchFilter for controllers to use in queries
 * Admin and owner see all branches
 * Must be used AFTER authMiddleware
 */
const branchScopeMiddleware = (req, res, next) => {
  // Admin and owner: no branch restriction
  if (req.user.role === 'admin' || req.user.role === 'owner') {
    req.branchFilter = {}; // no filter
    next();
    return;
  }

  // Branch manager: restrict to their branch only
  if (req.user.role === 'branch_manager') {
    if (!req.user.branchId) {
      return res.status(403).json({
        success: false,
        message: 'Bạn chưa được gán chi nhánh',
        timestamp: new Date().toISOString(),
      });
    }
    req.branchFilter = { branchId: req.user.branchId };
    next();
    return;
  }

  // Employee: restrict to their branch
  if (req.user.role === 'employee') {
    req.branchFilter = req.user.branchId
      ? { branchId: req.user.branchId }
      : {};
    next();
    return;
  }

  req.branchFilter = {};
  next();
};

export default branchScopeMiddleware;
