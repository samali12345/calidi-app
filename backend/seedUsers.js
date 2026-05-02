require('dotenv').config();
const mongoose = require('mongoose');
const User = require('./models/User');

const seedUsers = async () => {
  try {
    console.log('📦 Connecting to MongoDB...');
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('✅ Connected.');

    const demoUsers = [
      {
        email: 'admin@calidi.com',
        password: 'admin123',
        name: 'Admin User',
        role: 'admin'
      },
      {
        email: 'user@calidi.com',
        password: 'user123',
        name: 'Test Customer',
        role: 'customer'
      }
    ];

    for (const u of demoUsers) {
      const user = await User.findOne({ email: u.email });
      if (user) {
        console.log(`ℹ️ Resetting password for ${u.email}...`);
        user.password = u.password;
        await user.save();
      } else {
        await User.create(u);
        console.log(`+ Created ${u.role}: ${u.email}`);
      }
    }

    console.log('🏁 Seeding finished.');
    process.exit(0);
  } catch (err) {
    console.error('❌ Seeding failed:', err.message);
    process.exit(1);
  }
};

seedUsers();
