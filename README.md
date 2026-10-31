# CodeAlpha_Kyro: Kyro (MERN, Trello-style)

## Run
1. `cd server && cp .env.example .env` (fill MONGO_URI, JWT_SECRET) then `npm i && npm run dev`
2. `cd client && npm i && npm run dev` and open http://localhost:5173

## Email OTP with the Gmail API
Without Gmail settings the OTP is printed in the server console (fine for development).
To send real emails:
1. Google Cloud Console: create a project, then APIs & Services > Library > enable **Gmail API**.
2. OAuth consent screen: type External, add your Gmail as a test user, add scope `https://www.googleapis.com/auth/gmail.send`.
3. Credentials > Create credentials > OAuth client ID > Web application. Add the redirect URI `https://developers.google.com/oauthplayground`. Copy the Client ID and Client secret.
4. Open https://developers.google.com/oauthplayground, click the gear icon, tick "Use your own OAuth credentials", paste the ID and secret. In Step 1 pick Gmail API v1 > `gmail.send`, authorize, then in Step 2 click "Exchange authorization code for tokens" and copy the **Refresh token**.
5. Put them in `server/.env`: `GMAIL_CLIENT_ID`, `GMAIL_CLIENT_SECRET`, `GMAIL_REFRESH_TOKEN`, `GMAIL_SENDER` (the Gmail address you authorized). Restart the server.

Note: while the consent screen is in "Testing" mode, Google expires refresh tokens after 7 days. Publish the app (In production) to avoid that.
Set `LOGIN_OTP=false` if you only want OTP at sign-up and not on every login.

## Device notifications (Web Push)
Notifications then appear in the phone/computer notification panel even when the site is closed.
1. In `server`, run `npx web-push generate-vapid-keys` and put the two keys in `.env` (`VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `VAPID_SUBJECT`). Restart the server.
2. Open the app, click the bell, then **Turn on device notifications** and allow the permission. Use **Send test** to check.
3. Phones need **HTTPS**. `localhost` works on the same computer only. To test on a phone, deploy, or use a tunnel (ngrok / Cloudflare Tunnel) for both client and server, then set `CLIENT_URL` (server) and `VITE_API_URL` (client).
4. iPhone (iOS 16.4+): Safari > Share > Add to Home Screen, open it from the Home Screen, then turn notifications on there.
# CodeAlpha_Kyro
