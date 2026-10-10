const { Server } = require('socket.io');
const cookie = require('cookie');
const jwt = require('jsonwebtoken');
const User = require('./models/User');

let io;

exports.init = (server) => {
  io = new Server(server, { cors: { origin: (process.env.CLIENT_ORIGIN || '').split(','), credentials: true } });

  // Authenticate from the same httpOnly cookie used by the REST API
  io.use(async (socket, next) => {
    try {
      const token = cookie.parse(socket.handshake.headers.cookie || '').token;
      const { id } = jwt.verify(token, process.env.JWT_SECRET);
      const user = await User.findById(id);
      if (!user || !user.isActive) return next(new Error('unauthorized'));
      socket.data.user = user;
      next();
    } catch { next(new Error('unauthorized')); }
  });

  io.on('connection', (socket) => {
    const u = socket.data.user;
    socket.join(`user:${u._id}`);
    if (['admin', 'staff'].includes(u.role)) socket.join('admins');
  });
};

exports.emitToUser = (userId, event, payload) => io?.to(`user:${userId}`).emit(event, payload);
exports.emitToAdmins = (event, payload) => io?.to('admins').emit(event, payload);
