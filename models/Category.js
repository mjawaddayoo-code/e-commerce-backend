const mongoose = require('mongoose');
const slugify = require('slugify');

const categorySchema = new mongoose.Schema(
  {
    name: { type: String, required: true, unique: true, trim: true },
    slug: { type: String, unique: true },
    description: String,
    image: { url: String, publicId: String },
    sortOrder: { type: Number, default: 0 },
    active: { type: Boolean, default: true },
  },
  { timestamps: true }
);

categorySchema.pre('validate', function (next) {
  if (this.isModified('name') || !this.slug) this.slug = slugify(this.name, { lower: true, strict: true });
  next();
});

module.exports = mongoose.model('Category', categorySchema);
