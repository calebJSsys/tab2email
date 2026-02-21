/*
 * TabMail — Email Sender
 *
 * Sends chord sheet PDFs to the configured missionary recipient via
 * Mailgun HTTP API. Also handles reply emails for the inbound email feature.
 *
 * Non-commercial, personal-use project. No bulk email, no marketing.
 */

const axios = require('axios');

async function sendTabEmail(pdfBuffer, songInfo) {
  const missionaryName = process.env.MISSIONARY_NAME || 'Friend';
  const missionaryEmail = process.env.MISSIONARY_EMAIL;

  if (!missionaryEmail) {
    throw new Error('MISSIONARY_EMAIL not configured');
  }

  const domain = process.env.MAILGUN_DOMAIN;
  const apiKey = process.env.MAILGUN_API_KEY;
  const filename = `${songInfo.artist} - ${songInfo.title}.pdf`;

  const FormData = require('form-data');
  const form = new FormData();
  form.append('from', `TabMail <postmaster@${domain}>`);
  form.append('to', missionaryEmail);
  form.append('subject', `New tab: ${songInfo.title} — ${songInfo.artist}`);
  form.append('text', `Hey ${missionaryName}! Someone sent you guitar chords for "${songInfo.title}" by ${songInfo.artist}.\n\nGrab your guitar and enjoy!`);
  form.append('html', `<p>Hey ${missionaryName}!</p><p>Someone sent you guitar chords for <strong>"${songInfo.title}"</strong> by <strong>${songInfo.artist}</strong>.</p><p>Grab your guitar and enjoy!</p><hr><p style="color:#999;font-size:12px;">Sent via TabMail — a non-commercial project for missionaries</p>`);
  form.append('attachment', pdfBuffer, { filename, contentType: 'application/pdf' });

  const res = await axios.post(
    `https://api.mailgun.net/v3/${domain}/messages`,
    form,
    {
      auth: { username: 'api', password: apiKey },
      headers: form.getHeaders(),
      timeout: 30000,
    }
  );

  return res.data;
}

async function sendReplyEmail(to, subject, text, attachment) {
  const domain = process.env.MAILGUN_DOMAIN;
  const apiKey = process.env.MAILGUN_API_KEY;

  const FormData = require('form-data');
  const form = new FormData();
  form.append('from', `TabMail <postmaster@${domain}>`);
  form.append('to', to);
  form.append('subject', subject);
  form.append('text', text);

  if (attachment) {
    form.append('attachment', attachment.content, {
      filename: attachment.filename,
      contentType: 'application/pdf',
    });
  }

  const res = await axios.post(
    `https://api.mailgun.net/v3/${domain}/messages`,
    form,
    {
      auth: { username: 'api', password: apiKey },
      headers: form.getHeaders(),
      timeout: 30000,
    }
  );

  return res.data;
}

module.exports = { sendTabEmail, sendReplyEmail };
