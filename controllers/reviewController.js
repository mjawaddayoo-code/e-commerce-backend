const mongoose = require('mongoose');
const { z } = require('zod');
const Review = require('../models/Review');
const Product = require('../models/Product');
const Order = require('../models/Order');
const ApiError = require('../utils/ApiError');
const asyncHandler = require('../utils/asyncHandler');

exports.reviewSchema = z.object({ rating: z.number().int().min(1).max(5), comment: z.string().max(1000).optional() });
exports.moderateSchema = z.object({ approved: z.boolean() });

const findProduct = async (idOrSlug) => {
  const q = mongoose.isValidObjectId(idOrSlug) ? { _id: idOrSlug } : { slug: idOrSlug };
  const p = await Product.findOne(q).select('_id');
  if (!p) throw new ApiError(404, 'Product not found');
  return p;
};

const recalc = async (productId) => {
  const [a] = await Review.aggregate([
    { $match: { product: new mongoose.Types.ObjectId(String(productId)), approved: true } },
    { $group: { _id: null, avg: { $avg: '$rating' }, n: { $sum: 1 } } },
  ]);
  await Product.updateOne({ _id: productId }, { rating: a ? Math.round(a.avg * 10) / 10 : 0, numReviews: a?.n || 0 });
};

const deliveredOrder = (userId, productId) => Order.findOne({ user: userId, orderStatus: 'delivered', 'items.product': productId }).select('_id');

exports.list = asyncHandler(async (req, res) => {
  const p = await findProduct(req.params.id);
  const reviews = await Review.find({ product: p._id, approved: true }).sort({ createdAt: -1 }).limit(50).populate('user', 'name');
  let canReview = false;
  if (req.user) canReview = !!(await deliveredOrder(req.user._id, p._id)) && !(await Review.exists({ product: p._id, user: req.user._id }));
  res.json({ success: true, reviews, canReview });
});

// Only customers with a delivered order containing this product may review it
exports.create = asyncHandler(async (req, res) => {
  const p = await findProduct(req.params.id);
  const order = await deliveredOrder(req.user._id, p._id);
  if (!order) throw new ApiError(403, 'Only customers who received this item can review it');
  if (await Review.exists({ product: p._id, user: req.user._id })) throw new ApiError(409, 'You have already reviewed this item');
  const review = await Review.create({ product: p._id, user: req.user._id, order: order._id, ...req.body });
  await recalc(p._id);
  res.status(201).json({ success: true, review });
});

exports.adminList = asyncHandler(async (req, res) => {
  const page = Math.max(parseInt(req.query.page) || 1, 1);
  const [reviews, total] = await Promise.all([
    Review.find().sort({ createdAt: -1 }).skip((page - 1) * 15).limit(15).populate('product', 'name').populate('user', 'name email'),
    Review.countDocuments(),
  ]);
  res.json({ success: true, reviews, total, page, pages: Math.ceil(total / 15) });
});

exports.moderate = asyncHandler(async (req, res) => {
  const review = await Review.findByIdAndUpdate(req.params.id, { approved: req.body.approved }, { new: true });
  if (!review) throw new ApiError(404, 'Review not found');
  await recalc(review.product);
  res.json({ success: true, review });
});

exports.remove = asyncHandler(async (req, res) => {
  const review = await Review.findByIdAndDelete(req.params.id);
  if (!review) throw new ApiError(404, 'Review not found');
  await recalc(review.product);
  res.json({ success: true });
});
