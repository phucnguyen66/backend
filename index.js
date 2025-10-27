const express = require("express");
const cors = require("cors");

const app = express();
app.use(cors());
app.use(express.json());

// --- Import 3 router riêng ---
const uploadRouter = require("./server");
const pointRouter = require("./point");
const mailRouter = require("./mail");

// --- Gắn router vào prefix ---
app.use("/upload", uploadRouter);
app.use("/point", pointRouter);
app.use("/mail", mailRouter);

// --- Chạy 1 port duy nhất ---
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`✅ Main backend running at http://localhost:${PORT}`));
