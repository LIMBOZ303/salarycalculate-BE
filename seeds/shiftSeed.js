import dotenv from 'dotenv';
import connectDB from '../src/config/db.js';
import Shift from '../src/models/Shift.js';

dotenv.config();

const shifts = [
  {
    name: 'Ca sáng',
    startTime: '08:00',
    endTime: '16:00',
    breakMinutes: 30,
    graceMinutes: 10,
  },
  {
    name: 'Ca chiều',
    startTime: '14:00',
    endTime: '22:00',
    breakMinutes: 30,
    graceMinutes: 10,
  },
  {
    name: 'Ca hành chính',
    startTime: '09:00',
    endTime: '18:00',
    breakMinutes: 60,
    graceMinutes: 10,
  },
];

const seedShifts = async () => {
  try {
    await connectDB();

    for (const data of shifts) {
      const exists = await Shift.findOne({ name: data.name });
      if (exists) {
        console.log(`Ca "${data.name}" đã tồn tại, bỏ qua.`);
        continue;
      }
      await Shift.create(data);
      console.log(`Đã tạo ca: ${data.name}`);
    }

    console.log('Seed ca làm hoàn tất!');
    process.exit(0);
  } catch (error) {
    console.error('Lỗi seed ca làm:', error.message);
    process.exit(1);
  }
};

seedShifts();
