// mail.js
const express = require("express");
const bodyParser = require("body-parser");
const cors = require("cors");
const sgMail = require("@sendgrid/mail");

const router = express.Router();
router.use(cors());
router.use(bodyParser.json());

sgMail.setApiKey(process.env.SENDGRID_API_KEY);

router.post("/send-otp", async (req, res) => {
  const { email, otp } = req.body;
  if (!email || !otp) return res.status(400).json({ error: "Thiếu email hoặc OTP" });

  const msg = {
    to: email,
    from: "phuc55108@gmail.com", // email đã xác minh trên SendGrid
    subject: "Mã xác minh tài khoản",
    text: `Mã xác minh của bạn là: ${otp}\nMã có hiệu lực 5 phút.`,
  };

  try {
    await sgMail.send(msg);
    console.log(`📧 OTP gửi đến: ${email}`);
    res.json({ success: true });
  } catch (err) {
    console.error("❌ Lỗi gửi email:", err.response?.body || err);
    res.status(500).json({ error: "Không gửi được email", details: err.response?.body });
  }
});

module.exports = router;
