const router = require('express').Router();
const c = require('../controllers/categoryController');
const { protect, authorize } = require('../middleware/auth');
const optionalAuth = require('../middleware/optionalAuth');
const { validate } = require('../middleware/validate');

router.get('/', optionalAuth, c.list);
router.post('/', protect, authorize('admin', 'staff'), validate(c.categorySchema), c.create);
router.put('/:id', protect, authorize('admin', 'staff'), validate(c.categoryUpdateSchema), c.update);
router.delete('/:id', protect, authorize('admin'), c.remove);

module.exports = router;
