/*
 * TabMail — Email Sender
 *
 * Sends chord sheet PDFs to the configured missionary recipient via
 * Mailgun SMTP. Also handles reply emails for the inbound email feature.
 *
 * Non-commercial, personal-use project. No bulk email, no marketing.
 */

const nodemailer = require('nodemailer');

let transporter = null;

function getTransporter() {
  if (transporter) return transporter;

  transporter = nodemailer.createTransport({
    host: 'smtp.mailgun.org',
    port: 587,
    secure: false,
    auth: {
      user: `postmaster@${process.env.MAILGUN_DOMAIN}`,
      pass: process.env.MAILGUN_API_KEY,
    },
  });

  return transporter;
}

async function sendTabEmail(pdfBuffer, songInfo) {
  const missionaryName = process.env.MISSIONARY_NAME || 'Friend';
  const missionaryEmail = process.env.MISSIONARY_EMAIL;

  if (!missionaryEmail) {
    throw new Error('MISSIONARY_EMAIL not configured');
  }

  const filename = `${songInfo.artist} - ${songInfo.title}.pdf`;

  const mailOptions = {
    from: `TabMail <noreply@${process.env.MAILGUN_DOMAIN || 'tabmail.xyz'}>`,
    to: missionaryEmail,
    subject: `New tab: ${songInfo.title} — ${songInfo.artist}`,
    text: `Hey ${missionaryName}! Someone sent you guitar chords for "${songInfo.title}" by ${songInfo.artist}.\n\nGrab your guitar and enjoy!`,
    html: `<p>Hey ${missionaryName}!</p><p>Someone sent you guitar chords for <strong>"${songInfo.title}"</strong> by <strong>${songInfo.artist}</strong>.</p><p>Grab your guitar and enjoy!</p><hr><p style="color:#999;font-size:12px;">Sent via TabMail — a non-commercial project for missionaries</p>`,
    attachments: [{
      filename,
      content: pdfBuffer,
      contentType: 'application/pdf',
    }],
  };

  return getTransporter().sendMail(mailOptions);
}

async function sendReplyEmail(to, subject, text) {
  const mailOptions = {
    from: `TabMail <noreply@${process.env.MAILGUN_DOMAIN || 'tabmail.xyz'}>`,
    to,
    subject,
    text,
  };

  return getTransporter().sendMail(mailOptions);
}

module.exports = { sendTabEmail, sendReplyEmail };
