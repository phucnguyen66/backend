const express = require("express");
const router = express.Router();
const axios = require("axios");

const SENDGRID_API_KEY = process.env.SENDGRID_API_KEY;

router.post("/send-otp", async (req, res) => {
  const { email, otp } = req.body;
  if (!email || !otp) return res.status(400).json({ error: "Thiếu email hoặc OTP" });

  try {
    await axios.post(
      "https://api.sendgrid.com/v3/mail/send",
      {
        personalizations: [{ to: [{ email }] }],
        from: { email: "phuc55108@gmail.com", name: "Point System" },
        subject: "Mã xác minh tài khoản",
        content: [
          {
            type: "text/plain",
            value: `Mã xác minh của bạn là: ${otp}\nMã có hiệu lực 5 phút.`,
          },
        ],
      },
      {
        headers: {
          Authorization: `Bearer ${SENDGRID_API_KEY}`,
          "Content-Type": "application/json",
        },
      }
    );

    console.log(`✅ Gửi OTP qua SendGrid đến ${email}`);
    res.json({ success: true });
  } catch (err) {
    console.error("❌ Lỗi gửi SendGrid:", err.response?.data || err.message);
    res.status(500).json({ error: "Không gửi được email", details: err.message });
  }
});

module.exports = router;
