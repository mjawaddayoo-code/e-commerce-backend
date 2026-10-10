const mongoose = require('mongoose');

// Cash on Delivery only: one record per order, marked paid by staff once cash is collected.
const paymentSchema = new mongoose.Schema(
  {
    order: { type: mongoose.Schema.Types.ObjectId, ref: 'Order', required: true, index: true },
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    amount: { type: Number, required: true },
    method: { type: String, enum: ['cod'], default: 'cod' },
    provider: { type: String, default: 'cod' },
    transactionId: { type: String, index: true, sparse: true },
    status: { type: String, enum: ['pending', 'paid', 'failed', 'refunded'], default: 'pending' },
    metadata: { type: mongoose.Schema.Types.Mixed },
  },
  { timestamps: true }
);

module.exports = mongoose.model('Payment', paymentSchema);
