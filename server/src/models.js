const mongoose = require('mongoose');
const { Schema, model } = mongoose;
const ref = (m, extra = {}) => ({ type: Schema.Types.ObjectId, ref: m, ...extra });

const User = model('User', new Schema({
  name: { type: String, required: true, trim: true },
  email: { type: String, required: true, unique: true, lowercase: true, trim: true },
  password: { type: String, required: true },
  verified: { type: Boolean, default: false },
  emailNotifications: { type: Boolean, default: false },
}, { timestamps: true }));

// One-time codes; MongoDB removes expired documents automatically (TTL index)
const Otp = model('Otp', new Schema({
  email: { type: String, required: true, unique: true },
  hash: String,
  attempts: { type: Number, default: 0 },
  lastSentAt: Date,
  expiresAt: { type: Date, index: { expires: 0 } },
}));

const Board = model('Board', new Schema({
  name: { type: String, required: true, trim: true },
  background: { type: String, default: '#0079bf' },
  owner: ref('User', { required: true }),
  members: [ref('User')],
  labels: [{ name: { type: String, default: '' }, color: String }],
}, { timestamps: true }));

const List = model('List', new Schema({
  board: ref('Board', { required: true, index: true }),
  title: { type: String, required: true, trim: true },
  position: { type: Number, default: 0 },
  archived: { type: Boolean, default: false },
}, { timestamps: true }));

const Card = model('Card', new Schema({
  board: ref('Board', { required: true, index: true }),
  list: ref('List', { required: true, index: true }),
  title: { type: String, required: true, trim: true },
  description: { type: String, default: '' },
  position: { type: Number, default: 0 },
  labels: [String], // ids of Board.labels
  members: [ref('User')],
  due: Date,
  dueDone: { type: Boolean, default: false },
  checklists: [{ title: String, items: [{ text: String, done: { type: Boolean, default: false } }] }],
  attachments: [{ name: String, url: String }],
  cover: { type: String, default: '' },
  archived: { type: Boolean, default: false },
  remindedSoon: { type: Boolean, default: false },
  remindedOverdue: { type: Boolean, default: false },
  createdBy: ref('User'),
}, { timestamps: true }));

const Comment = model('Comment', new Schema({
  card: ref('Card', { required: true, index: true }),
  board: ref('Board', { required: true }),
  author: ref('User', { required: true }),
  text: { type: String, required: true, trim: true },
}, { timestamps: true }));

const Notification = model('Notification', new Schema({
  user: ref('User', { required: true, index: true }),
  text: String,
  boardId: ref('Board'),
  cardId: ref('Card'),
  read: { type: Boolean, default: false },
}, { timestamps: true }));

const Activity = model('Activity', new Schema({
  board: ref('Board', { required: true, index: true }),
  text: String,
}, { timestamps: true }));

// One row per browser/phone that allowed device notifications
const PushSub = model('PushSub', new Schema({
  user: ref('User', { required: true, index: true }),
  endpoint: { type: String, required: true, unique: true },
  keys: { p256dh: String, auth: String },
}, { timestamps: true }));

module.exports = { PushSub, User, Otp, Board, List, Card, Comment, Notification, Activity };
