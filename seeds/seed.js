require('dotenv').config();
import mongoose from 'mongoose';
import config from '../src/config/index.js';
import User from '../src/models/User.js';
import Employee from '../src/models/Employee.js';
import Branch from '../src/models/Branch.js';
import Shift from '../src/models/Shift.js';

const seedData = async () => {
  try {
    console.log('Đang kết nối MongoDB...');
    await mongoose.connect(config.mongodbUri);
    console.log('✅ Kết nối MongoDB thành công');

    console.log('Đang xóa dữ liệu cũ...');
    await Promise.all([
      User.deleteMany({}),
      Employee.deleteMany({}),
      Branch.deleteMany({}),
      Shift.deleteMany({}),
      mongoose.model('Attendance').deleteMany({}),
      mongoose.model('Revenue').deleteMany({}),
      mongoose.model('Payroll').deleteMany({}),
      mongoose.model('Penalty').deleteMany({}),
      mongoose.model('AuditLog').deleteMany({})
    ]);

    // 1. Tạo Shifts
    console.log('Đang tạo ca làm...');
    const shiftMorning = await Shift.create({
      name: 'Ca Sáng',
      startTime: '08:00',
      endTime: '17:00',
      breakMinutes: 60,
      graceMinutes: 15,
    });
    
    const shiftEvening = await Shift.create({
      name: 'Ca Chiều',
      startTime: '13:00',
      endTime: '22:00',
      breakMinutes: 60,
      graceMinutes: 15,
    });

    // 2. Tạo Admin và Owner
    console.log('Đang tạo Admin và Owner...');
    const adminUser = await User.create({
      fullName: 'System Admin',
      phone: '0900000001',
      email: 'admin@company.com',
      password: 'Password@123',
      role: 'admin',
      status: 'active',
    });

    const ownerUser = await User.create({
      fullName: 'System Owner',
      phone: '0900000002',
      email: 'owner@company.com',
      password: 'Password@123',
      role: 'owner',
      status: 'active',
    });

    // 3. Tạo Branches
    console.log('Đang tạo Chi nhánh...');
    const branchHCM = await Branch.create({
      name: 'Chi Nhánh HCM',
      address: '123 Nguyễn Huệ, Quận 1, TP.HCM',
      phone: '0281111111',
      latitude: 10.7769,
      longitude: 106.7009,
      allowedRadiusMeters: 200,
    });

    const branchHN = await Branch.create({
      name: 'Chi Nhánh Hà Nội',
      address: '456 Hoàn Kiếm, Hà Nội',
      phone: '0242222222',
      latitude: 21.0285,
      longitude: 105.8542,
      allowedRadiusMeters: 200,
    });

    // 4. Tạo Branch Managers
    console.log('Đang tạo Quản lý chi nhánh...');
    const bmHCMUser = await User.create({
      fullName: 'Quản Lý HCM',
      phone: '0900000003',
      email: 'bm_hcm@company.com',
      password: 'Password@123',
      role: 'branch_manager',
      status: 'active',
      branchId: branchHCM._id,
    });

    const bmHNUser = await User.create({
      fullName: 'Quản Lý HN',
      phone: '0900000004',
      email: 'bm_hn@company.com',
      password: 'Password@123',
      role: 'branch_manager',
      status: 'active',
      branchId: branchHN._id,
    });

    // Gán manager cho branch
    await Branch.findByIdAndUpdate(branchHCM._id, { managerId: bmHCMUser._id });
    await Branch.findByIdAndUpdate(branchHN._id, { managerId: bmHNUser._id });

    // 5. Tạo Employees
    console.log('Đang tạo Nhân viên...');
    const emp1User = await User.create({
      fullName: 'Nhân Viên HCM 1',
      phone: '0900000005',
      email: 'emp_hcm1@company.com',
      password: 'Password@123',
      role: 'employee',
      status: 'active',
      branchId: branchHCM._id,
    });
    
    await Employee.create({
      userId: emp1User._id,
      fullName: emp1User.fullName,
      phone: emp1User.phone,
      email: emp1User.email,
      branchId: branchHCM._id,
      shiftId: shiftMorning._id,
      hourlyRate: 25000,
      status: 'active',
    });

    const emp2User = await User.create({
      fullName: 'Nhân Viên HN 1',
      phone: '0900000006',
      email: 'emp_hn1@company.com',
      password: 'Password@123',
      role: 'employee',
      status: 'active',
      branchId: branchHN._id,
    });
    
    await Employee.create({
      userId: emp2User._id,
      fullName: emp2User.fullName,
      phone: emp2User.phone,
      email: emp2User.email,
      branchId: branchHN._id,
      shiftId: shiftEvening._id,
      hourlyRate: 30000,
      status: 'active',
    });

    console.log('🎉 Seed dữ liệu thành công!');
    console.log('=================================');
    console.log('Tài khoản test (Mật khẩu: Password@123 cho tất cả):');
    console.log('- Admin: admin@company.com');
    console.log('- Owner: owner@company.com');
    console.log('- Quản lý HCM: bm_hcm@company.com');
    console.log('- Quản lý HN: bm_hn@company.com');
    console.log('- Nhân viên HCM: emp_hcm1@company.com');
    console.log('- Nhân viên HN: emp_hn1@company.com');
    console.log('=================================');

    process.exit(0);
  } catch (error) {
    console.error('❌ Lỗi seed dữ liệu:', error);
    process.exit(1);
  }
};

seedData();
