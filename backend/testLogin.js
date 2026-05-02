require('dotenv').config();
const mongoose = require('mongoose');
const User = require('./models/User');

const testLogin = async () => {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('Connected to DB');

    const email = 'user@calidi.com';
    const password = 'user123';

    const user = await User.findOne({ email });
    if (!user) {
      console.log('User not found!');
    } else {
      console.log('User found:', user.email);
      const isMatch = await user.comparePassword(password);
      console.log('Password match:', isMatch);
    }
    process.exit(0);
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
};

testLogin();
