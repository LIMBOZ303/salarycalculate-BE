import dotenv from 'dotenv';
import connectDB from '../src/config/db.js';
import Branch from '../src/models/Branch.js';

dotenv.config();

const branches = [
  {
    name: 'Chi nhánh Quận 1',
    address: 'Quận 1, TP.HCM',
    phone: '0900000001',
    latitude: 10.776889,
    longitude: 106.700806,
    allowedRadiusMeters: 100,
  },
  {
    name: 'Chi nhánh Quận 7',
    address: 'Quận 7, TP.HCM',
    phone: '0900000002',
    latitude: 10.734034,
    longitude: 106.721589,
    allowedRadiusMeters: 100,
  },
];

const seedBranches = async () => {
  try {
    await connectDB();

    for (const data of branches) {
      const exists = await Branch.findOne({ name: data.name });
      if (exists) {
        console.log(`Chi nhánh "${data.name}" đã tồn tại, bỏ qua.`);
        continue;
      }
      await Branch.create(data);
      console.log(`Đã tạo chi nhánh: ${data.name}`);
    }

    console.log('Seed chi nhánh hoàn tất!');
    process.exit(0);
  } catch (error) {
    console.error('Lỗi seed chi nhánh:', error.message);
    process.exit(1);
  }
};

seedBranches();
