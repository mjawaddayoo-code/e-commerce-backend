const { z } = require('zod');
const Inquiry = require('../models/Inquiry');
const ApiError = require('../utils/ApiError');
const asyncHandler = require('../utils/asyncHandler');

exports.contactSchema = z.object({
  name: z.string().min(2).max(80), email: z.string().email('Enter a valid email'),
  phone: z.string().max(20).optional(), message: z.string().min(10, 'Message is too short').max(2000),
});
exports.handledSchema = z.object({ handled: z.boolean() });

exports.create = asyncHandler(async (req, res) => {
  await Inquiry.create(req.body);
  res.status(201).json({ success: true, message: 'Thanks! We will get back to you soon.' });
});
exports.adminList = asyncHandler(async (req, res) => res.json({ success: true, inquiries: await Inquiry.find().sort({ createdAt: -1 }).limit(100) }));
exports.markHandled = asyncHandler(async (req, res) => {
  const i = await Inquiry.findByIdAndUpdate(req.params.id, { handled: req.body.handled }, { new: true });
  if (!i) throw new ApiError(404, 'Inquiry not found');
  res.json({ success: true, inquiry: i });
});
