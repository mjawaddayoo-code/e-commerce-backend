const mongoose = require('mongoose');

// Order items are embedded (OrderItem snapshot): price at purchase time never changes.
const orderItemSchema = new mongoose.Schema({
  product: { type: mongoose.Schema.Types.ObjectId, ref: 'Product', required: true },
  name: String,
  image: String,
  unitPrice: { type: Number, required: true },
  quantity: { type: Number, required: true, min: 1 },
  variants: [{ name: String, label: String, priceDelta: Number }],
  extras: [{ name: String, price: Number }],
  lineTotal: { type: Number, required: true },
});

const STATUSES = ['pending', 'confirmed', 'preparing', 'ready', 'out_for_delivery', 'delivered', 'cancelled'];

const orderSchema = new mongoose.Schema(
  {
    orderNumber: { type: String, unique: true },
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    items: [orderItemSchema],
    customer: { name: String, phone: String, email: String },
    shippingAddress: { area: String, city: String, street: String, landmark: String, instructions: String },
    subtotal: Number,
    deliveryFee: { type: Number, default: 0 },
    discount: { type: Number, default: 0 },
    couponCode: String,
    tax: { type: Number, default: 0 },
    total: Number,
    paymentMethod: { type: String, enum: ['cod'], default: 'cod' },
    paymentStatus: { type: String, enum: ['pending', 'paid', 'failed', 'refunded'], default: 'pending' },
    orderStatus: { type: String, enum: STATUSES, default: 'pending', index: true },
    statusHistory: [{ status: String, at: { type: Date, default: Date.now }, by: { type: mongoose.Schema.Types.ObjectId, ref: 'User' } }],
    estimatedDeliveryAt: Date,
  },
  { timestamps: true }
);

orderSchema.statics.STATUSES = STATUSES;
module.exports = mongoose.model('Order', orderSchema);
