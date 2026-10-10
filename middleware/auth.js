const jwt = require('jsonwebtoken');
const User = require('../models/User');
const ApiError = require('../utils/ApiError');
const asyncHandler = require('../utils/asyncHandler');

exports.protect = asyncHandler(async (req, res, next) => {
  let token = req.cookies?.token;
  const header = req.headers.authorization;
  if (!token && header?.startsWith('Bearer ')) token = header.split(' ')[1];
  if (!token) throw new ApiError(401, 'Please log in to continue');

  let decoded;
  try {
    decoded = jwt.verify(token, process.env.JWT_SECRET);
  } catch {
    throw new ApiError(401, 'Session expired. Please log in again');
  }
  const user = await User.findById(decoded.id);
  if (!user) throw new ApiError(401, 'User no longer exists');
  if (!user.isActive) throw new ApiError(403, 'Your account has been disabled');
  req.user = user;
  next();
});

exports.authorize = (...roles) => (req, res, next) => {
  if (!req.user || !roles.includes(req.user.role)) {
    return next(new ApiError(403, 'You do not have permission to perform this action'));
  }
  next();
};
