// index.js
const express = require("express");
const cors = require("cors");
require("dotenv").config();

const app = express();

// 🧩 Cho phép frontend Render và local gọi API backend Railway
app.use(
  cors({
    origin: [
      "http://localhost:8081", // chạy frontend local
      "https://point-frontend.onrender.com", // frontend deploy trên Render
    ],
    methods: ["GET", "POST", "PUT", "DELETE"],
    credentials: true,
  })
);

// Đọc JSON body
app.use(express.json());

// 📦 Import router con
const uploadRouter = require("./server");
const pointRouter = require("./point");
const mailRouter = require("./mail");

// 📍 Gắn route
app.use("/upload", uploadRouter);
app.use("/point", pointRouter);
app.use("/mail", mailRouter);

// 🧠 Route test backend
app.get("/", (req, res) => {
  res.send("✅ Point Backend is running on Railway!");
});

// 🚀 Start server
const PORT = process.env.PORT || 3001;
app.listen(PORT, () => console.log(`🚀 Server running on port ${PORT}`));

