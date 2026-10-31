
require('dotenv').config();

const http = require('http');
const express = require('express');
const cors = require('cors');
const mongoose = require('mongoose');
const { Server } = require('socket.io');

const { verify, memberOf } = require('./auth');

// Initialize Express
const app = express();
const server = http.createServer(app);

// ==========================================
// CORS CONFIGURATION
// ==========================================

// Local development + production frontend URLs
const allowedOrigins = [
  'http://localhost:5173',
  ...(process.env.CLIENT_URL || '')
    .split(',')
    .map(url => url.trim().replace(/\/+$/, ''))
    .filter(Boolean)
];

// Express CORS configuration
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
    return callback(null, false);
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
  ]
};

// Apply CORS before API routes
app.use(cors(corsOptions));

// ==========================================
// SOCKET.IO CONFIGURATION
// ==========================================

const io = new Server(server, {
  cors: {
    origin: allowedOrigins,
    methods: ['GET', 'POST']
  }
});

// ==========================================
// EXPRESS MIDDLEWARE
// ==========================================

app.use(express.json({ limit: '200kb' }));

// Health check for Render
app.get('/health', (req, res) => {
  res.status(200).send('ok');
});

// API routes
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

mongoose.connect(process.env.MONGO_URI)
  .then(() => {

    server.listen(PORT, () => {
      console.log(`API + sockets running on port ${PORT}`);
      console.log('Allowed frontend origins:', allowedOrigins);
    });

  })
  .catch((error) => {
    console.error(
      'MongoDB connection failed:',
      error.message
    );

    process.exit(1);
  });
