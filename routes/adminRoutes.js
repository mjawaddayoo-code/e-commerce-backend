const router = require('express').Router();
const c = require('../controllers/adminController');
const { protect, authorize } = require('../middleware/auth');
const { validate } = require('../middleware/validate');
const reviews = require('../controllers/reviewController');
const coupons = require('../controllers/couponController');
const settings = require('../controllers/settingsController');
const contact = require('../controllers/contactController');

// Every route here requires a logged-in admin or staff member. Customers get 403.
router.use(protect, authorize('admin', 'staff'));

router.get('/dashboard', c.dashboard);
router.get('/reports/sales', c.salesReport);
router.get('/orders', c.orders);
router.put('/orders/:id/status', validate(c.statusSchema), c.updateOrderStatus);
router.get('/payments', c.payments);
router.put('/payments/:id/status', validate(c.paymentStatusSchema), c.updatePaymentStatus);
router.get('/customers', c.customers);
router.put('/customers/:id/status', authorize('admin'), validate(c.customerStatusSchema), c.setCustomerStatus);

router.get('/reviews', reviews.adminList);
router.put('/reviews/:id', validate(reviews.moderateSchema), reviews.moderate);
router.delete('/reviews/:id', authorize('admin'), reviews.remove);

router.get('/coupons', coupons.list);
router.post('/coupons', authorize('admin'), validate(coupons.couponSchema), coupons.create);
router.put('/coupons/:id', authorize('admin'), validate(coupons.couponUpdateSchema), coupons.update);
router.delete('/coupons/:id', authorize('admin'), coupons.remove);

router.get('/settings', settings.getPublic);
router.put('/settings', authorize('admin'), validate(settings.settingsSchema), settings.update);

router.get('/inquiries', contact.adminList);
router.put('/inquiries/:id', validate(contact.handledSchema), contact.markHandled);

module.exports = router;
