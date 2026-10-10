const { z } = require('zod');
const Category = require('../models/Category');
const Product = require('../models/Product');
const ApiError = require('../utils/ApiError');
const asyncHandler = require('../utils/asyncHandler');

const imageSchema = z.object({ url: z.string().url(), publicId: z.string().optional() });

exports.categorySchema = z.object({
  name: z.string().min(2).max(60),
  description: z.string().max(300).optional(),
  image: imageSchema.optional(),
  sortOrder: z.number().int().optional(),
  active: z.boolean().optional(),
});
exports.categoryUpdateSchema = exports.categorySchema.partial();

// Public list includes active-product counts. Admins can pass ?all=true to include disabled ones.
exports.list = asyncHandler(async (req, res) => {
  const isStaff = ['admin', 'staff'].includes(req.user?.role);
  const match = isStaff && req.query.all === 'true' ? {} : { active: true };
  const categories = await Category.find(match).sort({ sortOrder: 1, name: 1 }).lean();
  const counts = await Product.aggregate([
    { $match: { active: true } },
    { $group: { _id: '$category', n: { $sum: 1 } } },
  ]);
  const map = Object.fromEntries(counts.map((c) => [String(c._id), c.n]));
  res.json({ success: true, categories: categories.map((c) => ({ ...c, itemCount: map[String(c._id)] || 0 })) });
});

exports.create = asyncHandler(async (req, res) => {
  const category = await Category.create(req.body);
  res.status(201).json({ success: true, category });
});

exports.update = asyncHandler(async (req, res) => {
  const category = await Category.findById(req.params.id);
  if (!category) throw new ApiError(404, 'Category not found');
  Object.assign(category, req.body);
  await category.save();
  res.json({ success: true, category });
});

exports.remove = asyncHandler(async (req, res) => {
  if (await Product.exists({ category: req.params.id })) {
    throw new ApiError(409, 'This category still has products. Move or delete them first, or disable the category.');
  }
  const category = await Category.findByIdAndDelete(req.params.id);
  if (!category) throw new ApiError(404, 'Category not found');
  res.json({ success: true, message: 'Category deleted' });
});
