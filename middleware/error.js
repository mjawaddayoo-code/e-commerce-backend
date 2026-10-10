exports.notFound = (req, res) => {
  res.status(404).json({ success: false, message: `Route not found: ${req.method} ${req.originalUrl}` });
};

exports.errorHandler = (err, req, res, next) => {
  let status = err.status || 500;
  let message = err.message || 'Something went wrong. Please try again.';
  let details = err.details;

  if (err.name === 'CastError') { status = 400; message = 'Invalid ID'; }
  if (err.name === 'ValidationError') {
    status = 400;
    details = Object.values(err.errors).map((e) => ({ field: e.path, message: e.message }));
    message = details[0].message;
  }
  if (err.code === 11000) {
    status = 409;
    const field = Object.keys(err.keyValue || {})[0] || 'value';
    message = `That ${field} is already in use`;
  }
  if (status === 500) {
    console.error(err);
    if (process.env.NODE_ENV === 'production') message = 'Something went wrong. Please try again.';
  }

  res.status(status).json({
    success: false,
    message,
    ...(details && { details }),
    ...(process.env.NODE_ENV !== 'production' && status === 500 && { stack: err.stack }),
  });
};
