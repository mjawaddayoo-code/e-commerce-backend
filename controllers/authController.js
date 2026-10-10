const { z } = require('zod');
const User = require('../models/User');
const ApiError = require('../utils/ApiError');
const asyncHandler = require('../utils/asyncHandler');
const crypto = require('crypto');
const { sendToken, clearToken } = require('../utils/token');
const { sendMail } = require('../services/mailer');

const phoneRe = /^(\+92|0)?3\d{9}$/;

exports.registerSchema = z.object({
  name: z.string().min(2, 'Name is too short').max(80),
  email: z.string().email('Enter a valid email'),
  phone: z.string().regex(phoneRe, 'Enter a valid Pakistani mobile number').optional(),
  password: z.string().min(8, 'Password must be at least 8 characters'),
});

exports.loginSchema = z.object({
  email: z.string().email('Enter a valid email'),
  password: z.string().min(1, 'Password is required'),
});

// Role is never read from the body: public signups are always customers.
exports.register = asyncHandler(async (req, res) => {
  const { name, email, phone, password } = req.body;
  if (await User.exists({ email })) throw new ApiError(409, 'An account with this email already exists');
  const user = await User.create({ name, email, phone, password, role: 'customer' });
  sendToken(res, user, 201);
});

const doLogin = (allowedRoles) =>
  asyncHandler(async (req, res) => {
    const user = await User.findOne({ email: req.body.email }).select('+password');
    if (!user || !(await user.matchPassword(req.body.password))) throw new ApiError(401, 'Invalid email or password');
    if (!user.isActive) throw new ApiError(403, 'Your account has been disabled');
    if (allowedRoles && !allowedRoles.includes(user.role)) throw new ApiError(403, 'Not authorized for admin access');
    sendToken(res, user);
  });

exports.login = doLogin();
exports.adminLogin = doLogin(['admin', 'staff']);

exports.logout = (req, res) => {
  clearToken(res);
  res.json({ success: true, message: 'Logged out' });
};

exports.me = (req, res) => res.json({ success: true, user: req.user });

exports.forgotSchema = z.object({ email: z.string().email('Enter a valid email') });
exports.resetSchema = z.object({ token: z.string().min(20), password: z.string().min(8, 'Password must be at least 8 characters') });

const hash = (t) => crypto.createHash('sha256').update(t).digest('hex');

// Always answers the same way so the form can't be used to discover which emails have accounts
exports.forgotPassword = asyncHandler(async (req, res) => {
  const user = await User.findOne({ email: req.body.email, isActive: true });
  if (user) {
    const token = crypto.randomBytes(32).toString('hex');
    user.resetTokenHash = hash(token);
    user.resetTokenExpires = new Date(Date.now() + 60 * 60 * 1000);
    await user.save();
    const link = `${(process.env.CLIENT_ORIGIN || '').split(',')[0]}/reset-password/${token}`;
    try { await sendMail({ to: user.email, subject: 'Reset your password', text: `Use this link to set a new password (valid for 1 hour):\n${link}\n\nIf you did not ask for this, ignore this email.` }); }
    catch (e) { console.error('Reset email failed:', e.message); }
  }
  res.json({ success: true, message: 'If an account exists for that email, a reset link has been sent.' });
});

exports.resetPassword = asyncHandler(async (req, res) => {
  const user = await User.findOne({ resetTokenHash: hash(req.body.token), resetTokenExpires: { $gt: new Date() } }).select('+resetTokenHash +resetTokenExpires');
  if (!user) throw new ApiError(400, 'This reset link is invalid or has expired');
  user.password = req.body.password;
  user.resetTokenHash = undefined;
  user.resetTokenExpires = undefined;
  await user.save();
  sendToken(res, user);
});
