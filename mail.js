const express = require("express");
const nodemailer = require("nodemailer");
const { google } = require("googleapis");
require("dotenv").config();

const router = express.Router();

const CLIENT_ID = process.env.GMAIL_CLIENT_ID;
const CLIENT_SECRET = process.env.GMAIL_CLIENT_SECRET;
const REFRESH_TOKEN = process.env.GMAIL_REFRESH_TOKEN;
const USER = process.env.GMAIL_USER;

const oAuth2Client = new google.auth.OAuth2(CLIENT_ID, CLIENT_SECRET);
oAuth2Client.setCredentials({ refresh_token: REFRESH_TOKEN });

router.post("/send-otp", async (req, res) => {
  try {
    const { recipients, subject, message } = req.body;
    if (!recipients || recipients.length === 0)
      return res.status(400).json({ success: false, error: "Thiếu email người nhận" });

    const accessToken = await oAuth2Client.getAccessToken();

    const transporter = nodemailer.createTransport({
      service: "gmail",
      auth: {
        type: "OAuth2",
        user: USER,
        clientId: CLIENT_ID,
        clientSecret: CLIENT_SECRET,
        refreshToken: REFRESH_TOKEN,
        accessToken: accessToken.token,
      },
    });

    const mailOptions = {
      from: `"Mail Sender" <${USER}>`,
      to: recipients.join(", "),
      subject: subject || "Mã xác minh từ Mail Sender",
      html: message || "<p>Không có nội dung</p>",
    };

    const info = await transporter.sendMail(mailOptions);
    console.log("✅ Gửi email thành công:", info.response);
    res.json({ success: true, message: "Email đã được gửi thành công!" });
  } catch (err) {
    console.error("❌ Lỗi gửi email:", err);
    res.status(500).json({ success: false, error: err.message });
  }
});

module.exports = router;
