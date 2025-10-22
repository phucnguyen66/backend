const express = require("express");
const router = express.Router();
const formData = require("form-data");
const Mailgun = require("mailgun.js");

const mailgun = new Mailgun(formData);
const mg = mailgun.client({
  username: "api",
  key: process.env.MAILGUN_API_KEY,
});

router.post("/send-otp", async (req, res) => {
  const { email, otp } = req.body;

  if (!email || !otp) {
    return res.status(400).json({ error: "Thiếu email hoặc mã OTP" });
  }

  try {
    await mg.messages.create(process.env.MAILGUN_DOMAIN, {
      from: process.env.MAILGUN_FROM,
      to: [email],
      subject: "Mã xác minh tài khoản",
      text: `Mã xác minh của bạn là: ${otp}\nMã có hiệu lực 5 phút.`,
    });

    console.log(`✅ Gửi OTP qua Mailgun đến ${email}`);
    res.json({ success: true });
  } catch (err) {
    console.error("❌ Lỗi gửi Mailgun:", err.message);
    res.status(500).json({ error: "Không gửi được email", details: err.message });
  }
});

module.exports = router;
