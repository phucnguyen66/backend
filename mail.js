require("dotenv").config();
const express = require("express");
const nodemailer = require("nodemailer");
const router = express.Router();

// 📬 Tạo transporter Gmail
const transporter = nodemailer.createTransport({
  service: "gmail",
  auth: {
    user: process.env.GMAIL_USER,
    pass: process.env.GMAIL_APP_PASSWORD,
  },
});

// 📩 Gửi OTP
router.post("/send-otp", async (req, res) => {
  const { email, otp } = req.body;
  if (!email || !otp)
    return res.status(400).json({ error: "Thiếu email hoặc mã OTP" });

  const mailOptions = {
    from: process.env.GMAIL_USER,
    to: email,
    subject: "Mã xác minh tài khoản",
    text: `Mã xác minh của bạn là: ${otp}\nHiệu lực 5 phút.`,
  };

  try {
    await transporter.sendMail(mailOptions);
    console.log(`✅ Gửi OTP đến ${email}`);
    res.json({ success: true });
  } catch (err) {
    console.error("❌ Lỗi gửi email:", err);
    res.status(500).json({ error: "Không gửi được email", details: err.message });
  }
});

module.exports = router;
