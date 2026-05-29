import dotenv from 'dotenv';
import connectDB from '../src/config/db.js';
import User from '../src/models/User.js';

dotenv.config();

const seedAdmin = async () => {
  try {
    await connectDB();

    const existingAdmin = await User.findOne({ email: 'admin@gmail.com' });

    if (existingAdmin) {
      console.log('Admin đã tồn tại, bỏ qua seed.');
      process.exit(0);
    }

    await User.create({
      fullName: 'System Admin',
      phone: '0900000000',
      email: 'admin@gmail.com',
      password: '123456',
      role: 'admin',
      status: 'active',
    });

    console.log('Tạo admin mặc định thành công!');
    console.log('Email: admin@gmail.com');
    console.log('Password: 123456');
    process.exit(0);
  } catch (error) {
    console.error('Lỗi seed admin:', error.message);
    process.exit(1);
  }
};

seedAdmin();
