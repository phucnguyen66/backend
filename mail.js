// mail.js
const express = require("express");
const { google } = require("googleapis");
require("dotenv").config();

const router = express.Router();

// Env
const CLIENT_ID = process.env.GMAIL_CLIENT_ID;
const CLIENT_SECRET = process.env.GMAIL_CLIENT_SECRET;
const REFRESH_TOKEN = process.env.GMAIL_REFRESH_TOKEN;
const USER = process.env.GMAIL_USER; // example: phuc55108@gmail.com
const REDIRECT_URI = "https://developers.google.com/oauthplayground";

const oAuth2Client = new google.auth.OAuth2(
  CLIENT_ID,
  CLIENT_SECRET,
  REDIRECT_URI
);
oAuth2Client.setCredentials({ refresh_token: REFRESH_TOKEN });

// helper: encode RFC2822 message -> base64url
function makeRawEmail({ from, to, subject, html, text }) {
  // Build RFC822 / RFC2822 message
  const boundary = "__BOUNDARY__";
  const msgLines = [];
  msgLines.push(`From: ${from}`);
  msgLines.push(`To: ${to}`);
  msgLines.push(`Subject: ${subject}`);
  msgLines.push("MIME-Version: 1.0");
msgLines.push(`Content-Type: multipart/alternative; boundary="${boundary}"; charset="UTF-8"`);
msgLines.push("Content-Transfer-Encoding: 8bit");
  msgLines.push("");
  msgLines.push(`--${boundary}`);
  msgLines.push("Content-Type: text/plain; charset=UTF-8");
  msgLines.push("Content-Transfer-Encoding: 7bit");
  msgLines.push("");
  msgLines.push(text || ""); // plain text
  msgLines.push("");
  msgLines.push(`--${boundary}`);
  msgLines.push('Content-Type: text/html; charset=UTF-8');
  msgLines.push("Content-Transfer-Encoding: 7bit");
  msgLines.push("");
  msgLines.push(html || "");
  msgLines.push("");
  msgLines.push(`--${boundary}--`);

  const raw = msgLines.join("\r\n");

  // Base64url encode
  const base64 = Buffer.from(raw)
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
  return base64;
}

router.post("/send-otp", async (req, res) => {
  try {
    const { recipients, subject, message } = req.body;
    if (!recipients || !Array.isArray(recipients) || recipients.length === 0) {
      return res.status(400).json({ success: false, error: "Thiếu danh sách email người nhận." });
    }

    // Lấy access token (thư viện sẽ dùng refresh token nếu cần)
    const accessTokenObj = await oAuth2Client.getAccessToken();
    const accessToken = accessTokenObj?.token || accessTokenObj;

    if (!accessToken) {
      console.error("No access token obtained");
      return res.status(500).json({ success: false, error: "Không lấy được access token" });
    }

    const gmail = google.gmail({ version: "v1", auth: oAuth2Client });

    const from = USER;
    const to = recipients.join(", ");
    const subj = subject || "Mã xác minh từ Point App";
    const html = message || "<p>Không có nội dung</p>";
    const text = (message || "").replace(/<[^>]*>/g, ""); // crude plain text fallback

    const raw = makeRawEmail({ from, to, subject: subj, html, text });

    const result = await gmail.users.messages.send({
      userId: "me",
      requestBody: {
        raw,
      },
      // headers: { Authorization: `Bearer ${accessToken}` } // not needed: auth client already set
    });

    console.log("✅ Gmail API sent:", result.status, result.data && result.data.id);
    return res.json({ success: true, message: "Email đã được gửi thành công!", id: result.data?.id });
  } catch (err) {
    console.error("❌ Lỗi gửi email:", err);
    // nếu err.response hoặc err.code, in chi tiết
    return res.status(500).json({ success: false, error: err.message || String(err) });
  }
});

module.exports = router;
