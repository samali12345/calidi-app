require('dotenv').config();
const mongoose = require('mongoose');
const User = require('./models/User');

const seedUsers = async () => {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('Connected to MongoDB');

    // Create Admin
    const adminExists = await User.findOne({ email: 'admin@calidi.com' });
    if (!adminExists) {
      await User.create({
        name: 'Admin User',
        email: 'admin@calidi.com',
        password: 'admin123',
        role: 'admin',
        isVerified: true
      });
      console.log('Admin user created: admin@calidi.com / admin123');
    } else {
      console.log('Admin user already exists');
    }

    // Create Regular User
    const userExists = await User.findOne({ email: 'user@calidi.com' });
    if (!userExists) {
      await User.create({
        name: 'Test Customer',
        email: 'user@calidi.com',
        password: 'user123',
        role: 'customer',
        isVerified: true
      });
      console.log('Regular user created: user@calidi.com / user123');
    } else {
      console.log('Regular user already exists');
    }

    process.exit(0);
  } catch (error) {
    console.error('Error seeding users:', error);
    process.exit(1);
  }
};

seedUsers();
