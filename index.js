const express = require("express");
const cors = require("cors");
require("dotenv").config();

const app = express();

app.use(
  cors({
    origin: [
      "http://localhost:8081",
      "https://point-frontend.onrender.com",
    ],
    methods: ["GET", "POST", "PUT", "DELETE"],
    credentials: true,
  })
);

app.use(express.json({ limit: "20mb" }));

// 📦 Import các router con
const uploadRouter = require("./server");
const pointRouter = require("./point");
const mailRouter = require("./mail");
const scoresRouter = require("./scores"); // ✅ thêm dòng này

// 📍 Gắn route
app.use("/upload", uploadRouter);
app.use("/point", pointRouter);
app.use("/mail", mailRouter);
app.use("/scores", scoresRouter); // ✅ thêm dòng này

// 🧠 Route test backend
app.get("/", (req, res) => {
  res.send("✅ Point Backend is running on Railway!");
});

// 🚀 Start server
const PORT = process.env.PORT || 3001;
app.listen(PORT, () => console.log(`🚀 Server running on port ${PORT}`));
