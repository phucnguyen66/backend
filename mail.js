// mail.js
import axios from "axios";
import dotenv from "dotenv";
dotenv.config();

export async function sendEmail(to, subject, html) {
  try {
    const res = await axios.post(
      "https://api.brevo.com/v3/smtp/email",
      {
        sender: { email: process.env.FROM_EMAIL, name: "Point App" },
        to: to.map((email) => ({ email })),
        subject,
        htmlContent: html,
      },
      {
        headers: {
          "api-key": process.env.BREVO_API_KEY,
          "Content-Type": "application/json",
        },
      }
    );

    console.log("✅ Email sent:", res.data);
    return res.data;
  } catch (err) {
    console.error("❌ Error sending email:", err.response?.data || err.message);
    throw err;
  }
}
