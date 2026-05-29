import jwt from 'jsonwebtoken';
import User from '../models/User.js';

const generateToken = (userId) => {
  return jwt.sign({ id: userId }, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRES_IN || '7d',
  });
};

/**
 * POST /api/auth/register
 * Đăng ký tài khoản employee (status pending)
 */
export const register = async (req, res) => {
  try {
    const { fullName, phone, email, password } = req.body;

    if (!fullName || !email || !password) {
      return res.status(400).json({
        success: false,
        message: 'Vui lòng nhập đầy đủ họ tên, email và mật khẩu',
        error: 'Validation failed',
      });
    }

    const existingUser = await User.findOne({ email: email.toLowerCase() });
    if (existingUser) {
      return res.status(400).json({
        success: false,
        message: 'Email đã được sử dụng',
        error: 'Duplicate email',
      });
    }

    const user = await User.create({
      fullName,
      phone,
      email,
      password,
      role: 'employee',
      status: 'pending',
    });

    return res.status(201).json({
      success: true,
      message: 'Đăng ký thành công. Tài khoản đang chờ admin duyệt.',
      data: {
        user: {
          id: user._id,
          fullName: user.fullName,
          phone: user.phone,
          email: user.email,
          role: user.role,
          status: user.status,
        },
      },
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: 'Đăng ký thất bại',
      error: error.message,
    });
  }
};

/**
 * POST /api/auth/login
 */
export const login = async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({
        success: false,
        message: 'Vui lòng nhập email và mật khẩu',
        error: 'Validation failed',
      });
    }

    const user = await User.findOne({ email: email.toLowerCase() }).select(
      '+password'
    );

    if (!user) {
      return res.status(401).json({
        success: false,
        message: 'Email hoặc mật khẩu không đúng',
        error: 'Invalid credentials',
      });
    }

    const isMatch = await user.matchPassword(password);
    if (!isMatch) {
      return res.status(401).json({
        success: false,
        message: 'Email hoặc mật khẩu không đúng',
        error: 'Invalid credentials',
      });
    }

    if (user.status === 'pending') {
      return res.status(403).json({
        success: false,
        message: 'Tài khoản đang chờ admin duyệt',
        error: 'Account pending',
      });
    }

    if (
      ['locked', 'inactive', 'resigned', 'rejected'].includes(user.status)
    ) {
      return res.status(403).json({
        success: false,
        message: 'Tài khoản không còn hoạt động',
        error: `Account status: ${user.status}`,
      });
    }

    if (user.status !== 'active') {
      return res.status(403).json({
        success: false,
        message: 'Tài khoản không còn hoạt động',
        error: `Account status: ${user.status}`,
      });
    }

    const token = generateToken(user._id);

    return res.status(200).json({
      success: true,
      message: 'Đăng nhập thành công',
      data: {
        token,
        user: {
          id: user._id,
          fullName: user.fullName,
          phone: user.phone,
          email: user.email,
          role: user.role,
          status: user.status,
          branchId: user.branchId,
          avatar: user.avatar,
        },
      },
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: 'Đăng nhập thất bại',
      error: error.message,
    });
  }
};

/**
 * GET /api/auth/me
 */
export const getMe = async (req, res) => {
  try {
    return res.status(200).json({
      success: true,
      message: 'Lấy thông tin thành công',
      data: {
        user: req.user,
      },
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: 'Không thể lấy thông tin người dùng',
      error: error.message,
    });
  }
};
