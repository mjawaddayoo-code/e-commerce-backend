require('dotenv').config();
const mongoose = require('mongoose');
const User = require('../models/User');

(async () => {
  const email = (process.env.ADMIN_EMAIL || '').trim().toLowerCase();
  const password = process.env.ADMIN_PASSWORD;
  if (!email || !password) { console.error('Set ADMIN_EMAIL and ADMIN_PASSWORD in server/.env'); process.exit(1); }
  if (password.length < 8) { console.error('ADMIN_PASSWORD must be at least 8 characters'); process.exit(1); }

  await mongoose.connect(process.env.MONGO_URI);
  const user = await User.findOne({ email });
  if (user) {
    user.role = 'admin';
    user.isActive = true;
    user.password = password;
    await user.save();
    console.log(`Existing account ${email} is now an admin and its password was set to ADMIN_PASSWORD.`);
  } else {
    await User.create({ name: process.env.ADMIN_NAME || 'Admin', email, password, role: 'admin' });
    console.log(`Admin created: ${email}`);
  }
  console.log(`Password read from .env has ${password.length} characters.`);
  process.exit(0);
})().catch((e) => { console.error(e.message); process.exit(1); });