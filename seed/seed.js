// DEVELOPMENT ONLY. Run: npm run seed   (or npm run seed:destroy to wipe)
require('dotenv').config();
const mongoose = require('mongoose');
const User = require('../models/User');
const Category = require('../models/Category');
const Product = require('../models/Product');
const Coupon = require('../models/Coupon');
const Settings = require('../models/Settings');

const categories = ['Burgers', 'Pizza', 'BBQ', 'Chinese', 'Biryani', 'Karahi', 'Bakery', 'Cakes', 'Sweets', 'Ice Cream', 'Shakes', 'Drinks', 'Deals'];

// [name, category, price, discountPrice, description, ingredients, stock]
const products = [
  ['Chicken Burger', 'Burgers', 550, 450, 'Juicy grilled chicken patty with fresh lettuce and house sauce.', ['Chicken patty', 'Bun', 'Lettuce', 'Sauce'], 50],
  ['Zinger Burger', 'Burgers', 650, null, 'Crispy fried chicken fillet with mayo and crunchy lettuce.', ['Chicken fillet', 'Bun', 'Mayo', 'Lettuce'], 50],
  ['Chicken Pizza', 'Pizza', 1400, 1200, 'Hand-tossed pizza topped with seasoned chicken and mozzarella.', ['Dough', 'Chicken', 'Mozzarella', 'Tomato sauce'], 30],
  ['BBQ Pizza', 'Pizza', 1500, null, 'Smoky BBQ chicken pizza with onions and cheese.', ['Dough', 'BBQ chicken', 'Onion', 'Mozzarella'], 30],
  ['Chicken Biryani', 'Biryani', 450, null, 'Fragrant basmati rice layered with spiced chicken.', ['Basmati rice', 'Chicken', 'Spices', 'Fried onion'], 40],
  ['Chicken Karahi', 'Karahi', 1800, 1650, 'Traditional karahi cooked with tomatoes, ginger and green chilies.', ['Chicken', 'Tomato', 'Ginger', 'Green chili'], 25],
  ['Chicken Wings', 'BBQ', 600, null, 'Spicy fried wings served with garlic dip.', ['Chicken wings', 'Spices', 'Garlic dip'], 40],
  ['Chicken Roll', 'Chinese', 300, null, 'Crispy paratha roll filled with chicken tikka and chutney.', ['Paratha', 'Chicken tikka', 'Chutney'], 60],
  ['Club Sandwich', 'Bakery', 500, null, 'Triple-layer sandwich with chicken, egg and fresh vegetables.', ['Bread', 'Chicken', 'Egg', 'Veggies'], 40],
  ['Chocolate Cake', 'Cakes', 1800, 1600, 'Rich chocolate sponge with ganache frosting (1 lb).', ['Flour', 'Cocoa', 'Cream', 'Eggs'], 15],
  ['Fresh Cream Cake', 'Cakes', 1700, null, 'Soft vanilla sponge layered with fresh cream and fruit (1 lb).', ['Flour', 'Cream', 'Eggs', 'Fruit'], 15],
  ['Gulab Jamun', 'Sweets', 900, null, 'Soft milk dumplings in cardamom syrup, per kg.', ['Khoya', 'Sugar syrup', 'Cardamom'], 20],
  ['Kheer', 'Sweets', 350, null, 'Slow-cooked rice pudding with dry fruits.', ['Milk', 'Rice', 'Sugar', 'Dry fruits'], 30],
  ['Falooda', 'Ice Cream', 400, null, 'Rose falooda with vermicelli, basil seeds and ice cream.', ['Milk', 'Rose syrup', 'Vermicelli', 'Ice cream'], 30],
  ['Chocolate Shake', 'Shakes', 350, 300, 'Thick chocolate milkshake topped with cream.', ['Milk', 'Chocolate', 'Ice cream'], 50],
  ['Cold Drink (1.5L)', 'Drinks', 220, null, 'Chilled soft drink, 1.5 litre bottle.', [], 100],
  ['Family Deal', 'Deals', 2800, 2400, '2 zinger burgers, 1 small pizza, large fries and 1.5L drink.', ['2 Zinger burgers', 'Small pizza', 'Fries', '1.5L drink'], 20, true],
];

(async () => {
  await mongoose.connect(process.env.MONGO_URI);

  if (process.argv.includes('--destroy')) {
    await Promise.all([Product.deleteMany(), Category.deleteMany(), Coupon.deleteMany()]);
    console.log('Products, categories and coupons removed');
    return process.exit(0);
  }

  await Promise.all([Product.deleteMany(), Category.deleteMany()]);
  const cats = {};
  for (const [i, name] of categories.entries()) cats[name] = await Category.create({ name, sortOrder: i });

  for (const [name, cat, price, discountPrice, description, ingredients, stock, isDeal] of products) {
    await Product.create({
      name, description, ingredients, stock, price,
      discountPrice: discountPrice || undefined,
      category: cats[cat]._id,
      featured: !!discountPrice,
      isDeal: !!isDeal || cat === 'Deals',
    });
  }

  for (const c of [
    { code: 'WELCOME10', type: 'percentage', value: 10, minOrder: 500, maxDiscount: 300 },
    { code: 'SAVE20', type: 'percentage', value: 20, minOrder: 1500, maxDiscount: 500 },
    { code: 'FIRSTORDER', type: 'fixed', value: 150, minOrder: 800, usageLimit: 500 },
  ]) await Coupon.findOneAndUpdate({ code: c.code }, c, { upsert: true });

  await Settings.get();

  const email = (process.env.ADMIN_EMAIL || '').toLowerCase();
  if (email && process.env.ADMIN_PASSWORD && !(await User.exists({ email }))) {
    await User.create({ name: process.env.ADMIN_NAME || 'Admin', email, password: process.env.ADMIN_PASSWORD, role: 'admin' });
    console.log(`Admin created: ${email}`);
  }

  console.log(`Seeded ${categories.length} categories and ${products.length} products. Upload images from the admin panel.`);
  process.exit(0);
})().catch((e) => { console.error(e); process.exit(1); });
