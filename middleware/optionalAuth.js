const jwt = require('jsonwebtoken');
const User = require('../models/User');

// Attaches req.user when a valid token exists, never blocks the request.
module.exports = async (req, res, next) => {
  try {
    const token = req.cookies?.token || (req.headers.authorization || '').replace('Bearer ', '');
    if (token) {
      const { id } = jwt.verify(token, process.env.JWT_SECRET);
      const user = await User.findById(id);
      if (user?.isActive) req.user = user;
    }
  } catch { /* anonymous */ }
  next();
};
