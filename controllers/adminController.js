const { z } = require('zod');
const Order = require('../models/Order');
const Payment = require('../models/Payment');
const Product = require('../models/Product');
const User = require('../models/User');
const ApiError = require('../utils/ApiError');
const asyncHandler = require('../utils/asyncHandler');
const escapeRegex = require('../utils/escapeRegex');
const { emitToUser } = require('../socket');

const paging = (req) => {
  const page = Math.max(parseInt(req.query.page) || 1, 1);
  const limit = Math.min(Math.max(parseInt(req.query.limit) || 15, 1), 100);
  return { page, limit, skip: (page - 1) * limit };
};
const notCancelled = { orderStatus: { $ne: 'cancelled' } };

exports.statusSchema = z.object({ status: z.enum(Order.STATUSES) });
exports.paymentStatusSchema = z.object({ status: z.enum(['pending', 'paid', 'failed', 'refunded']) });
exports.customerStatusSchema = z.object({ isActive: z.boolean() });

exports.dashboard = asyncHandler(async (req, res) => {
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const days14 = new Date(Date.now() - 13 * 864e5); days14.setHours(0, 0, 0, 0);
  const months6 = new Date(); months6.setMonth(months6.getMonth() - 5, 1); months6.setHours(0, 0, 0, 0);
  const sum = { $sum: '$total' };

  const [totals, todayAgg, byStatus, daily, monthly, top, catSales, customers, products, lowStock, refunds] = await Promise.all([
    Order.aggregate([{ $match: notCancelled }, { $group: { _id: null, sales: sum, orders: { $sum: 1 } } }]),
    Order.aggregate([{ $match: { ...notCancelled, createdAt: { $gte: today } } }, { $group: { _id: null, sales: sum } }]),
    Order.aggregate([{ $group: { _id: '$orderStatus', count: { $sum: 1 } } }]),
    Order.aggregate([{ $match: { ...notCancelled, createdAt: { $gte: days14 } } }, { $group: { _id: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } }, sales: sum, orders: { $sum: 1 } } }, { $sort: { _id: 1 } }]),
    Order.aggregate([{ $match: { ...notCancelled, createdAt: { $gte: months6 } } }, { $group: { _id: { $dateToString: { format: '%Y-%m', date: '$createdAt' } }, revenue: sum } }, { $sort: { _id: 1 } }]),
    Order.aggregate([{ $match: notCancelled }, { $unwind: '$items' }, { $group: { _id: '$items.name', qty: { $sum: '$items.quantity' }, revenue: { $sum: '$items.lineTotal' } } }, { $sort: { qty: -1 } }, { $limit: 5 }]),
    Order.aggregate([{ $match: notCancelled }, { $unwind: '$items' }, { $lookup: { from: 'products', localField: 'items.product', foreignField: '_id', as: 'p' } }, { $unwind: '$p' }, { $lookup: { from: 'categories', localField: 'p.category', foreignField: '_id', as: 'c' } }, { $unwind: '$c' }, { $group: { _id: '$c.name', total: { $sum: '$items.lineTotal' } } }, { $sort: { total: -1 } }]),
    User.countDocuments({ role: 'customer' }),
    Product.countDocuments(),
    Product.countDocuments({ active: true, $expr: { $lte: ['$stock', '$lowStockThreshold'] } }),
    Payment.countDocuments({ status: 'refunded' }),
  ]);
  const st = Object.fromEntries(byStatus.map((s) => [s._id, s.count]));

  res.json({
    success: true,
    cards: {
      totalSales: totals[0]?.sales || 0, todaySales: todayAgg[0]?.sales || 0, totalOrders: totals[0]?.orders || 0,
      pendingOrders: st.pending || 0, completedOrders: st.delivered || 0, customers, products, lowStock, refunds,
    },
    charts: {
      daily: daily.map((d) => ({ date: d._id.slice(5), sales: d.sales, orders: d.orders })),
      monthly: monthly.map((m) => ({ month: m._id, revenue: m.revenue })),
      statuses: byStatus.map((s) => ({ status: s._id, count: s.count })),
      topProducts: top.map((t) => ({ name: t._id, qty: t.qty, revenue: t.revenue })),
      categorySales: catSales.map((c) => ({ name: c._id, total: c.total })),
    },
  });
});

exports.salesReport = asyncHandler(async (req, res) => {
  const to = req.query.to ? new Date(req.query.to) : new Date();
  const from = req.query.from ? new Date(req.query.from) : new Date(Date.now() - 29 * 864e5);
  if (isNaN(from) || isNaN(to)) throw new ApiError(400, 'Invalid date range');
  from.setHours(0, 0, 0, 0); to.setHours(23, 59, 59, 999);
  const match = { ...notCancelled, createdAt: { $gte: from, $lte: to } };
  const rows = await Order.aggregate([
    { $match: match },
    { $group: { _id: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } }, orders: { $sum: 1 }, subtotal: { $sum: '$subtotal' }, discount: { $sum: '$discount' }, delivery: { $sum: '$deliveryFee' }, tax: { $sum: '$tax' }, total: { $sum: '$total' } } },
    { $sort: { _id: 1 } },
  ]);
  const byPayment = await Order.aggregate([{ $match: match }, { $group: { _id: { method: '$paymentMethod', status: '$paymentStatus' }, orders: { $sum: 1 }, total: { $sum: '$total' } } }]);
  const totals = rows.reduce((t, r) => ({ orders: t.orders + r.orders, total: t.total + r.total, discount: t.discount + r.discount }), { orders: 0, total: 0, discount: 0 });
  res.json({ success: true, rows: rows.map(({ _id, ...r }) => ({ date: _id, ...r })), byPayment: byPayment.map((b) => ({ method: b._id.method, status: b._id.status, orders: b.orders, total: b.total })), totals });
});

exports.orders = asyncHandler(async (req, res) => {
  const { page, limit, skip } = paging(req);
  const { status, search } = req.query;
  const filter = {};
  if (status && Order.STATUSES.includes(status)) filter.orderStatus = status;
  if (search) {
    const rx = new RegExp(escapeRegex(String(search).slice(0, 40)), 'i');
    filter.$or = [{ orderNumber: rx }, { 'customer.name': rx }, { 'customer.phone': rx }];
  }
  const [orders, total] = await Promise.all([
    Order.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit),
    Order.countDocuments(filter),
  ]);
  res.json({ success: true, orders, total, page, pages: Math.ceil(total / limit) });
});

exports.updateOrderStatus = asyncHandler(async (req, res) => {
  const order = await Order.findById(req.params.id);
  if (!order) throw new ApiError(404, 'Order not found');
  if (['delivered', 'cancelled'].includes(order.orderStatus)) throw new ApiError(409, `This order is already ${order.orderStatus}`);
  const { status } = req.body;

  if (status === 'cancelled') {
    await Promise.all(order.items.map((i) => Product.updateOne({ _id: i.product }, { $inc: { stock: i.quantity, soldCount: -i.quantity } })));
  }
  order.orderStatus = status;
  order.statusHistory.push({ status, by: req.user._id });
  await order.save();
  emitToUser(order.user, 'order:status', { orderId: order._id, status });
  res.json({ success: true, order });
});

exports.payments = asyncHandler(async (req, res) => {
  const { page, limit, skip } = paging(req);
  const filter = req.query.status ? { status: req.query.status } : {};
  const [payments, total] = await Promise.all([
    Payment.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit).populate('order', 'orderNumber').populate('user', 'name email'),
    Payment.countDocuments(filter),
  ]);
  res.json({ success: true, payments, total, page, pages: Math.ceil(total / limit) });
});

// COD stays pending until staff mark it collected (paid)
exports.updatePaymentStatus = asyncHandler(async (req, res) => {
  const payment = await Payment.findById(req.params.id);
  if (!payment) throw new ApiError(404, 'Payment not found');
  payment.status = req.body.status;
  await payment.save();
  await Order.updateOne({ _id: payment.order }, { paymentStatus: req.body.status });
  res.json({ success: true, payment });
});

exports.customers = asyncHandler(async (req, res) => {
  const { page, limit, skip } = paging(req);
  const filter = { role: 'customer' };
  if (req.query.search) {
    const rx = new RegExp(escapeRegex(String(req.query.search).slice(0, 40)), 'i');
    filter.$or = [{ name: rx }, { email: rx }, { phone: rx }];
  }
  const [users, total] = await Promise.all([
    User.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit).lean(),
    User.countDocuments(filter),
  ]);
  const stats = await Order.aggregate([
    { $match: { user: { $in: users.map((u) => u._id) }, ...notCancelled } },
    { $group: { _id: '$user', orders: { $sum: 1 }, spent: { $sum: '$total' } } },
  ]);
  const map = Object.fromEntries(stats.map((s) => [String(s._id), s]));
  const customers = users.map(({ password, __v, ...u }) => ({ ...u, orders: map[String(u._id)]?.orders || 0, totalSpent: map[String(u._id)]?.spent || 0 }));
  res.json({ success: true, customers, total, page, pages: Math.ceil(total / limit) });
});

exports.setCustomerStatus = asyncHandler(async (req, res) => {
  const user = await User.findOne({ _id: req.params.id, role: 'customer' });
  if (!user) throw new ApiError(404, 'Customer not found');
  user.isActive = req.body.isActive;
  await user.save();
  res.json({ success: true, user });
});
