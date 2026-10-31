# CodeAlpha_Kyro

**Kyro** is a collaborative project management tool in the style of Trello. Teams create boards, organise work in lists and cards, assign people, and talk inside each card. Changes appear instantly for everyone, and notifications reach users in the app, in their device notification panel, and optionally by email.

Built for **CodeAlpha, Task 3: Project Management Tool** with the MERN stack.

## Features

**Accounts**
- Sign up and log in with email and password.
- Email OTP (6 digits) through the Gmail API at sign-up, and optionally at every login.
- OTP is hashed, expires in 10 minutes, allows 5 tries, and can be resent after 30 seconds.

**Boards, lists and cards**
- Create boards with a colour or gradient background; rename, delete, and change the background later.
- Invite members by email; the owner can remove them.
- Lists: add, rename, archive and restore, drag to reorder.
- Cards: drag between and within lists, cover colour, coloured labels (editable), members, due date with a "complete" tick, description, multiple checklists with progress, link attachments, comments, copy, archive and restore, delete.
- Search and filter by text, label, member and due date.
- Activity feed for each board.
- "In list" menu in the card, which also lets touch users move cards (drag and drop works with a mouse).

**Real time and notifications**
- Socket.IO keeps every open board in sync.
- Notifications are sent for: being added to a board or card, comments, `@mentions`, cards moved or archived, label changes, completed checklists, and due-soon or overdue cards.
- They appear as a bell list, an on-screen toast, a device notification (Web Push, works when the site is closed), and an optional email copy.

**Design**
- Trello-like layout, responsive for phones, animated, respects "reduce motion".
- Installable as an app (PWA) with an SVG logo and PNG icons.

## Tech stack

| Part | Technology |
|---|---|
| Database | MongoDB Atlas, Mongoose |
| Backend | Node.js, Express, JWT, bcryptjs |
| Real time | Socket.IO |
| Email OTP | Gmail API (`googleapis`) |
| Device notifications | Web Push (`web-push`), service worker |
| Frontend | React 18, Vite |

## Project structure

```
CodeAlpha_Kyro/
├── render.yaml            optional Render blueprint
├── server/
│   ├── .env.example
│   └── src/
│       ├── server.js      Express, CORS, Socket.IO, startup
│       ├── routes.js      REST API, notifications, reminders
│       ├── models.js      Mongoose models
│       ├── auth.js        JWT and board membership check
│       ├── mailer.js      Gmail API sender
│       └── push.js        Web Push sender
└── client/
    ├── index.html
    ├── public/            sw.js, manifest, logo.svg, icons
    └── src/
        ├── App.jsx        login, OTP, header, bell, toasts
        ├── Boards.jsx     board list page
        ├── Board.jsx      lists, cards, drag and drop, menu
        ├── CardModal.jsx  card details
        ├── Icons.jsx      SVG icons and avatar
        ├── push.js        device notification helpers
        ├── api.js         API helper and constants
        └── styles.css
```

## Run locally

You need Node.js 18 or newer and a free MongoDB Atlas cluster.

**1. Server**
```
cd server
copy .env.example .env      (macOS/Linux: cp .env.example .env)
```
Edit `.env` (see the table below), then:
```
npm install
npm run dev
```
When you see `API + sockets running on port 5000`, the server is ready.

**2. Client** (a second terminal)
```
cd client
npm install
npm run dev
```
Open http://localhost:5173.

If Gmail is not configured, sign-up codes are printed in the **server terminal** instead of being emailed.

## Environment variables (`server/.env`)

| Variable | Required | Meaning |
|---|---|---|
| `MONGO_URI` | Yes | Atlas connection string, with `/kyro` as the database name |
| `JWT_SECRET` | Yes | Long random text used to sign login tokens |
| `CLIENT_URL` | Yes | Frontend URL, no trailing slash (`http://localhost:5173` locally). Comma-separate several URLs if needed |
| `PORT` | No | Defaults to 5000 (Render sets it itself) |
| `LOGIN_OTP` | No | `false` to ask for OTP only at sign-up |
| `GMAIL_CLIENT_ID`, `GMAIL_CLIENT_SECRET`, `GMAIL_REFRESH_TOKEN`, `GMAIL_SENDER` | For real emails | Gmail API credentials |
| `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `VAPID_SUBJECT` | For device notifications | Web Push keys; subject is your own contact email as `mailto:you@example.com` |

Client variable (set at build time): `VITE_API_URL`, the backend URL, for example `https://your-api.onrender.com`. Locally it defaults to `http://localhost:5000`.

Never commit `.env` to git.

## Gmail API setup (email OTP)

1. In Google Cloud Console create a project and enable the **Gmail API**.
2. Configure the OAuth consent screen (External), add your Gmail as a test user, and add the scope `https://www.googleapis.com/auth/gmail.send`.
3. Create an OAuth client ID (Web application) with the redirect URI `https://developers.google.com/oauthplayground`. Copy the client ID and secret.
4. Open the OAuth Playground, click the gear icon, tick "Use your own OAuth credentials", and paste the ID and secret. Authorize `gmail.send`, then exchange the code for tokens and copy the **refresh token**.
5. Put the four `GMAIL_` values in `.env` and restart the server.

While the consent screen is in "Testing", Google expires refresh tokens after 7 days. Set the app to "In production" to avoid this.

## Device notifications (Web Push)

1. Run `npx web-push generate-vapid-keys` inside `server` and put both keys in `.env`, plus `VAPID_SUBJECT`.
2. Open the app, click the bell, choose **Turn on device notifications**, and allow the permission. **Send test** checks it.
3. Phones need **HTTPS**. `localhost` works on the same computer only. On iPhone (iOS 16.4 or newer) first use Share, then Add to Home Screen, and open the app from there.
4. A device notification is skipped while the app is open in front, because the toast already shows it.

## Deploy on Render

1. Push the project to GitHub (the `.gitignore` keeps `.env` and `node_modules` out).
2. In Atlas, Network Access, allow `0.0.0.0/0`.
3. **Backend**: New, Web Service. Root directory `server`, build `npm install`, start `npm start`, health check path `/health`. Add the environment variables above. Use the frontend URL for `CLIENT_URL` (add it after step 4).
4. **Frontend**: New, Static Site. Root directory `client`, build `npm install && npm run build`, publish directory `dist`, and set `VITE_API_URL` to the backend URL. Redeploy the frontend whenever `VITE_API_URL` changes.
5. Set `CLIENT_URL` on the backend to the frontend URL.

`render.yaml` can create both services at once (New, Blueprint); the secret values still have to be entered.

On Render's free plan the backend sleeps after about 15 minutes without traffic. The first request then takes up to a minute, live connections drop, and due-date reminders do not run while it sleeps.

## API overview

All routes are under `/api` and need `Authorization: Bearer <token>` except the auth routes.

| Area | Routes |
|---|---|
| Auth | `POST /auth/register`, `/auth/login`, `/auth/verify-otp`, `/auth/resend-otp`; `GET /auth/me`; `PUT /auth/prefs` |
| Boards | `GET/POST /boards`; `GET/PUT/DELETE /boards/:id`; `POST /boards/:id/members`; `DELETE /boards/:id/members/:userId`; `GET /boards/:id/activity` |
| Lists | `POST /boards/:id/lists`; `PUT /lists/:id` |
| Cards | `POST /boards/:id/cards`; `PUT/DELETE /cards/:id`; `POST /cards/:id/copy` |
| Comments | `GET/POST /cards/:id/comments` |
| Notifications | `GET /notifications`; `POST /notifications/read` |
| Push | `GET /push/key`; `POST /push/subscribe`, `/push/unsubscribe`, `/push/test` |

Health check: `GET /health`.

## Socket events

Client sends `board:join`. The server sends `list:upsert`, `card:upsert`, `card:deleted`, `board:updated`, `board:deleted`, `comment:created` and `activity:new` to everyone on the board, and `notification` to the one user.

## Known limits

- Drag and drop uses the mouse. On touch screens, change a card's list from the "in list" menu inside the card.
- Due dates are saved at 12:00 local time of whoever sets them.
- Attachments are links, not uploaded files.
- Reminders use a timer inside the server, so the server must be running.

## Security notes

Passwords and OTP codes are hashed. Every board, list, card and comment route checks that the user is a board member. Email content is HTML-escaped. Keep `.env` private and use a long random `JWT_SECRET`.
