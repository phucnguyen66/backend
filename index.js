const express = require("express");
const cors = require("cors");
require("dotenv").config();

const app = express();

// 🧩 Cho phép frontend truy cập (CORS)
app.use(
  cors({
    origin: [
      "http://localhost:8081",           // frontend local (Expo / web)
      "https://point-frontend.onrender.com", // frontend deploy trên Render
    ],
    methods: ["GET", "POST", "PUT", "DELETE"],
    credentials: true,
  })
);

// 🧩 Middleware đọc JSON
app.use(express.json());

// --- Import router ---
const uploadRouter = require("./server");
const pointRouter = require("./point");
const mailRouter = require("./mail");

// --- Gắn router ---
app.use("/upload", uploadRouter);
app.use("/point", pointRouter);
app.use("/mail", mailRouter);

// --- Route kiểm tra server ---
app.get("/", (req, res) => {
  res.send("✅ Point Backend is running!");
});

// --- Lấy PORT đúng cách cho Render ---
const PORT = process.env.PORT || process.env.POINT_PORT || 3001;

app.listen(PORT, () =>
  console.log(`🚀 Server running on port ${PORT}`)
);
