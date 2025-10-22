// mail.js
require('dotenv').config();
const express = require('express');
const router = express.Router();
const nodemailer = require('nodemailer');

const { GMAIL_USER, GMAIL_APP_PASSWORD } = process.env;

const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: GMAIL_USER,
    pass: GMAIL_APP_PASSWORD,
  },
});

router.post('/send-otp', async (req, res) => {
  const { email, otp } = req.body;

  if (!email || !otp) {
    return res.status(400).json({ error: 'Thiếu email hoặc mã OTP' });
  }

  const mailOptions = {
    from: GMAIL_USER,
    to: email,
    subject: 'Mã xác minh tài khoản',
    text: `Mã xác minh của bạn là: ${otp}\nMã có hiệu lực trong 5 phút.`,
  };

  try {
    await transporter.sendMail(mailOptions);
    console.log(`✅ Gửi OTP đến ${email}`);
    res.json({ success: true });
  } catch (err) {
    console.error('❌ Lỗi gửi email:', err);
    res.status(500).json({ error: 'Không gửi được email', details: err.message });
  }
});

module.exports = router;
