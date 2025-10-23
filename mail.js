// mail.js
const express = require("express");
const nodemailer = require("nodemailer");
const { google } = require("googleapis");
require("dotenv").config();

const router = express.Router();

// 🔐 Lấy thông tin OAuth2 từ biến môi trường
const CLIENT_ID = process.env.GMAIL_CLIENT_ID;
const CLIENT_SECRET = process.env.GMAIL_CLIENT_SECRET;
const REFRESH_TOKEN = process.env.GMAIL_REFRESH_TOKEN;
const USER = process.env.GMAIL_USER;

// ⚙️ Khởi tạo OAuth2 client
const oAuth2Client = new google.auth.OAuth2(CLIENT_ID, CLIENT_SECRET);
oAuth2Client.setCredentials({ refresh_token: REFRESH_TOKEN });

/**
 * 📩 Gửi OTP qua email
 * Body từ frontend:
 * {
 *   "recipients": ["email1@gmail.com"],
 *   "subject": "Tiêu đề email",
 *   "message": "<p>Nội dung HTML...</p>"
 * }
 */
router.post("/send-otp", async (req, res) => {
  try {
    const { recipients, subject, message } = req.body;

    if (!recipients || recipients.length === 0)
      return res.status(400).json({ success: false, error: "Thiếu email người nhận" });

    // 🔑 Lấy access token từ refresh token
    const accessToken = await oAuth2Client.getAccessToken();

    // ✉️ Tạo transporter Gmail (OAuth2)
    const transporter = nodemailer.createTransport({
      service: "gmail",
      auth: {
        type: "OAuth2",
        user: USER,
        clientId: CLIENT_ID,
        clientSecret: CLIENT_SECRET,
        refreshToken: REFRESH_TOKEN,
        accessToken: accessToken?.token || accessToken, // hỗ trợ cả 2 dạng trả về
      },
    });

    // 📬 Cấu hình email
    const mailOptions = {
      from: `"Point App" <${USER}>`,
      to: recipients.join(", "),
      subject: subject || "Mã xác minh từ Point App",
      html: message || "<p>Không có nội dung</p>",
    };

    // 🚀 Gửi email
    const info = await transporter.sendMail(mailOptions);
    console.log("✅ Email sent:", info.response);

    return res.json({ success: true, message: "Đã gửi email thành công!" });
  } catch (err) {
    console.error("❌ Lỗi gửi email:", err);
    return res.status(500).json({ success: false, error: err.message });
  }
});

module.exports = router;
