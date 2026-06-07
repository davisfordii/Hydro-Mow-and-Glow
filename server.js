require('dotenv').config();
const express = require('express');
const nodemailer = require('nodemailer');
const path = require('path');

const app = express();
app.use(express.json());
app.use(express.static(path.join(__dirname)));

const PORT = process.env.PORT || 3000;

// ── Email transport (Gmail SMTP) ──────────────────────────────────────────────
const emailEnabled = process.env.EMAIL_USER && process.env.EMAIL_PASS && process.env.NOTIFY_EMAIL;
const transporter = emailEnabled
  ? nodemailer.createTransport({
      service: 'gmail',
      auth: { user: process.env.EMAIL_USER, pass: process.env.EMAIL_PASS },
    })
  : null;

// ── Twilio SMS (optional) ─────────────────────────────────────────────────────
const smsEnabled =
  process.env.TWILIO_ACCOUNT_SID &&
  process.env.TWILIO_AUTH_TOKEN &&
  process.env.TWILIO_FROM &&
  process.env.NOTIFY_PHONE;
const twilioClient = smsEnabled
  ? require('twilio')(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN)
  : null;

// ── Quote form endpoint ───────────────────────────────────────────────────────
app.post('/api/quote', async (req, res) => {
  const { firstName, lastName, phone, email, service, address, message } = req.body;

  if (!firstName || !lastName || !phone || !email || !service || !address) {
    return res.status(400).json({ error: 'Please fill out all required fields.' });
  }

  const summary = [
    `Name:    ${firstName} ${lastName}`,
    `Phone:   ${phone}`,
    `Email:   ${email}`,
    `Service: ${service}`,
    `Address: ${address}`,
    message ? `Message: ${message}` : null,
  ]
    .filter(Boolean)
    .join('\n');

  const errors = [];

  // Send email notification
  if (transporter) {
    try {
      await transporter.sendMail({
        from: `"Hydro Mow & Glow Website" <${process.env.EMAIL_USER}>`,
        to: process.env.NOTIFY_EMAIL,
        subject: `New Quote Request — ${firstName} ${lastName}`,
        text: `New quote request from your website:\n\n${summary}`,
        html: `<h2 style="color:#1a6fdb">New Quote Request</h2><pre style="font-size:15px;font-family:sans-serif;line-height:1.6">${summary}</pre>`,
      });
    } catch (err) {
      console.error('Email send failed:', err.message);
      errors.push('email');
    }
  }

  // Send SMS notification
  if (twilioClient) {
    try {
      await twilioClient.messages.create({
        body: `New quote!\n${firstName} ${lastName}\n${phone}\n${service}\n${address}`,
        from: process.env.TWILIO_FROM,
        to: process.env.NOTIFY_PHONE,
      });
    } catch (err) {
      console.error('SMS send failed:', err.message);
      errors.push('sms');
    }
  }

  if (!transporter && !twilioClient) {
    console.warn('No notification method configured — check your .env file.');
  }

  // Always return success to the customer; log errors server-side
  res.json({ success: true });
});

app.listen(PORT, () => {
  console.log(`Hydro Mow & Glow running at http://localhost:${PORT}`);
  if (!transporter && !twilioClient) {
    console.warn('  WARNING: No email or SMS credentials found in .env — notifications are disabled.');
  } else {
    if (transporter) console.log(`  Email notifications → ${process.env.NOTIFY_EMAIL}`);
    if (twilioClient) console.log(`  SMS notifications  → ${process.env.NOTIFY_PHONE}`);
  }
});
