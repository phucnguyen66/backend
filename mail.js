// mail.js
const express = require("express");
const nodemailer = require("nodemailer");
require("dotenv").config();

const router = express.Router();

// Tạo transporter (SMTP)
const transporter = nodemailer.createTransport({
  host: "smtp.gmail.com",
  port: 587,
  secure: false, // TLS
  auth: {
    user: process.env.GMAIL_USER,
    pass: process.env.GMAIL_PASS, // App Password
  },
});

// Gửi OTP
router.post("/send-otp", async (req, res) => {
  try {
    const { email } = req.body;
    if (!email) return res.status(400).json({ success: false, error: "Thiếu email" });

    const otp = Math.floor(100000 + Math.random() * 900000).toString();

    await transporter.sendMail({
      from: `"Point App" <${process.env.GMAIL_USER}>`,
      to: email,
      subject: "Mã OTP Đặt Lại Mật Khẩu",
      text: `Mã OTP: ${otp}\nHết hạn sau 5 phút.`,
      html: `<h3>Mã OTP: <strong>${otp}</strong></h3><p>Hết hạn sau 5 phút.</p>`,
    });

    // Lưu OTP vào DB/Redis ở đây (bạn thêm sau)
    // await saveOTP(email, otp);

    res.json({ success: true, message: "OTP đã gửi!", otp }); // XÓA OTP TRONG PRODUCTION
  } catch (err) {
    console.error("Lỗi gửi email:", err);
    res.status(500).json({ success: false, error: "Gửi thất bại" });
  }
});

module.exports = router;
