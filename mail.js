const express = require("express");
const router = express.Router();
const { Resend } = require("resend");

const resend = new Resend(process.env.RESEND_API_KEY);

router.post("/send-otp", async (req, res) => {
  const { email, otp } = req.body;

  if (!email || !otp) {
    return res.status(400).json({ error: "Thiếu email hoặc mã OTP" });
  }

  try {
    await resend.emails.send({
      from: process.env.FROM_EMAIL, // “Point System <onboarding@resend.dev>”
      to: email,
      subject: "Mã xác minh tài khoản",
      text: `Mã xác minh của bạn là: ${otp}\nMã có hiệu lực trong 5 phút.`,
    });

    console.log(`✅ Gửi OTP đến ${email}`);
    res.json({ success: true });
  } catch (err) {
    console.error("❌ Lỗi gửi email:", err.message);
    res.status(500).json({ error: "Không gửi được email", details: err.message });
  }
});

module.exports = router;
