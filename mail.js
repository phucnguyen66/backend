// mail.js
const express = require("express");
const nodemailer = require("nodemailer");
require("dotenv").config();

const router = express.Router();

router.post("/send-otp", async (req, res) => {
  try {
    const { email, otp } = req.body;
    if (!email || !otp) return res.status(400).json({ error: "Thiếu email hoặc otp" });

    const transporter = nodemailer.createTransport({
      service: "gmail",
      auth: {
        user: process.env.GMAIL_USER,
        pass: process.env.GMAIL_PASS, // App Password
      },
    });

    const mailOptions = {
      from: `"Point App" <${process.env.GMAIL_USER}>`,
      to: email,
      subject: "Mã xác thực OTP",
      html: `<h2>Your OTP</h2><h1>${otp}</h1><p>Valid 5 minutes</p>`,
    };

    await transporter.sendMail(mailOptions);
    res.json({ success: true });
  } catch (err) {
    console.error("Send failed:", err);
    res.status(500).json({ error: err.message || "Send error" });
  }
});

module.exports = router;
