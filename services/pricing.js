const Product = require('../models/Product');
const Coupon = require('../models/Coupon');
const Settings = require('../models/Settings');
const ApiError = require('../utils/ApiError');

// Single source of truth for prices. The frontend never sends prices or discounts.
async function priceCart(rawItems, couponCode, area) {
  if (!rawItems?.length) throw new ApiError(400, 'Your cart is empty');
  const settings = await Settings.get();
  const products = await Product.find({ _id: { $in: rawItems.map((i) => i.product) }, active: true });
  const byId = Object.fromEntries(products.map((p) => [String(p._id), p]));

  const items = rawItems.map((raw) => {
    const p = byId[String(raw.product)];
    if (!p) throw new ApiError(400, 'An item in your cart is no longer available');
    const qty = Math.min(Math.max(parseInt(raw.quantity) || 1, 1), 50);
    if (p.stock < qty) throw new ApiError(400, `Only ${p.stock} of "${p.name}" left in stock`);

    const offerLive = p.discountPrice && (!p.offerExpiresAt || p.offerExpiresAt > new Date());
    let unit = offerLive ? p.discountPrice : p.price;

    const variants = (raw.variants || []).map((v) => {
      const group = p.variants.find((g) => g.name === v.name);
      const opt = group?.options.find((o) => o.label === v.label);
      if (!opt) throw new ApiError(400, `Invalid option for "${p.name}"`);
      unit += opt.priceDelta || 0;
      return { name: v.name, label: v.label, priceDelta: opt.priceDelta || 0 };
    });
    const extras = (raw.extras || []).map((name) => {
      const e = p.extras.find((x) => x.name === name);
      if (!e) throw new ApiError(400, `Invalid extra for "${p.name}"`);
      unit += e.price;
      return { name: e.name, price: e.price };
    });

    return {
      product: p._id, name: p.name, image: p.images?.[0]?.url, unitPrice: unit,
      quantity: qty, variants, extras, lineTotal: unit * qty,
    };
  });

  const subtotal = items.reduce((s, i) => s + i.lineTotal, 0);
  let baseFee = settings.deliveryFee;
  const areas = (settings.deliveryAreas || []).filter((a) => a.active !== false);
  if (areas.length && area) {
    const match = areas.find((a) => a.name.trim().toLowerCase() === String(area).trim().toLowerCase());
    if (!match) throw new ApiError(400, 'Sorry, we do not deliver to that area yet');
    baseFee = match.fee;
  }
  const deliveryFee = subtotal >= settings.freeDeliveryThreshold ? 0 : baseFee;

  let discount = 0, coupon = null;
  if (couponCode) {
    coupon = await validateCoupon(couponCode, subtotal);
    discount = coupon.type === 'percentage' ? Math.round((subtotal * coupon.value) / 100) : coupon.value;
    if (coupon.maxDiscount) discount = Math.min(discount, coupon.maxDiscount);
    discount = Math.min(discount, subtotal);
  }
  const tax = Math.round(((subtotal - discount) * (settings.taxPercent || 0)) / 100);
  const total = subtotal - discount + deliveryFee + tax;
  return { items, subtotal, deliveryFee, discount, tax, total, coupon, settings };
}

async function validateCoupon(code, subtotal) {
  const c = await Coupon.findOne({ code: String(code).toUpperCase().trim(), active: true });
  if (!c) throw new ApiError(400, 'Invalid coupon code');
  if (c.expiresAt && c.expiresAt < new Date()) throw new ApiError(400, 'This coupon has expired');
  if (c.usageLimit && c.usedCount >= c.usageLimit) throw new ApiError(400, 'This coupon has reached its usage limit');
  if (subtotal < c.minOrder) throw new ApiError(400, `Minimum order for this coupon is Rs. ${c.minOrder}`);
  return c;
}

module.exports = { priceCart };
