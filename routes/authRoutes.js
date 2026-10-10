const router = require('express').Router();
const rateLimit = require('express-rate-limit');
const strict = rateLimit({ windowMs: 15 * 60 * 1000, max: 20, skipSuccessfulRequests: true, message: { success: false, message: 'Too many attempts. Try again in a few minutes.' } });
const c = require('../controllers/authController');
const { protect } = require('../middleware/auth');
const { validate } = require('../middleware/validate');

router.post('/register', strict, validate(c.registerSchema), c.register);
router.post('/login', strict, validate(c.loginSchema), c.login);
router.post('/admin/login', strict, validate(c.loginSchema), c.adminLogin);
router.post('/forgot-password', strict, validate(c.forgotSchema), c.forgotPassword);
router.post('/reset-password', strict, validate(c.resetSchema), c.resetPassword);
router.post('/logout', c.logout);
router.get('/me', protect, c.me);

module.exports = router;
