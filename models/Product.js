const mongoose = require('mongoose');
const slugify = require('slugify');

const optionSchema = new mongoose.Schema({ label: { type: String, required: true }, priceDelta: { type: Number, default: 0 } }, { _id: false });
const variantSchema = new mongoose.Schema({ name: { type: String, required: true }, options: [optionSchema] }, { _id: false });
const extraSchema = new mongoose.Schema({ name: { type: String, required: true }, price: { type: Number, default: 0, min: 0 } });

const productSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    slug: { type: String, unique: true },
    description: { type: String, default: '' },
    category: { type: mongoose.Schema.Types.ObjectId, ref: 'Category', required: true, index: true },
    images: [{ url: String, publicId: String }],
    price: { type: Number, required: true, min: 0 },
    discountPrice: {
      type: Number,
      min: 0,
      validate: { validator(v) { return v == null || v < this.price; }, message: 'Discount price must be lower than price' },
    },
    offerExpiresAt: Date,
    stock: { type: Number, default: 0, min: 0 },
    lowStockThreshold: { type: Number, default: 5 },
    sku: { type: String, unique: true, sparse: true },
    ingredients: [String],
    variants: [variantSchema],
    extras: [extraSchema],
    prepTimeMinutes: { type: Number, default: 20 },
    rating: { type: Number, default: 0 },
    numReviews: { type: Number, default: 0 },
    soldCount: { type: Number, default: 0 },
    featured: { type: Boolean, default: false },
    isDeal: { type: Boolean, default: false },
    active: { type: Boolean, default: true },
  },
  { timestamps: true }
);

productSchema.index({ name: 'text', description: 'text' });
productSchema.index({ active: 1, price: 1 });
productSchema.index({ active: 1, createdAt: -1 });

productSchema.pre('validate', async function (next) {
  if (this.isModified('name') || !this.slug) {
    const base = slugify(this.name, { lower: true, strict: true });
    let slug = base, n = 1;
    while (await this.constructor.exists({ slug, _id: { $ne: this._id } })) slug = `${base}-${++n}`;
    this.slug = slug;
  }
  next();
});

productSchema.virtual('percentOff').get(function () {
  return this.discountPrice ? Math.round(((this.price - this.discountPrice) / this.price) * 100) : 0;
});
productSchema.virtual('inStock').get(function () { return this.stock > 0; });
productSchema.set('toJSON', {
  virtuals: true,
  transform: (doc, r) => {
    delete r.__v; delete r.id;
    if (r.offerExpiresAt && new Date(r.offerExpiresAt) < new Date()) { delete r.discountPrice; r.percentOff = 0; }
    return r;
  },
});

module.exports = mongoose.model('Product', productSchema);
