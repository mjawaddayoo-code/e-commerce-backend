const router = require('express').Router();
const multer = require('multer');
const { protect, authorize } = require('../middleware/auth');
const { uploadImage } = require('../controllers/uploadController');
const ApiError = require('../utils/ApiError');

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (req, file, cb) =>
    ['image/jpeg', 'image/png', 'image/webp'].includes(file.mimetype)
      ? cb(null, true)
      : cb(new ApiError(400, 'Only JPG, PNG or WebP images are allowed')),
});

router.post('/', protect, authorize('admin', 'staff'), upload.single('image'), uploadImage);

module.exports = router;
