// mail.js
const express = require("express");
const nodemailer = require("nodemailer");
require("dotenv").config();

const router = express.Router();

/**
 * 📩 Gửi OTP qua email
 * Body nhận từ frontend:
 * {
 *   "recipients": ["email1@gmail.com", "email2@gmail.com"],
 *   "subject": "Tiêu đề email",
 *   "message": "<p>Nội dung HTML...</p>"
 * }
 */
router.post("/send-otp", async (req, res) => {
  try {
    const { recipients, subject, message } = req.body;

    // ✅ Kiểm tra dữ liệu đầu vào
    if (!recipients || !Array.isArray(recipients) || recipients.length === 0) {
      return res
        .status(400)
        .json({ success: false, error: "Thiếu danh sách email người nhận." });
    }

    // ✅ Tạo transporter Gmail
    const transporter = nodemailer.createTransport({
      service: "gmail",
      auth: {
        user: process.env.GMAIL_USER,      // địa chỉ Gmail của bạn
        pass: process.env.GMAIL_PASS,  // app password (không phải mật khẩu thường)
      },
    });

    // ✅ Cấu hình email
    const mailOptions = {
      from: `"Point App" <${process.env.FROM_EMAIL}>`,
      to: recipients.join(", "), // nối thành chuỗi
      subject: subject || "Mã xác minh từ Point App",
      html: message || "<p>Không có nội dung</p>",
    };

    // ✅ Gửi mail
    const info = await transporter.sendMail(mailOptions);

    console.log("✅ Email sent:", info.response);
    return res.json({ success: true, message: "Email đã được gửi thành công!" });
  } catch (err) {
    console.error("❌ Error sending email:", err.message);
    return res
      .status(500)
      .json({ success: false, error: "Gửi email thất bại: " + err.message });
  }
});

module.exports = router;
