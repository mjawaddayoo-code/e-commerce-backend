const router = require('express').Router();
const cart = require('../controllers/cartController');
const orders = require('../controllers/orderController');
const settings = require('../controllers/settingsController');
const account = require('../controllers/accountController');
const wishlist = require('../controllers/wishlistController');
const reviews = require('../controllers/reviewController');
const coupons = require('../controllers/couponController');
const contact = require('../controllers/contactController');
const { protect } = require('../middleware/auth');
const optionalAuth = require('../middleware/optionalAuth');
const { validate } = require('../middleware/validate');

router.get('/settings', settings.getPublic);
router.post('/contact', validate(contact.contactSchema), contact.create);

router.get('/cart', protect, cart.get);
router.put('/cart', protect, validate(cart.cartSchema), cart.save);
router.post('/coupons/validate', validate(coupons.validateSchema), coupons.validate);

router.post('/orders/quote', validate(orders.quoteSchema), orders.quote);
router.post('/orders', protect, validate(orders.createSchema), orders.create);
router.get('/orders/my', protect, orders.mine);
router.get('/orders/:id', protect, orders.getOne);

router.put('/account/profile', protect, validate(account.profileSchema), account.updateProfile);
router.put('/account/password', protect, validate(account.passwordSchema), account.changePassword);
router.put('/account/addresses', protect, validate(account.addressesSchema), account.saveAddresses);

router.get('/wishlist', protect, wishlist.get);
router.put('/wishlist/:productId', protect, wishlist.add);
router.delete('/wishlist/:productId', protect, wishlist.remove);

router.get('/products/:id/reviews', optionalAuth, reviews.list);
router.post('/products/:id/reviews', protect, validate(reviews.reviewSchema), reviews.create);

module.exports = router;
