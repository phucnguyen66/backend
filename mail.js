// mail.js
import nodemailer from "nodemailer";
import { google } from "googleapis";

const CLIENT_ID = process.env.GOOGLE_CLIENT_ID;
const CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET;
const REFRESH_TOKEN = process.env.GOOGLE_REFRESH_TOKEN;
const USER = process.env.GMAIL_USER;
const REDIRECT_URI = "https://developers.google.com/oauthplayground";

// OAuth2 setup
const oAuth2Client = new google.auth.OAuth2(
  CLIENT_ID,
  CLIENT_SECRET,
  REDIRECT_URI
);
oAuth2Client.setCredentials({ refresh_token: REFRESH_TOKEN });

export async function sendGmail(toList, subject, html) {
  try {
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
      from: `Phuc App <${USER}>`,
      bcc: toList, // gửi ẩn danh cho nhiều người
      subject,
      html,
    };

    const result = await transporter.sendMail(mailOptions);
    console.log("✅ Email sent:", result.accepted);
    return result;
  } catch (err) {
    console.error("❌ Error sending mail:", err.message);
    throw err;
  }
}
