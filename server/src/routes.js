const express = require('express');
const bcrypt = require('bcryptjs');
const crypto = require('crypto');
const { PushSub, User, Otp, Board, List, Card, Comment, Notification, Activity } = require('./models');
const { sign, requireAuth, memberOf } = require('./auth');
const { sendMail, configured } = require('./mailer');
const { sendPush, enabled: pushEnabled } = require('./push');

const GAP = 65536;
const COLORS = ['#4bce97', '#f5cd47', '#fea362', '#f87168', '#9f8fef', '#579dff'];
const BG_OK = /^(#[0-9a-f]{6}|linear-gradient\([#0-9a-z ,%().-]+\))$/i;
const HEX = /^#[0-9a-f]{6}$/i;
const EMAIL_OK = /^[^\s@,;<>]+@[^\s@,;<>]+\.[^\s@,;<>]+$/;

const otpHtml = (code, why) => `<div style="font-family:Arial,sans-serif;max-width:420px;margin:auto;padding:24px;border:1px solid #dfe1e6;border-radius:8px">
<h2 style="margin:0 0 8px;color:#172b4d">Kyro</h2><p>Use this code to ${why}:</p>
<p style="font-size:32px;letter-spacing:8px;font-weight:700;color:#0c66e4;margin:16px 0">${code}</p>
<p style="color:#6b778c;font-size:13px">It expires in 10 minutes. If you did not request it, you can ignore this email.</p></div>`;

module.exports = (io) => {
  const r = express.Router();
  const wrap = (fn) => (req, res) => fn(req, res).catch((e) => res.status(400).json({ message: e.message }));
  const safe = (u) => ({ id: u._id, name: u.name, email: u.email });
  const emit = (bid, ev, data) => io.to(`board:${bid}`).emit(ev, data);
  const log = async (bid, uid, text) => {
    const u = await User.findById(uid);
    emit(bid, 'activity:new', await Activity.create({ board: bid, text: `${u.name} ${text}` }));
  };
  const notify = async (userId, text, boardId, cardId, actorId) => {
    if (!userId || String(userId) === String(actorId)) return;
    const n = await Notification.create({ user: userId, text, boardId, cardId });
    io.to(`user:${userId}`).emit('notification', n); // in-app, real time
    sendPush(userId, { title: 'Kyro', body: text, boardId, cardId, tag: String(n._id) }).catch(() => {}); // device notification panel
  };
  const getCard = async (id, uid) => {
    const c = await Card.findById(id);
    if (!c || !(await memberOf(c.board, uid))) throw new Error('Card not found');
    return c;
  };
  const createBoard = async (uid, name, background = '#0079bf') => {
    const b = await Board.create({ name, background, owner: uid, members: [uid], labels: COLORS.map((color) => ({ name: '', color })) });
    await List.insertMany(['To do', 'Doing', 'Done'].map((title, i) => ({ board: b._id, title, position: (i + 1) * GAP })));
    return b;
  };

  // ---------- OTP via Gmail API ----------
  const issueOtp = async (email, why) => {
    const prev = await Otp.findOne({ email });
    if (prev && Date.now() - prev.lastSentAt < 30000) throw new Error('Please wait 30 seconds before asking for another code');
    const code = String(crypto.randomInt(0, 1000000)).padStart(6, '0');
    await Otp.findOneAndUpdate({ email }, { hash: await bcrypt.hash(code, 8), attempts: 0, lastSentAt: new Date(), expiresAt: new Date(Date.now() + 10 * 60 * 1000) }, { upsert: true });
    await sendMail(email, `Your Kyro code: ${code}`, otpHtml(code, why));
  };
  const checkOtp = async (email, code) => {
    const o = await Otp.findOne({ email });
    if (!o || o.expiresAt < new Date()) throw new Error('This code has expired. Ask for a new one');
    if (o.attempts >= 5) throw new Error('Too many wrong tries. Ask for a new code');
    o.attempts += 1; await o.save();
    if (!(await bcrypt.compare(String(code || ''), o.hash))) throw new Error('That code is not correct');
    await o.deleteOne();
  };
  const sent = (res, email) => res.json({ otpSent: true, email, message: configured() ? 'We emailed you a 6-digit code.' : 'Gmail is not configured, so the code was printed in the server console.' });

  r.post('/auth/register', wrap(async (req, res) => {
    const name = String(req.body.name || '').trim();
    const email = String(req.body.email || '').trim().toLowerCase();
    const password = String(req.body.password || '');
    if (!name || !EMAIL_OK.test(email) || password.length < 6) throw new Error('Enter your name, a valid email and a password of 6+ characters');
    const existing = await User.findOne({ email });
    if (existing && existing.verified) throw new Error('This email is already registered. Log in instead');
    const hash = await bcrypt.hash(password, 10);
    if (existing) { existing.name = name; existing.password = hash; await existing.save(); }
    else await User.create({ name, email, password: hash });
    await issueOtp(email, 'verify your email');
    sent(res, email);
  }));
  r.post('/auth/login', wrap(async (req, res) => {
    const email = String(req.body.email || '').trim().toLowerCase();
    const u = await User.findOne({ email });
    if (!u || !(await bcrypt.compare(String(req.body.password || ''), u.password))) throw new Error('Wrong email or password');
    if (!u.verified || process.env.LOGIN_OTP !== 'false') { await issueOtp(email, 'log in'); return sent(res, email); }
    res.json({ token: sign(u), user: safe(u) });
  }));
  r.post('/auth/verify-otp', wrap(async (req, res) => {
    const email = String(req.body.email || '').trim().toLowerCase();
    const u = await User.findOne({ email });
    if (!u) throw new Error('Account not found');
    await checkOtp(email, req.body.otp);
    if (!u.verified) { u.verified = true; await u.save(); }
    res.json({ token: sign(u), user: safe(u) });
  }));
  r.post('/auth/resend-otp', wrap(async (req, res) => {
    const email = String(req.body.email || '').trim().toLowerCase();
    if (await User.findOne({ email })) await issueOtp(email, 'continue');
    res.json({ ok: true });
  }));
  r.get('/auth/me', requireAuth, wrap(async (req, res) => res.json(safe(await User.findById(req.userId)))));

  r.use(requireAuth);

  // ---------- Boards ----------
  r.get('/boards', wrap(async (req, res) => res.json(await Board.find({ members: req.userId }).sort('-createdAt'))));
  r.post('/boards', wrap(async (req, res) => {
    const name = String(req.body.name || '').trim().slice(0, 100);
    if (!name) throw new Error('Board title is required');
    res.json(await createBoard(req.userId, name, BG_OK.test(req.body.background || '') ? req.body.background : undefined));
  }));
  r.get('/boards/:id', wrap(async (req, res) => {
    const b = await memberOf(req.params.id, req.userId);
    if (!b) return res.status(404).json({ message: 'Board not found' });
    await b.populate('members', 'name email');
    const [lists, cards] = await Promise.all([List.find({ board: b._id }).sort('position'), Card.find({ board: b._id }).sort('position')]);
    res.json({ board: b, lists, cards });
  }));
  r.put('/boards/:id', wrap(async (req, res) => {
    const b = await memberOf(req.params.id, req.userId);
    if (!b) throw new Error('Board not found');
    if (req.body.name) b.name = String(req.body.name).trim().slice(0, 100) || b.name;
    if (BG_OK.test(req.body.background || '')) b.background = req.body.background;
    if (Array.isArray(req.body.labels)) {
      b.labels = req.body.labels.slice(0, 30).map((l) => ({
        ...(l._id ? { _id: l._id } : {}), name: String(l.name || '').slice(0, 40), color: HEX.test(l.color || '') ? l.color : COLORS[0],
      }));
    }
    await b.save();
    emit(b._id, 'board:updated', { _id: b._id });
    res.json(b);
  }));
  r.delete('/boards/:id', wrap(async (req, res) => {
    const b = await Board.findOne({ _id: req.params.id, owner: req.userId });
    if (!b) throw new Error('Only the board owner can delete it');
    await Promise.all([List.deleteMany({ board: b._id }), Card.deleteMany({ board: b._id }), Comment.deleteMany({ board: b._id }), Activity.deleteMany({ board: b._id }), b.deleteOne()]);
    emit(b._id, 'board:deleted', { _id: b._id });
    res.json({ ok: true });
  }));
  r.post('/boards/:id/members', wrap(async (req, res) => {
    const b = await memberOf(req.params.id, req.userId);
    if (!b) throw new Error('Board not found');
    const u = await User.findOne({ email: String(req.body.email || '').trim().toLowerCase() });
    if (!u) throw new Error('No user with that email. Ask them to sign up first');
    if (!b.members.some((m) => String(m) === String(u._id))) b.members.push(u._id);
    await b.save();
    await notify(u._id, `You were added to the board "${b.name}"`, b._id, null, req.userId);
    emit(b._id, 'board:updated', { _id: b._id });
    await log(b._id, req.userId, `added ${u.name} to the board`);
    res.json({ ok: true });
  }));
  r.delete('/boards/:id/members/:userId', wrap(async (req, res) => {
    const b = await Board.findOne({ _id: req.params.id, owner: req.userId });
    if (!b) throw new Error('Only the board owner can remove members');
    if (String(b.owner) === req.params.userId) throw new Error('The owner cannot be removed');
    b.members = b.members.filter((m) => String(m) !== req.params.userId);
    await b.save();
    await Card.updateMany({ board: b._id }, { $pull: { members: req.params.userId } });
    io.in(`user:${req.params.userId}`).socketsLeave(`board:${b._id}`);
    emit(b._id, 'board:updated', { _id: b._id });
    res.json({ ok: true });
  }));
  r.get('/boards/:id/activity', wrap(async (req, res) => {
    if (!(await memberOf(req.params.id, req.userId))) throw new Error('Board not found');
    res.json(await Activity.find({ board: req.params.id }).sort('-createdAt').limit(40));
  }));

  // ---------- Lists ----------
  r.post('/boards/:id/lists', wrap(async (req, res) => {
    const b = await memberOf(req.params.id, req.userId);
    if (!b) throw new Error('Board not found');
    const title = String(req.body.title || '').trim().slice(0, 100);
    if (!title) throw new Error('List title is required');
    const last = await List.findOne({ board: b._id, archived: false }).sort('-position');
    const l = await List.create({ board: b._id, title, position: (last ? last.position : 0) + GAP });
    emit(b._id, 'list:upsert', l);
    await log(b._id, req.userId, `added the list "${title}"`);
    res.json(l);
  }));
  r.put('/lists/:id', wrap(async (req, res) => {
    const l = await List.findById(req.params.id);
    if (!l || !(await memberOf(l.board, req.userId))) throw new Error('List not found');
    if (String(req.body.title || '').trim()) l.title = String(req.body.title).trim().slice(0, 100);
    if (typeof req.body.position === 'number' && isFinite(req.body.position)) l.position = req.body.position;
    if (typeof req.body.archived === 'boolean') l.archived = req.body.archived;
    await l.save();
    emit(l.board, 'list:upsert', l);
    if (typeof req.body.archived === 'boolean') await log(l.board, req.userId, `${l.archived ? 'archived' : 'restored'} the list "${l.title}"`);
    res.json(l);
  }));

  // ---------- Cards ----------
  r.post('/boards/:id/cards', wrap(async (req, res) => {
    const b = await memberOf(req.params.id, req.userId);
    if (!b) throw new Error('Board not found');
    const l = await List.findOne({ _id: req.body.list, board: b._id });
    const title = String(req.body.title || '').trim().slice(0, 300);
    if (!l || !title) throw new Error('Card title is required');
    const last = await Card.findOne({ list: l._id, archived: false }).sort('-position');
    const c = await Card.create({ board: b._id, list: l._id, title, position: (last ? last.position : 0) + GAP, createdBy: req.userId });
    emit(b._id, 'card:upsert', c);
    await log(b._id, req.userId, `added "${title}" to ${l.title}`);
    res.json(c);
  }));
  r.put('/cards/:id', wrap(async (req, res) => {
    const c = await getCard(req.params.id, req.userId);
    const b = req.body, prevMembers = c.members.map(String), prevList = String(c.list);
    if (typeof b.title === 'string' && b.title.trim()) c.title = b.title.trim().slice(0, 300);
    if (typeof b.description === 'string') c.description = b.description.slice(0, 10000);
    if (b.list) {
      const l = await List.findOne({ _id: b.list, board: c.board });
      if (!l) throw new Error('List not found');
      c.list = l._id;
    }
    if (typeof b.position === 'number' && isFinite(b.position)) c.position = b.position;
    if (Array.isArray(b.labels)) c.labels = b.labels.map(String).slice(0, 30);
    if (Array.isArray(b.members)) {
      const board = await Board.findById(c.board);
      c.members = b.members.filter((id) => board.members.some((m) => String(m) === String(id)));
    }
    if ('due' in b) c.due = b.due ? new Date(b.due) : undefined;
    if (typeof b.dueDone === 'boolean') c.dueDone = b.dueDone;
    if (Array.isArray(b.checklists)) {
      c.checklists = b.checklists.slice(0, 20).map((cl) => ({
        title: String(cl.title || 'Checklist').slice(0, 100),
        items: (cl.items || []).slice(0, 100).filter((i) => i.text).map((i) => ({ text: String(i.text).slice(0, 300), done: !!i.done })),
      }));
    }
    if (Array.isArray(b.attachments)) {
      c.attachments = b.attachments.filter((a) => /^https?:\/\//i.test(a.url || '')).slice(0, 30)
        .map((a) => ({ name: String(a.name || a.url).slice(0, 120), url: String(a.url).slice(0, 1000) }));
    }
    if ('cover' in b) c.cover = HEX.test(b.cover || '') ? b.cover : '';
    if (typeof b.archived === 'boolean') c.archived = b.archived;
    await c.save();
    emit(c.board, 'card:upsert', c);
    res.json(c);
    // side effects after responding
    if (String(c.list) !== prevList) { const l = await List.findById(c.list); await log(c.board, req.userId, `moved "${c.title}" to ${l.title}`); }
    if (typeof b.archived === 'boolean') await log(c.board, req.userId, `${c.archived ? 'archived' : 'restored'} "${c.title}"`);
    for (const m of c.members.map(String).filter((id) => !prevMembers.includes(id))) {
      await notify(m, `You were added to the card "${c.title}"`, c.board, c._id, req.userId);
    }
  }));
  r.post('/cards/:id/copy', wrap(async (req, res) => {
    const src = await getCard(req.params.id, req.userId);
    const next = await Card.findOne({ list: src.list, archived: false, position: { $gt: src.position } }).sort('position');
    const obj = src.toObject();
    ['_id', 'createdAt', 'updatedAt', '__v'].forEach((k) => delete obj[k]);
    const c = await Card.create({ ...obj, title: `${src.title} (copy)`, position: next ? (src.position + next.position) / 2 : src.position + GAP, createdBy: req.userId });
    emit(c.board, 'card:upsert', c);
    res.json(c);
  }));
  r.delete('/cards/:id', wrap(async (req, res) => {
    const c = await getCard(req.params.id, req.userId);
    await Promise.all([c.deleteOne(), Comment.deleteMany({ card: c._id })]);
    emit(c.board, 'card:deleted', { _id: c._id });
    await log(c.board, req.userId, `deleted the card "${c.title}"`);
    res.json({ ok: true });
  }));

  // ---------- Comments ----------
  r.get('/cards/:id/comments', wrap(async (req, res) => {
    const c = await getCard(req.params.id, req.userId);
    res.json(await Comment.find({ card: c._id }).populate('author', 'name').sort('createdAt'));
  }));
  r.post('/cards/:id/comments', wrap(async (req, res) => {
    const c = await getCard(req.params.id, req.userId);
    const text = String(req.body.text || '').trim().slice(0, 5000);
    if (!text) throw new Error('Write a comment first');
    const cm = await Comment.create({ card: c._id, board: c.board, author: req.userId, text });
    await cm.populate('author', 'name');
    emit(c.board, 'comment:created', cm);
    const me = await User.findById(req.userId);
    for (const m of new Set([...c.members.map(String), String(c.createdBy)])) {
      await notify(m, `${me.name} commented on "${c.title}"`, c.board, c._id, req.userId);
    }
    await log(c.board, req.userId, `commented on "${c.title}"`);
    res.json(cm);
  }));

  // ---------- Notifications ----------
  r.get('/notifications', wrap(async (req, res) => res.json(await Notification.find({ user: req.userId }).sort('-createdAt').limit(30))));
  r.post('/notifications/read', wrap(async (req, res) => {
    await Notification.updateMany({ user: req.userId, read: false }, { read: true });
    res.json({ ok: true });
  }));

  // ---------- Device push subscriptions ----------
  r.get('/push/key', wrap(async (req, res) => res.json({ key: pushEnabled() ? process.env.VAPID_PUBLIC_KEY : null })));
  r.post('/push/subscribe', wrap(async (req, res) => {
    const s = req.body.subscription || {};
    if (!/^https:\/\//.test(s.endpoint || '') || !s.keys?.p256dh || !s.keys?.auth) throw new Error('Invalid subscription');
    await PushSub.findOneAndUpdate({ endpoint: s.endpoint }, { user: req.userId, keys: { p256dh: s.keys.p256dh, auth: s.keys.auth } }, { upsert: true });
    res.json({ ok: true });
  }));
  r.post('/push/unsubscribe', wrap(async (req, res) => {
    await PushSub.deleteOne({ endpoint: String(req.body.endpoint || ''), user: req.userId });
    res.json({ ok: true });
  }));
  r.post('/push/test', wrap(async (req, res) => {
    if (!pushEnabled()) throw new Error('Push is not set up on the server. Add the VAPID keys to server/.env');
    const n = await sendPush(req.userId, { title: 'Kyro', body: 'Device notifications are working.', force: true });
    if (!n) throw new Error('No device is subscribed yet');
    res.json({ ok: true });
  }));

  return r;
};