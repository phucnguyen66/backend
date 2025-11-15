// mail.js
const express = require("express");
const { google } = require("googleapis");
require("dotenv").config();
const router = express.Router();

const CLIENT_ID = process.env.GMAIL_CLIENT_ID;
const CLIENT_SECRET = process.env.GMAIL_CLIENT_SECRET;
const REFRESH_TOKEN = process.env.GMAIL_REFRESH_TOKEN;
const USER = process.env.GMAIL_USER;
const REDIRECT_URI = "http://localhost/";

const oAuth2Client = new google.auth.OAuth2(
  CLIENT_ID,
  CLIENT_SECRET,
  REDIRECT_URI
);
oAuth2Client.setCredentials({ refresh_token: REFRESH_TOKEN });

function makeRawEmail({ from, to, subject, html, text }) {
  const boundary = "BOUNDARY_12345";
  const lines = [
    `From: ${from}`,
    `To: ${to}`,
    `Subject: ${subject}`,
    "MIME-Version: 1.0",
    `Content-Type: multipart/alternative; boundary="${boundary}"`,
    "",
    `--${boundary}`,
    "Content-Type: text/plain; charset=UTF-8",
    "",
    text || "",
    "",
    `--${boundary}`,
    "Content-Type: text/html; charset=UTF-8",
    "",
    html || "",
    "",
    `--${boundary}--`,
  ];
  const raw = lines.join("\r\n");
  return Buffer.from(raw)
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

router.post("/send-otp", async (req, res) => {
  try {
    // HỖ TRỢ CẢ 2 FORMAT
    let recipients = req.body.recipients;
    if (!recipients && req.body.email) {
      recipients = [req.body.email];
    }

    if (!recipients || !Array.isArray(recipients) || recipients.length === 0) {
      return res.status(400).json({ 
        success: false, 
        error: "Thiếu email người nhận" 
      });
    }

    const gmail = google.gmail({ version: "v1", auth: oAuth2Client });
    const from = USER;
    const to = recipients.join(", ");
    const subject = req.body.subject || "Mã OTP";
    const html = req.body.message || "<p>Mã OTP: 123456</p>";
    const text = req.body.message?.replace(/<[^>]*>/g, "") || "Mã OTP: 123456";

    const raw = makeRawEmail({ from, to, subject, html, text });

    const result = await gmail.users.messages.send({
      userId: "me",
      requestBody: { raw },
    });

    console.log("Gửi thành công:", result.data.id);
    return res.json({ 
      success: true, 
      message: "OTP sent!", 
      id: result.data.id 
    });
  } catch (err) {
    console.error("Lỗi:", err.response?.data || err.message);
    return res.status(500).json({ 
      success: false, 
      error: err.message || "Server error" 
    });
  }
});

module.exports = router;
