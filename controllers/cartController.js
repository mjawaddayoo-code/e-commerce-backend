const { z } = require('zod');
const Cart = require('../models/Cart');
const asyncHandler = require('../utils/asyncHandler');

exports.cartSchema = z.object({
  items: z.array(z.object({
    product: z.string().regex(/^[a-f\d]{24}$/i),
    quantity: z.number().int().min(1).max(50),
    variants: z.array(z.object({ name: z.string(), label: z.string() })).optional(),
    extras: z.array(z.string()).optional(),
  })).max(60),
});

exports.get = asyncHandler(async (req, res) => {
  const cart = await Cart.findOne({ user: req.user._id }).populate('items.product', 'name slug images price discountPrice stock variants extras');
  res.json({ success: true, items: (cart?.items || []).filter((i) => i.product) });
});

// Replaces the whole cart (client holds the working copy, server persists it)
exports.save = asyncHandler(async (req, res) => {
  await Cart.findOneAndUpdate({ user: req.user._id }, { items: req.body.items }, { upsert: true, new: true });
  res.json({ success: true });
});
