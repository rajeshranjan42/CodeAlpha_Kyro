const jwt = require('jsonwebtoken');
const { Board } = require('./models');

const sign = (u) => jwt.sign({ id: u._id }, process.env.JWT_SECRET, { expiresIn: '7d' });
const verify = (t) => jwt.verify(t, process.env.JWT_SECRET);

function requireAuth(req, res, next) {
  try {
    const t = (req.headers.authorization || '').replace('Bearer ', '');
    req.userId = verify(t).id;
    next();
  } catch { res.status(401).json({ message: 'Please log in again' }); }
}

// Returns the board only if the user is a member
const memberOf = (boardId, userId) => Board.findOne({ _id: boardId, members: userId });

module.exports = { sign, verify, requireAuth, memberOf };
