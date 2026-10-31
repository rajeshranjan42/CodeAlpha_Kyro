const webpush = require('web-push');
const { PushSub } = require('./models');

const enabled = () => !!(process.env.VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY);
let ready = false;

// Sends a Web Push message to every device the user has enabled. Dead subscriptions are removed.
async function sendPush(userId, payload) {
  if (!enabled()) return 0;
  if (!ready) {
    webpush.setVapidDetails(process.env.VAPID_SUBJECT || 'mailto:admin@example.com', process.env.VAPID_PUBLIC_KEY, process.env.VAPID_PRIVATE_KEY);
    ready = true;
  }
  const subs = await PushSub.find({ user: userId });
  await Promise.all(subs.map(async (s) => {
    try {
      await webpush.sendNotification({ endpoint: s.endpoint, keys: { p256dh: s.keys.p256dh, auth: s.keys.auth } }, JSON.stringify(payload), { TTL: 3600 });
    } catch (e) {
      if (e.statusCode === 404 || e.statusCode === 410) await s.deleteOne();
      else console.error('push failed:', e.statusCode || e.message);
    }
  }));
  return subs.length;
}

module.exports = { sendPush, enabled };
