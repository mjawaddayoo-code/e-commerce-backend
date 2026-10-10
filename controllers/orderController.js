const { z } = require('zod');
const Order = require('../models/Order');
const Payment = require('../models/Payment');
const Product = require('../models/Product');
const Coupon = require('../models/Coupon');
const Cart = require('../models/Cart');
const ApiError = require('../utils/ApiError');
const asyncHandler = require('../utils/asyncHandler');
const { priceCart } = require('../services/pricing');
const { emitToAdmins } = require('../socket');

const cartItem = z.object({
  product: z.string().regex(/^[a-f\d]{24}$/i),
  quantity: z.number().int().min(1).max(50),
  variants: z.array(z.object({ name: z.string(), label: z.string() })).optional(),
  extras: z.array(z.string()).optional(),
});

exports.quoteSchema = z.object({ items: z.array(cartItem), couponCode: z.string().optional(), area: z.string().optional() });

exports.createSchema = z.object({
  items: z.array(cartItem).min(1),
  couponCode: z.string().optional(),
  customer: z.object({
    name: z.string().min(2, 'Enter your full name'),
    phone: z.string().regex(/^(\+92|0)?3\d{9}$/, 'Enter a valid Pakistani mobile number'),
    email: z.string().email('Enter a valid email'),
  }),
  shippingAddress: z.object({
    area: z.string().min(2, 'Area is required'),
    city: z.string().min(2, 'City is required'),
    street: z.string().min(5, 'Enter your full street address'),
    landmark: z.string().optional(),
    instructions: z.string().max(300).optional(),
  }),
  paymentMethod: z.literal('cod', { errorMap: () => ({ message: 'Only Cash on Delivery is available' }) }),
});

const orderNumber = () => `ORD-${Math.floor(100000 + Math.random() * 900000)}`;

// Price preview for cart/checkout (server-calculated)
exports.quote = asyncHandler(async (req, res) => {
  const { items, subtotal, deliveryFee, discount, tax, total } = await priceCart(req.body.items, req.body.couponCode, req.body.area);
  res.json({ success: true, items, subtotal, deliveryFee, discount, tax, total });
});

exports.create = asyncHandler(async (req, res) => {
  const p = await priceCart(req.body.items, req.body.couponCode, req.body.shippingAddress.area);

  // Atomic stock reservation; roll back already-reserved lines if one fails
  const reserved = [];
  const release = () => Promise.all(reserved.map((it) => Product.updateOne({ _id: it.product }, { $inc: { stock: it.quantity, soldCount: -it.quantity } })));
  try {
    for (const it of p.items) {
      const r = await Product.updateOne({ _id: it.product, stock: { $gte: it.quantity } }, { $inc: { stock: -it.quantity, soldCount: it.quantity } });
      if (!r.modifiedCount) throw new ApiError(409, `"${it.name}" just went out of stock`);
      reserved.push(it);
    }
  } catch (e) {
    await release();
    throw e;
  }

  const buildOrder = () => ({
    orderNumber: orderNumber(),
    user: req.user._id,
    items: p.items,
    customer: req.body.customer,
    shippingAddress: req.body.shippingAddress,
    subtotal: p.subtotal, deliveryFee: p.deliveryFee, discount: p.discount, tax: p.tax, total: p.total,
    couponCode: p.coupon?.code,
    paymentMethod: 'cod', paymentStatus: 'pending', orderStatus: 'pending',
    statusHistory: [{ status: 'pending', by: req.user._id }],
    estimatedDeliveryAt: new Date(Date.now() + (p.settings.estimatedDeliveryMinutes || 45) * 60000),
  });
  let order;
  try {
    for (let attempt = 0; ; attempt++) {
      try { order = await Order.create(buildOrder()); break; }
      catch (e) { if (e.code === 11000 && attempt < 4) continue; throw e; }
    }
  } catch (e) { await release(); throw e; }

  await Payment.create({ order: order._id, user: req.user._id, amount: order.total, method: 'cod', provider: 'cod', status: 'pending' });
  if (p.coupon) await Coupon.updateOne({ _id: p.coupon._id }, { $inc: { usedCount: 1 } });
  await Cart.updateOne({ user: req.user._id }, { items: [] });

  emitToAdmins('order:new', { id: order._id, orderNumber: order.orderNumber, customer: order.customer.name, total: order.total, paymentMethod: order.paymentMethod, createdAt: order.createdAt });
  res.status(201).json({ success: true, order });
});

exports.mine = asyncHandler(async (req, res) => {
  const orders = await Order.find({ user: req.user._id }).sort({ createdAt: -1 }).limit(50);
  res.json({ success: true, orders });
});

// Customers can only read their own orders; staff can read any
exports.getOne = asyncHandler(async (req, res) => {
  const order = await Order.findById(req.params.id);
  const isStaff = ['admin', 'staff'].includes(req.user.role);
  if (!order || (!isStaff && String(order.user) !== String(req.user._id))) throw new ApiError(404, 'Order not found');
  res.json({ success: true, order });
});
