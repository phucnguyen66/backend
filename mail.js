// mail.js
const express = require("express");
const axios = require("axios");
require("dotenv").config();

const router = express.Router();

// 🧩 API gửi mail
router.post("/send-otp", async (req, res) => {
  try {
    const { recipients, subject, message } = req.body;

    if (!recipients || recipients.length === 0) {
      return res.status(400).json({ error: "Thiếu danh sách người nhận" });
    }

    // Gửi mail qua Brevo
    const response = await axios.post(
      "https://api.brevo.com/v3/smtp/email",
      {
        sender: { email: process.env.FROM_EMAIL, name: "Point App" },
        to: recipients.map((email) => ({ email })),
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
    res.status(500).json({ error: err.message });
  }
});

// 👇 Quan trọng: export router cho Express
module.exports = router;
