// mail.js
const express = require("express");
const nodemailer = require("nodemailer");
require("dotenv").config();

const router = express.Router();

router.post("/send-otp", async (req, res) => {
  try {
    const { email, otp } = req.body;

    if (!email || !otp) {
      return res.status(400).json({ success: false, error: "Thiếu email hoặc mã OTP" });
    }

    const transporter = nodemailer.createTransport({
      service: "gmail",
      auth: {
        user: process.env.FROM_EMAIL,
        pass: process.env.GMAIL_APP_PASS,
      },
    });

    const info = await transporter.sendMail({
      from: `"Point App" <${process.env.FROM_EMAIL}>`,
      to: email,
      subject: "Mã xác minh từ Point App",
      html: `<p>Mã xác minh của bạn là: <b>${otp}</b></p>`,
    });

    console.log("✅ Email sent:", info.response);
    res.json({ success: true });
  } catch (err) {
    console.error("❌ Error sending email:", err.message);
    res.status(500).json({ success: false, error: err.message });
  }
});

module.exports = router; // <-- cực kỳ quan trọng
