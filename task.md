# CodeAlpha_Kyro - TASK 3: Project Management Tool (Kyro, MERN, Trello-style)

Build a collaborative tool similar to Trello or Asana: group projects, assign tasks, comment inside tasks,
auth system, project boards, task cards, backend for users/projects/tasks/comments, plus WebSocket notifications.

## 1. Stack
MongoDB (Atlas) + Mongoose, Express, Node, JWT, bcrypt, Socket.IO, Gmail API (googleapis) for OTP mail, React 18 + Vite.

## 2. Features
**Auth:** register + email OTP verification, login + OTP (switch off with LOGIN_OTP=false), resend with 30s cooldown, 5 tries, 10 min expiry, hashed codes, demo account.
**Boards:** create with colour/gradient background, rename, invite/remove members, delete, archive viewer, activity feed.
**Lists:** add, rename, archive/restore, drag to reorder.
**Cards:** drag between and within lists, cover colour, labels (editable, coloured), members, due date with complete tick, description, multiple checklists with progress, link attachments, comments, copy, archive/restore, delete, move-to-list menu (works on touch).
**Search/filter:** text, label, member, due date.
**Real time (WebSocket):** card/list/board changes appear instantly; per-user notification push with toast + bell badge for assignment, comments, invites.
**UI:** Trello-like layout, responsive (mobile snap-scrolling lists, full-screen card), animations with reduced-motion support.

## 3. Data models
User, Otp (TTL), Board(labels[]), List(position), Card(list, position, labels[], members[], due, checklists[], attachments[], cover, archived), Comment, Notification, Activity.
Positions are floats: a dropped card gets the midpoint between its neighbours.

## 4. REST API (JWT except /auth)
- POST /auth/register, /auth/login, /auth/verify-otp, /auth/resend-otp, /auth/demo; GET /auth/me
- GET/POST /boards; GET/PUT/DELETE /boards/:id; POST /boards/:id/members; DELETE /boards/:id/members/:userId; GET /boards/:id/activity
- POST /boards/:id/lists; PUT /lists/:id
- POST /boards/:id/cards; PUT/DELETE /cards/:id; POST /cards/:id/copy
- GET/POST /cards/:id/comments
- GET /notifications; POST /notifications/read

## 5. Socket events
Client: `board:join`. Server to board room: `list:upsert`, `card:upsert`, `card:deleted`, `board:updated`, `board:deleted`, `comment:created`, `activity:new`. To user room: `notification`.

## 6. Milestones
1. Models + auth + OTP mailer  2. Board/list/card routes  3. Sockets + notifications  4. Board UI + drag/drop  5. Card modal  6. Responsive + animation pass  7. Test with two browsers
