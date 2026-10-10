const { z } = require('zod');
const Coupon = require('../models/Coupon');
const ApiError = require('../utils/ApiError');
const asyncHandler = require('../utils/asyncHandler');
const { priceCart } = require('../services/pricing');

exports.couponSchema = z.object({
  code: z.string().min(3).max(20).regex(/^[A-Za-z0-9]+$/, 'Letters and numbers only'),
  type: z.enum(['percentage', 'fixed']),
  value: z.number().positive(),
  minOrder: z.number().min(0).optional(),
  maxDiscount: z.number().positive().nullable().optional(),
  expiresAt: z.coerce.date().nullable().optional(),
  usageLimit: z.number().int().positive().nullable().optional(),
  active: z.boolean().optional(),
}).refine((c) => c.type !== 'percentage' || c.value <= 100, { message: 'Percentage cannot exceed 100', path: ['value'] });
exports.couponUpdateSchema = z.object({ active: z.boolean().optional(), expiresAt: z.coerce.date().nullable().optional(), usageLimit: z.number().int().positive().nullable().optional() });
exports.validateSchema = z.object({
  code: z.string().min(1),
  items: z.array(z.object({ product: z.string(), quantity: z.number().int().min(1), variants: z.array(z.any()).optional(), extras: z.array(z.string()).optional() })).min(1),
});

// Discounts are always computed on the server from the real cart
exports.validate = asyncHandler(async (req, res) => {
  const { subtotal, discount, total, coupon } = await priceCart(req.body.items, req.body.code);
  res.json({ success: true, code: coupon.code, subtotal, discount, total });
});

exports.list = asyncHandler(async (req, res) => res.json({ success: true, coupons: await Coupon.find().sort({ createdAt: -1 }) }));
exports.create = asyncHandler(async (req, res) => res.status(201).json({ success: true, coupon: await Coupon.create(req.body) }));
exports.update = asyncHandler(async (req, res) => {
  const c = await Coupon.findByIdAndUpdate(req.params.id, req.body, { new: true });
  if (!c) throw new ApiError(404, 'Coupon not found');
  res.json({ success: true, coupon: c });
});
exports.remove = asyncHandler(async (req, res) => {
  if (!(await Coupon.findByIdAndDelete(req.params.id))) throw new ApiError(404, 'Coupon not found');
  res.json({ success: true });
});
