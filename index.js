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

module.exports = router;


