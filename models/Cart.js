const mongoose = require('mongoose');

const cartSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, unique: true },
    items: [{
      product: { type: mongoose.Schema.Types.ObjectId, ref: 'Product', required: true },
      quantity: { type: Number, min: 1, max: 50, default: 1 },
      variants: [{ name: String, label: String }],
      extras: [String],
    }],
  },
  { timestamps: true }
);

module.exports = mongoose.model('Cart', cartSchema);
