const { google } = require('googleapis');

const configured = () =>
  ['GMAIL_CLIENT_ID', 'GMAIL_CLIENT_SECRET', 'GMAIL_REFRESH_TOKEN', 'GMAIL_SENDER'].every((k) => process.env[k]);

// Sends an HTML email through the Gmail API (users.messages.send) using an OAuth2 refresh token.
async function sendMail(to, subject, html) {
  if (!configured()) {
    console.log(`\n[mail not configured] To: ${to}\nSubject: ${subject}\n${html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ')}\n`);
    return;
  }
  const auth = new google.auth.OAuth2(
    process.env.GMAIL_CLIENT_ID,
    process.env.GMAIL_CLIENT_SECRET,
    'https://developers.google.com/oauthplayground'
  );
  auth.setCredentials({ refresh_token: process.env.GMAIL_REFRESH_TOKEN });
  const gmail = google.gmail({ version: 'v1', auth });
  const message = [
    `From: Kyro <${process.env.GMAIL_SENDER}>`,
    `To: ${to}`,
    `Subject: =?UTF-8?B?${Buffer.from(subject).toString('base64')}?=`,
    'MIME-Version: 1.0',
    'Content-Type: text/html; charset=UTF-8',
    '',
    html,
  ].join('\r\n');
  await gmail.users.messages.send({ userId: 'me', requestBody: { raw: Buffer.from(message).toString('base64url') } });
}

module.exports = { sendMail, configured };
