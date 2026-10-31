
require('dotenv').config();

const http = require('http');
const express = require('express');
const cors = require('cors');
const mongoose = require('mongoose');
const { Server } = require('socket.io');

const { verify, memberOf } = require('./auth');

// ==========================================
// INITIALIZE EXPRESS AND HTTP SERVER
// ==========================================

const app = express();
const server = http.createServer(app);

// ==========================================
// CORS CONFIGURATION
// ==========================================

const productionOrigin = 'https://codealpha-kyro.onrender.com';

// Support both CLIENT_URL and CLIENT_URI
const configuredOrigins = (
  process.env.CLIENT_URL ||
  process.env.CLIENT_URI ||
  ''
)
  .split(',')
  .map(url => url.trim().replace(/\/+$/, ''))
  .filter(Boolean);

// Allowed frontend origins
const allowedOrigins = [
  'http://localhost:5173',
  productionOrigin,
  ...configuredOrigins
];

const corsOptions = {
  origin: (requestOrigin, callback) => {
    // Allow requests without an Origin header
    if (!requestOrigin) {
      return callback(null, true);
    }

    if (allowedOrigins.includes(requestOrigin)) {
      return callback(null, true);
    }

    console.error('Blocked by CORS:', requestOrigin);
    return callback(new Error('Not allowed by CORS'));
  },

  methods: [
    'GET',
    'POST',
    'PUT',
    'PATCH',
    'DELETE',
    'OPTIONS'
  ],

  allowedHeaders: [
    'Content-Type',
    'Authorization'
  ],

  credentials: true
};

// Apply CORS before API routes
app.use(cors(corsOptions));

// ==========================================
// SOCKET.IO CONFIGURATION
// ==========================================

const io = new Server(server, {
  cors: {
    origin: allowedOrigins,
    methods: ['GET', 'POST'],
    credentials: true
  }
});

// ==========================================
// EXPRESS MIDDLEWARE
// ==========================================

app.use(express.json({ limit: '200kb' }));

// ==========================================
// HEALTH CHECK
// ==========================================

app.get('/health', (req, res) => {
  res.status(200).send('ok');
});

// ==========================================
// API ROUTES
// ==========================================

app.use('/api', require('./routes')(io));

// ==========================================
// SOCKET.IO AUTHENTICATION
// ==========================================

io.use((socket, next) => {
  try {
    socket.userId = verify(
      socket.handshake.auth.token
    ).id;

    next();
  } catch (error) {
    next(new Error('unauthorized'));
  }
});

// ==========================================
// SOCKET.IO CONNECTION
// ==========================================

io.on('connection', (socket) => {

  // Personal notification room
  socket.join(`user:${socket.userId}`);

  // Join board room after membership verification
  socket.on('board:join', async (id) => {
    if (
      await memberOf(id, socket.userId).catch(() => null)
    ) {
      socket.join(`board:${id}`);
    }
  });

});

// ==========================================
// MONGODB CONNECTION + SERVER START
// ==========================================

const PORT = process.env.PORT || 5000;

console.log('CLIENT_URL:', process.env.CLIENT_URL);
console.log('CLIENT_URI:', process.env.CLIENT_URI);
console.log('Allowed frontend origins:', allowedOrigins);

mongoose.connect(process.env.MONGO_URI)
  .then(() => {

    server.listen(PORT, () => {
      console.log(`API + sockets running on port ${PORT}`);
    });

  })
  .catch((error) => {
    console.error(
      'MongoDB connection failed:',
      error.message
    );

    process.exit(1);
  });
