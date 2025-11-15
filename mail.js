// mail.js
const express = require("express");
const { google } = require("googleapis");
require("dotenv").config();

const router = express.Router();

const oAuth2Client = new google.auth.OAuth2(
  process.env.GMAIL_CLIENT_ID,
  process.env.GMAIL_CLIENT_SECRET,
  "http://localhost/"
);
oAuth2Client.setCredentials({ refresh_token: process.env.GMAIL_REFRESH_TOKEN });

function makeEmail({ from, to, subject, html }) {
  const lines = [
    `From: ${from}`,
    `To: ${to}`,
    `Subject: ${subject}`,
    "MIME-Version: 1.0",
    'Content-Type: text/html; charset="UTF-8"',
    "",
    html,
  ];
  const raw = Buffer.from(lines.join("\r\n"))
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
  return raw;
}

router.post("/send-otp", async (req, res) => {
  try {
    let recipients = req.body.recipients;
    if (!recipients && req.body.email) {
      recipients = [req.body.email];
    }

    if (!recipients || !Array.isArray(recipients) || recipients.length === 0) {
      return res.status(400).json({ success: false, error: "Thiếu email" });
    }

    const gmail = google.gmail({ version: "v1", auth: oAuth2Client });
    const raw = makeEmail({
      from: process.env.GMAIL_USER,
      to: recipients.join(", "),
      subject: req.body.subject || "Mã OTP",
      html: req.body.message || "<b>123456</b>",
    });

    await gmail.users.messages.send({
      userId: "me",
      requestBody: { raw },
    });

    console.log("Gmail API: Gửi thành công");
    res.json({ success: true, message: "OTP đã gửi!" });
  } catch (err) {
    console.error("Lỗi Gmail API:", err.response?.data || err.message);
    res.status(500).json({ success: false, error: err.message });
  }
});

module.exports = router;
