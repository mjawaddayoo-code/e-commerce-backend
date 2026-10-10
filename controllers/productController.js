const mongoose = require('mongoose');
const { z } = require('zod');
const Product = require('../models/Product');
const Category = require('../models/Category');
const ApiError = require('../utils/ApiError');
const asyncHandler = require('../utils/asyncHandler');
const escapeRegex = require('../utils/escapeRegex');

const imageSchema = z.object({ url: z.string().url(), publicId: z.string().optional() });

exports.productSchema = z.object({
  name: z.string().min(2).max(120),
  description: z.string().max(2000).optional(),
  category: z.string().regex(/^[a-f\d]{24}$/i, 'Invalid category'),
  images: z.array(imageSchema).max(8).optional(),
  price: z.number().min(0),
  discountPrice: z.number().min(0).nullable().optional(),
  offerExpiresAt: z.coerce.date().nullable().optional(),
  stock: z.number().int().min(0).optional(),
  sku: z.string().max(40).optional(),
  ingredients: z.array(z.string()).optional(),
  variants: z.array(z.object({
    name: z.string(),
    options: z.array(z.object({ label: z.string(), priceDelta: z.number().optional() })).min(1),
  })).optional(),
  extras: z.array(z.object({ name: z.string(), price: z.number().min(0) })).optional(),
  prepTimeMinutes: z.number().int().min(0).optional(),
  featured: z.boolean().optional(),
  isDeal: z.boolean().optional(),
  active: z.boolean().optional(),
});
exports.productUpdateSchema = exports.productSchema.partial();

const SORTS = {
  newest: { createdAt: -1 },
  price_asc: { price: 1 },
  price_desc: { price: -1 },
  popular: { soldCount: -1, numReviews: -1 },
  rating: { rating: -1, numReviews: -1 },
};

exports.list = asyncHandler(async (req, res) => {
  const { search, category, minPrice, maxPrice, rating, inStock, discount, featured, deals, sort = 'newest' } = req.query;
  const isStaff = ['admin', 'staff'].includes(req.user?.role);
  const page = Math.max(parseInt(req.query.page) || 1, 1);
  const limit = Math.min(Math.max(parseInt(req.query.limit) || 12, 1), 50);

  const filter = {};
  if (!(isStaff && req.query.all === 'true')) filter.active = true;

  if (search) {
    const rx = new RegExp(escapeRegex(String(search).slice(0, 60)), 'i');
    const cats = await Category.find({ name: rx }).select('_id').lean();
    filter.$or = [{ name: rx }, { description: rx }, { category: { $in: cats.map((c) => c._id) } }];
  }

  if (category) {
    const cat = mongoose.isValidObjectId(category)
      ? await Category.findById(category).select('_id')
      : await Category.findOne({ slug: String(category) }).select('_id');
    filter.category = cat ? cat._id : null;
  }

  if (minPrice || maxPrice) {
    filter.price = {};
    if (minPrice) filter.price.$gte = Number(minPrice);
    if (maxPrice) filter.price.$lte = Number(maxPrice);
  }
  if (rating) filter.rating = { $gte: Number(rating) };
  if (inStock === 'true') filter.stock = { $gt: 0 };
  if (discount === 'true') {
    filter.discountPrice = { $gt: 0 };
    filter.$and = [{ $or: [{ offerExpiresAt: null }, { offerExpiresAt: { $gt: new Date() } }] }];
  }
  if (featured === 'true') filter.featured = true;
  if (deals === 'true') filter.isDeal = true;

  const [products, total] = await Promise.all([
    Product.find(filter)
      .populate('category', 'name slug')
      .sort(SORTS[sort] || SORTS.newest)
      .skip((page - 1) * limit)
      .limit(limit),
    Product.countDocuments(filter),
  ]);

  res.json({ success: true, products, page, pages: Math.ceil(total / limit), total });
});

// Accepts either a Mongo id or a slug (SEO-friendly URLs)
exports.getOne = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const q = mongoose.isValidObjectId(id) ? { _id: id } : { slug: id };
  const product = await Product.findOne(q).populate('category', 'name slug');
  const isStaff = ['admin', 'staff'].includes(req.user?.role);
  if (!product || (!product.active && !isStaff)) throw new ApiError(404, 'Product not found');

  const related = await Product.find({ category: product.category._id, _id: { $ne: product._id }, active: true })
    .limit(4).populate('category', 'name slug');
  res.json({ success: true, product, related });
});

exports.create = asyncHandler(async (req, res) => {
  if (!(await Category.exists({ _id: req.body.category }))) throw new ApiError(400, 'Category does not exist');
  const product = await Product.create(req.body);
  res.status(201).json({ success: true, product });
});

exports.update = asyncHandler(async (req, res) => {
  const product = await Product.findById(req.params.id);
  if (!product) throw new ApiError(404, 'Product not found');
  if (req.body.category && !(await Category.exists({ _id: req.body.category }))) throw new ApiError(400, 'Category does not exist');
  Object.assign(product, req.body);
  await product.save();
  res.json({ success: true, product });
});

exports.remove = asyncHandler(async (req, res) => {
  const product = await Product.findByIdAndDelete(req.params.id);
  if (!product) throw new ApiError(404, 'Product not found');
  res.json({ success: true, message: 'Product deleted' });
});
