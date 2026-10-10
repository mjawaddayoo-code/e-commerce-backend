const Wishlist = require('../models/Wishlist');
const Product = require('../models/Product');
const ApiError = require('../utils/ApiError');
const asyncHandler = require('../utils/asyncHandler');

const load = (userId) => Wishlist.findOne({ user: userId }).populate({ path: 'products', match: { active: true }, populate: { path: 'category', select: 'name slug' } });

exports.get = asyncHandler(async (req, res) => {
  const w = await load(req.user._id);
  res.json({ success: true, products: w?.products || [] });
});

exports.add = asyncHandler(async (req, res) => {
  if (!(await Product.exists({ _id: req.params.productId, active: true }))) throw new ApiError(404, 'Product not found');
  await Wishlist.updateOne({ user: req.user._id }, { $addToSet: { products: req.params.productId } }, { upsert: true });
  res.json({ success: true });
});

exports.remove = asyncHandler(async (req, res) => {
  await Wishlist.updateOne({ user: req.user._id }, { $pull: { products: req.params.productId } });
  res.json({ success: true });
});
