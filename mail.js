// mail.js
const express = require("express");
const axios = require("axios");
require("dotenv").config();

const router = express.Router();

router.post("/send-otp", async (req, res) => {
  try {
    const { email, otp } = req.body;

    if (!email) {
      return res.status(400).json({ error: "Thiếu địa chỉ email" });
    }

    // ✉️ Nội dung email gửi OTP
    const subject = "Mã xác thực OTP từ Point App";
    const message = `
      <div style="font-family:sans-serif;padding:12px;">
        <h2>🔐 Xác thực Email</h2>
        <p>Xin chào,</p>
        <p>Mã OTP của bạn là:</p>
        <h1 style="color:#0b66ff;letter-spacing:4px;">${otp}</h1>
        <p>Mã có hiệu lực trong 5 phút.</p>
      </div>
    `;

    // 🚀 Gửi mail qua Brevo API
    const response = await axios.post(
      "https://api.brevo.com/v3/smtp/email",
      {
        sender: { email: process.env.FROM_EMAIL, name: "Point App" },
        to: [{ email }],
        subject,
        htmlContent: message,
      },
      {
        headers: {
          "api-key": process.env.BREVO_API_KEY,
          "Content-Type": "application/json",
        },
      }
    );

    console.log("✅ Email sent:", response.data);
    res.json({ success: true, data: response.data });
  } catch (err) {
    console.error("❌ Error sending email:", err.response?.data || err.message);
    res.status(500).json({ error: err.response?.data || err.message });
  }
});

module.exports = router;
