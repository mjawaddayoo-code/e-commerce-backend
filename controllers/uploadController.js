const cloudinary = require('../config/cloudinary');
const ApiError = require('../utils/ApiError');
const asyncHandler = require('../utils/asyncHandler');

exports.uploadImage = asyncHandler(async (req, res) => {
  if (!req.file) throw new ApiError(400, 'No image provided');
  const folder = ['products', 'categories', 'offers', 'branding'].includes(req.body.folder) ? req.body.folder : 'misc';
  const result = await new Promise((resolve, reject) => {
    cloudinary.uploader
      .upload_stream({ folder: `food-app/${folder}`, resource_type: 'image' }, (err, r) => (err ? reject(err) : resolve(r)))
      .end(req.file.buffer);
  });
  res.status(201).json({ success: true, image: { url: result.secure_url, publicId: result.public_id } });
});
