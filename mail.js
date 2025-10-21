// mail.js (CommonJS)
const express = require("express");
const nodemailer = require("nodemailer");
const bodyParser = require("body-parser");
const cors = require("cors");

const app = express();

// Middleware
app.use(cors());
app.use(bodyParser.json());

// Cấu hình Gmail SMTP
const transporter = nodemailer.createTransport({
  service: "gmail",
  auth: {
    user: "phuc55108@gmail.com", // Gmail gửi OTP
    pass: "fwti oiwc hfty jxda", // app password
  },
});

// API gửi OTP
app.post("/send-otp", async (req, res) => {
  const { email, otp } = req.body;
  if (!email || !otp)
    return res.status(400).json({ error: "Thiếu email hoặc mã OTP" });

  const mailOptions = {
    from: "Learning <phuc55108@gmail.com>",
    to: email,
    subject: "Mã xác minh tài khoản",
    text: `Mã xác minh của bạn là: ${otp}\n\nMã có hiệu lực trong 5 phút.`,
  };

  try {
    await transporter.sendMail(mailOptions);
    console.log(`📧 Gửi OTP thành công đến: ${email}`);
    res.json({ success: true });
  } catch (err) {
    console.error("❌ Lỗi gửi email:", err.message);
    res.status(500).json({ error: "Không gửi được email." });
  }
});

app.listen(4000, () =>
  console.log("✅ Mail Server chạy tại http://localhost:4000")
);
