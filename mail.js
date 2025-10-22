// mail.js
require("dotenv").config();
const express = require("express");
const { Resend } = require("resend");

const router = express.Router();
const resend = new Resend(process.env.RESEND_API_KEY);

// 📩 Gửi OTP qua email
router.post("/send-otp", async (req, res) => {
  const { email, otp } = req.body;
  if (!email || !otp) {
    return res.status(400).json({ error: "Thiếu email hoặc mã OTP" });
  }

  try {
    const response = await resend.emails.send({
      from: process.env.FROM_EMAIL,
      to: email,
      subject: "Mã xác minh tài khoản",
      html: `
        <div style="font-family:sans-serif;line-height:1.6">
          <h2>Xin chào 👋</h2>
          <p>Mã xác minh của bạn là:</p>
          <h1 style="color:#0b66ff">${otp}</h1>
          <p>Mã có hiệu lực trong 5 phút.</p>
        </div>
      `,
    });

    console.log("✅ Email gửi thành công:", response);
    res.json({ success: true });
  } catch (err) {
    console.error("❌ Lỗi gửi mail qua Resend:", err);
    res.status(500).json({ error: "Không gửi được email", details: err.message });
  }
});

module.exports = router;
