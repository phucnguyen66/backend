const express = require("express");
const bodyParser = require("body-parser");
const cors = require("cors");
const nodemailer = require("nodemailer");

const router = express.Router();

// Middleware
router.use(cors());
router.use(bodyParser.json());

// ⚙️ Cấu hình Gmail SMTP
const transporter = nodemailer.createTransport({
  service: "gmail",
  auth: {
    user: process.env.GMAIL_USER, // thêm vào .env
    pass: process.env.GMAIL_APP_PASSWORD, // app password
  },
});

// ✅ API gửi OTP
router.post("/send-otp", async (req, res) => {
  const { email, otp } = req.body;

  if (!email || !otp) {
    return res.status(400).json({ error: "Thiếu email hoặc mã OTP" });
  }

  const mailOptions = {
    from: `"Learning System" <${process.env.GMAIL_USER}>`,
    to: email,
    subject: "Mã xác minh tài khoản",
    text: `Mã xác minh của bạn là: ${otp}\n\nMã có hiệu lực trong 5 phút.`,
  };

  try {
    const info = await transporter.sendMail(mailOptions);
    console.log(`📧 Gửi OTP thành công đến: ${email}`);
    console.log("Message ID:", info.messageId);
    res.json({ success: true });
  } catch (err) {
    console.error("❌ Lỗi gửi email:", err);
    res.status(500).json({
      error: "Không gửi được email.",
      message: err.message,
    });
  }
});

module.exports = router;
