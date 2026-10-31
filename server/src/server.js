require('dotenv').config();
const http = require('http');
const express = require('express');
const cors = require('cors');
const mongoose = require('mongoose');
const { Server } = require('socket.io');
const { verify, memberOf } = require('./auth');

const app = express();
const server = http.createServer(app);
const origin = process.env.CLIENT_URL || 'http://localhost:5173';
const io = new Server(server, { cors: { origin } });

app.use(cors({ origin }));
app.use(express.json({ limit: '200kb' }));
app.get('/health', (req, res) => res.send('ok')); // used by Render health checks
app.use('/api', require('./routes')(io));

io.use((socket, next) => {
  try { socket.userId = verify(socket.handshake.auth.token).id; next(); }
  catch { next(new Error('unauthorized')); }
});
io.on('connection', (socket) => {
  socket.join(`user:${socket.userId}`); // personal room for notifications
  socket.on('board:join', async (id) => {
    if (await memberOf(id, socket.userId).catch(() => null)) socket.join(`board:${id}`);
  });
});

mongoose.connect(process.env.MONGO_URI).then(() => {
  const port = process.env.PORT || 5000;
  server.listen(port, () => console.log(`API + sockets on :${port}`));
}).catch((e) => { console.error('MongoDB connection failed:', e.message); process.exit(1); });