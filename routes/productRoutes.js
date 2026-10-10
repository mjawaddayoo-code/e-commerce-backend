const router = require('express').Router();
const c = require('../controllers/productController');
const { protect, authorize } = require('../middleware/auth');
const optionalAuth = require('../middleware/optionalAuth');
const { validate } = require('../middleware/validate');

router.get('/', optionalAuth, c.list);
router.get('/:id', optionalAuth, c.getOne);
router.post('/', protect, authorize('admin', 'staff'), validate(c.productSchema), c.create);
router.put('/:id', protect, authorize('admin', 'staff'), validate(c.productUpdateSchema), c.update);
router.delete('/:id', protect, authorize('admin'), c.remove);

module.exports = router;
