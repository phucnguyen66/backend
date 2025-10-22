const express = require("express");
const router = express.Router();
const Mailjet = require("node-mailjet");

// ⚙️ Kết nối Mailjet bằng API key
const mailjet = Mailjet.apiConnect(
  process.env.MJ_APIKEY_PUBLIC,
  process.env.MJ_APIKEY_PRIVATE
);

// 📩 Gửi OTP
router.post("/send-otp", async (req, res) => {
  const { email, otp } = req.body;

  if (!email || !otp) {
    return res.status(400).json({ error: "Thiếu email hoặc mã OTP" });
  }

  try {
    const result = await mailjet.post("send", { version: "v3.1" }).request({
      Messages: [
        {
          From: {
            Email: process.env.FROM_EMAIL || "no-reply@mailjet.com",
            Name: "Point System",
          },
          To: [{ Email: email }],
          Subject: "Mã xác minh tài khoản",
          TextPart: `Mã xác minh của bạn là ${otp}. Mã có hiệu lực trong 5 phút.`,
          HTMLPart: `<p>Mã xác minh của bạn là <strong>${otp}</strong>.</p><p>Mã có hiệu lực trong 5 phút.</p>`,
        },
      ],
    });

    console.log("✅ Mailjet response:", result.body);
    res.json({ success: true });
  } catch (err) {
    console.error("❌ Lỗi gửi mail qua Mailjet:", err.message);
    res.status(500).json({ success: false, error: err.message });
  }
});

module.exports = router;
