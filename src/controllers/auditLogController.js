import AuditLog from '../models/AuditLog.js';
import {  successResponse, paginatedResponse  } from '../utils/response.js';
import {  buildPagination  } from '../utils/helpers.js';

const getAuditLogs = async (req, res, next) => {
  try {
    const { page = 1, limit = 50, userId, action, resource, startDate, endDate } = req.query;
    const skip = (parseInt(page) - 1) * parseInt(limit);
    const filter = {};
    if (userId) filter.userId = userId;
    if (action) filter.action = action;
    if (resource) filter.resource = resource;
    if (startDate || endDate) {
      filter.createdAt = {};
      if (startDate) filter.createdAt.$gte = new Date(startDate);
      if (endDate) filter.createdAt.$lte = new Date(endDate);
    }

    const [logs, total] = await Promise.all([
      AuditLog.find(filter)
        .populate('userId', 'fullName email role')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(parseInt(limit)),
      AuditLog.countDocuments(filter),
    ]);

    return paginatedResponse(res, logs, buildPagination(page, limit, total));
  } catch (error) { next(error); }
};

export {  getAuditLogs  };
