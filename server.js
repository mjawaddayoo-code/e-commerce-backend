require('dotenv').config();
const http = require('http');
const express = require('express');
const helmet = require('helmet');
const cors = require('cors');
const morgan = require('morgan');
const cookieParser = require('cookie-parser');
const mongoSanitize = require('express-mongo-sanitize');
const rateLimit = require('express-rate-limit');

const connectDB = require('./config/db');
const { notFound, errorHandler } = require('./middleware/error');
const { sanitizeBody } = require('./middleware/validate');

const app = express();
app.set('trust proxy', 1);

app.use(helmet());
app.use(cors({ origin: (process.env.CLIENT_ORIGIN || '').split(','), credentials: true }));
app.use(express.json({ limit: '1mb' }));
app.use(cookieParser());
app.use(mongoSanitize());
app.use(sanitizeBody);
if (process.env.NODE_ENV !== 'production') app.use(morgan('dev'));

app.use('/api', rateLimit({ windowMs: 15 * 60 * 1000, max: 600, standardHeaders: true, legacyHeaders: false }));

app.get('/api/health', (req, res) => res.json({ success: true, status: 'ok' }));
app.use('/api/auth', require('./routes/authRoutes'));
app.use('/api/categories', require('./routes/categoryRoutes'));
app.use('/api/products', require('./routes/productRoutes'));
app.use('/api/upload', require('./routes/uploadRoutes'));
app.use('/api/admin', require('./routes/adminRoutes'));
app.use('/api', require('./routes/storeRoutes'));

app.use(notFound);
app.use(errorHandler);

const PORT = process.env.PORT || 5000;
if (!process.env.JWT_SECRET) throw new Error('JWT_SECRET is not set');
connectDB()
  .then(() => {
    const server = http.createServer(app);
    require('./socket').init(server);
    server.listen(PORT, () => console.log(`API running on port ${PORT}`));
  })
  .catch((e) => { console.error(e.message); process.exit(1); });
