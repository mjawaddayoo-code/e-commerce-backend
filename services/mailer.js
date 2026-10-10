const nodemailer = require('nodemailer');

let transport;
const configured = () => process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS;

exports.sendMail = async ({ to, subject, text }) => {
  if (!configured()) {
    // Development fallback so the flow can be tested without an email account
    console.log(`\n[mail not configured] To: ${to}\nSubject: ${subject}\n${text}\n`);
    return;
  }
  transport ||= nodemailer.createTransport({
    host: process.env.SMTP_HOST, port: Number(process.env.SMTP_PORT) || 587,
    secure: Number(process.env.SMTP_PORT) === 465, auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
  });
  await transport.sendMail({ from: process.env.MAIL_FROM || process.env.SMTP_USER, to, subject, text });
};
