const mongoose = require('mongoose');

// Single-document collection (key: 'main')
const settingsSchema = new mongoose.Schema(
  {
    key: { type: String, default: 'main', unique: true },
    businessName: { type: String, default: 'My Bakery & Kitchen' },
    logo: { url: String, publicId: String },
    phone: String,
    whatsapp: String,
    email: String,
    address: String,
    openingTime: { type: String, default: '10:00' },
    closingTime: { type: String, default: '23:00' },
    deliveryFee: { type: Number, default: 100 },
    freeDeliveryThreshold: { type: Number, default: 2000 },
    estimatedDeliveryMinutes: { type: Number, default: 45 },
    deliveryAreas: [{ name: String, fee: Number, active: { type: Boolean, default: true } }],
    taxPercent: { type: Number, default: 0 },
    currency: { type: String, default: 'PKR' },
    social: { facebook: String, instagram: String, tiktok: String },
    googleMapsEmbedUrl: String,
  },
  { timestamps: true }
);

settingsSchema.statics.get = async function () {
  return (await this.findOne({ key: 'main' })) || this.create({ key: 'main' });
};

module.exports = mongoose.model('Settings', settingsSchema);
