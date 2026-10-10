const xss = require('xss');
const ApiError = require('../utils/ApiError');

// Recursively strip HTML/script from string inputs
const clean = (v) => {
  if (typeof v === 'string') return xss(v.trim());
  if (Array.isArray(v)) return v.map(clean);
  if (v && typeof v === 'object') return Object.fromEntries(Object.entries(v).map(([k, x]) => [k, /password/i.test(k) ? x : clean(x)]));
  return v;
};

exports.sanitizeBody = (req, res, next) => {
  if (req.body) req.body = clean(req.body);
  next();
};

exports.validate = (schema) => (req, res, next) => {
  const result = schema.safeParse(req.body);
  if (!result.success) {
    const details = result.error.issues.map((i) => ({ field: i.path.join('.'), message: i.message }));
    return next(new ApiError(400, details[0]?.message || 'Invalid input', details));
  }
  req.body = result.data;
  next();
};
