const { z } = require('zod');
const User = require('../models/User');
const ApiError = require('../utils/ApiError');
const asyncHandler = require('../utils/asyncHandler');

const phone = z.string().regex(/^(\+92|0)?3\d{9}$/, 'Enter a valid Pakistani mobile number');

exports.profileSchema = z.object({ name: z.string().min(2).max(80), phone: phone.optional().or(z.literal('')), email: z.string().email() });
exports.passwordSchema = z.object({ currentPassword: z.string().min(1), newPassword: z.string().min(8, 'Password must be at least 8 characters') });
exports.addressesSchema = z.object({
  addresses: z.array(z.object({
    label: z.string().max(30).optional(), area: z.string().min(2), city: z.string().min(2), street: z.string().min(5),
    landmark: z.string().optional(), instructions: z.string().max(300).optional(), isDefault: z.boolean().optional(),
  })).max(10),
});

exports.updateProfile = asyncHandler(async (req, res) => {
  const { name, phone: ph, email } = req.body;
  if (email !== req.user.email && (await User.exists({ email, _id: { $ne: req.user._id } }))) throw new ApiError(409, 'That email is already in use');
  Object.assign(req.user, { name, email, phone: ph || undefined });
  await req.user.save();
  res.json({ success: true, user: req.user });
});

exports.changePassword = asyncHandler(async (req, res) => {
  const user = await User.findById(req.user._id).select('+password');
  if (!(await user.matchPassword(req.body.currentPassword))) throw new ApiError(400, 'Current password is incorrect');
  user.password = req.body.newPassword;
  await user.save();
  res.json({ success: true, message: 'Password updated' });
});

exports.saveAddresses = asyncHandler(async (req, res) => {
  req.user.addresses = req.body.addresses;
  await req.user.save();
  res.json({ success: true, user: req.user });
});
