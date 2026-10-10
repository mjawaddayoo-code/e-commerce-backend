const jwt = require('jsonwebtoken');

const sign = (id) =>
  jwt.sign({ id }, process.env.JWT_SECRET, { expiresIn: process.env.JWT_EXPIRES_IN || '7d' });

const cookieOptions = () => ({
  httpOnly: true,
  secure: process.env.NODE_ENV === 'production',
  sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'lax',
  maxAge: 7 * 24 * 60 * 60 * 1000,
});

exports.sendToken = (res, user, status = 200) => {
  res.cookie('token', sign(user._id), cookieOptions());
  res.status(status).json({ success: true, user });
};

exports.clearToken = (res) => {
  const { maxAge, ...opts } = cookieOptions();
  res.clearCookie('token', opts);
};
