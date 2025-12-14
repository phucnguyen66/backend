const express = require("express");
const cors = require("cors");
require("dotenv").config();

const app = express();

/**
 * =========================
 * CORS CONFIG (QUAN TRỌNG)
 * =========================
 */
app.use(
  cors({
    origin: [
      "http://localhost:8081",
      "http://localhost:3000",
      "https://point-frontend.onrender.com",
      "https://doan-10v9m0o2b-phuc55108-8103s-projects.vercel.app",
    ],
    methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"],
    credentials: true,
  })
);

// ⚠️ BẮT PRE-FLIGHT REQUEST (FIX LỖI CORS)
app.options("*", cors());

/**
 * =========================
 * BODY PARSER
 * =========================
 */
app.use(express.json({ limit: "20mb" }));

/**
 * =========================
 * IMPORT ROUTERS
 * =========================
 */
const uploadRouter = require("./server");
const pointRouter = require("./point");
const mailRouter = require("./mail");
const scoresRouter = require("./scores");

/**
 * =========================
 * ROUTES
 * =========================
 */
app.use("/upload", uploadRouter);
app.use("/point", pointRouter);
app.use("/mail", mailRouter);
app.use("/scores", scoresRouter);

/**
 * =========================
 * TEST ROUTE
 * =========================
 */
app.get("/", (req, res) => {
  res.send("✅ Point Backend is running!");
});

/**
 * =========================
 * START SERVER
 * =========================
 */
const PORT = process.env.PORT || 3001;
app.listen(PORT, () =>
  console.log(`🚀 Server running on port ${PORT}`)
);
