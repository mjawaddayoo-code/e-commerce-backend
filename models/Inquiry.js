const mongoose = require('mongoose');

const inquirySchema = new mongoose.Schema(
  {
    name: { type: String, required: true, maxlength: 80 },
    email: { type: String, required: true },
    phone: String,
    message: { type: String, required: true, maxlength: 2000 },
    handled: { type: Boolean, default: false },
  },
  { timestamps: true }
);

module.exports = mongoose.model('Inquiry', inquirySchema);
