// mail.js
const express = require("express");
const nodemailer = require("nodemailer");
require("dotenv").config();

const router = express.Router();

// Tạo transporter dùng SMTP + App Password
const transporter = nodemailer.createTransport({
  host: "smtp.gmail.com",
  port: 587,
  secure: false, // TLS
  auth: {
    user: process.env.GMAIL_USER,
    pass: process.env.GMAIL_PASS, // App Password
  },
});

// API gửi OTP
router.post("/send-otp", async (req, res) => {
  try {
    // Hỗ trợ cả 2 format
    let recipients = req.body.recipients;
    if (!recipients && req.body.email) {
      recipients = [req.body.email];
    }

    if (!recipients || !Array.isArray(recipients) || recipients.length === 0) {
      return res.status(400).json({
        success: false,
        error: "Thiếu email người nhận",
      });
    }

    const subject = req.body.subject || "Mã OTP Point App";
    const message = req.body.message || "Mã OTP của bạn là: 123456";

    await transporter.sendMail({
      from: `"Point App" <${process.env.GMAIL_USER}>`,
      to: recipients.join(", "),
      subject,
      html: message,
      text: message.replace(/<[^>]*>/g, ""), // fallback text
    });

    console.log("Gửi email thành công đến:", recipients);
    res.json({ success: true, message: "OTP đã gửi!" });
  } catch (err) {
    console.error("Lỗi gửi email:", err.message);
    res.status(500).json({ success: false, error: err.message });
  }
});

module.exports = router;
