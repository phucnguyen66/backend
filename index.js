// index.js
require("dotenv").config({ path: "../.env" });
const express = require("express");
const cors = require("cors");
const multer = require("multer");
const streamifier = require("streamifier");
const fetch = require("node-fetch");
const { v2: cloudinary } = require("cloudinary");
const { db } = require("../firebase");
const { ref, set, remove, get } = require("firebase/database");
const ExcelJS = require("exceljs");
const nodemailer = require("nodemailer");
const bodyParser = require("body-parser");

const app = express();
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(bodyParser.json());

// 🔹 Cloudinary Config
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

// 🔹 Multer
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 200 * 1024 * 1024 },
});

// 🔹 Helper
function getTeacherId(req) {
  return (
    req.headers["x-teacher-id"] ||
    req.body?.teacherId ||
    req.query?.teacherId ||
    "unknown"
  );
}
function getStudentId(req) {
  return (
    req.headers["x-student-id"] ||
    req.body?.studentId ||
    req.query?.studentId ||
    "unknown"
  );
}

// 🔹 Upload buffer lên Cloudinary
function uploadBufferToCloudinary(buffer, folder, originalName, mimetype = "application/octet-stream") {
  return new Promise((resolve, reject) => {
    let resourceType = "raw";
    if (mimetype.startsWith("image/")) resourceType = "image";
    else if (mimetype.startsWith("video/")) resourceType = "video";
    if (originalName.toLowerCase().endsWith(".pdf")) resourceType = "raw";

    const uploadStream = cloudinary.uploader.upload_stream(
      {
        folder,
        resource_type: resourceType,
        public_id: originalName.replace(/\.[^.]+$/, ""),
        use_filename: true,
        unique_filename: false,
        overwrite: true,
      },
      (error, result) => (error ? reject(error) : resolve(result))
    );
    streamifier.createReadStream(buffer).pipe(uploadStream);
  });
}

// ============================================================
// 📁 UPLOAD FILE (giáo viên, lớp, bài)
// ============================================================
app.post("/upload/:classId", upload.single("file"), async (req, res) => {
  try {
    const { classId } = req.params;
    const teacherId = getTeacherId(req);
    const file = req.file;
    if (!file) return res.status(400).json({ error: "Không có file được gửi lên" });

    const MAX_SIZE = 10 * 1024 * 1024;
    if (file.size > MAX_SIZE)
      return res.status(400).json({ error: "File vượt quá 10MB" });

    const allowedTypes = [
      "application/pdf",
      "application/msword",
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      "application/vnd.ms-powerpoint",
      "application/vnd.openxmlformats-officedocument.presentationml.presentation",
      "application/vnd.ms-excel",
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "image/jpeg",
      "image/png",
      "text/plain",
      "video/mp4",
    ];
    if (!allowedTypes.includes(file.mimetype))
      return res.status(400).json({ error: "Sai định dạng file" });

    const originalName = Buffer.from(file.originalname, "latin1").toString("utf8");
    const folder = `uploads/${teacherId}/${classId}`;
    const result = await uploadBufferToCloudinary(file.buffer, folder, originalName, file.mimetype);

    const fileId = Date.now().toString();
    const fileMeta = {
      id: fileId,
      name: originalName,
      url: result.secure_url,
      public_id: result.public_id,
      format: result.format || originalName.split(".").pop(),
      resource_type: result.resource_type || "raw",
      bytes: result.bytes || file.size,
      uploadedAt: new Date().toISOString(),
      uploadedBy: teacherId,
    };

    await set(ref(db, `CLASS_IF/${classId}/files/${fileId}`), fileMeta);
    res.json({ message: "✅ Upload thành công", file: fileMeta });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Upload thất bại", details: err.message });
  }
});

// ============================================================
// 📤 Upload bài tập (học sinh)
// ============================================================
app.post("/upload/:classId/:assignmentId", upload.single("file"), async (req, res) => {
  try {
    const { classId, assignmentId } = req.params;
    const userId = getStudentId(req);
    const file = req.file;
    if (!file) return res.status(400).json({ error: "Không có file được gửi lên" });

    const originalName = Buffer.from(file.originalname, "latin1").toString("utf8");
    const folder = `submissions/${classId}/${assignmentId}`;
    const uploadResult = await uploadBufferToCloudinary(file.buffer, folder, originalName, file.mimetype);

    const fileMeta = {
      name: originalName,
      url: uploadResult.secure_url,
      public_id: uploadResult.public_id,
      bytes: uploadResult.bytes || file.size,
      uploadedAt: new Date().toISOString(),
    };

    await set(ref(db, `SUBMISSIONS/${classId}/${assignmentId}/${userId}`), {
      userId,
      submittedAt: new Date().toISOString(),
      file: fileMeta,
    });

    res.json({ message: "✅ Upload bài nộp thành công", file: fileMeta });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Upload thất bại" });
  }
});

// ============================================================
// 📊 EXPORT EXCEL (point.js)
// ============================================================
app.get("/export-scores/:classId/:assignmentId", async (req, res) => {
  try {
    const { classId, assignmentId } = req.params;
    const snapshot = await get(ref(db, `SUBMISSIONS/${classId}/${assignmentId}`));
    if (!snapshot.exists()) return res.status(404).send("Không có dữ liệu");

    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet("Scores");

    sheet.columns = [
      { header: "STT", key: "stt", width: 5 },
      { header: "Tên học sinh", key: "userName", width: 25 },
      { header: "Mã / Email", key: "userId", width: 25 },
      { header: "Điểm", key: "score", width: 10 },
      { header: "Ngày nộp", key: "submittedAt", width: 20 },
    ];

    let i = 1;
    snapshot.forEach((c) => {
      const s = c.val();
      sheet.addRow({
        stt: i++,
        userName: s.userName || "—",
        userId: s.userId || c.key,
        score: s.score ?? "Chưa chấm",
        submittedAt: s.submittedAt
          ? new Date(s.submittedAt).toLocaleString()
          : "—",
      });
    });

    res.setHeader(
      "Content-Disposition",
      `attachment; filename=Scores_${classId}_${assignmentId}.xlsx`
    );
    res.setHeader(
      "Content-Type",
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
    );
    await workbook.xlsx.write(res);
    res.end();
  } catch (err) {
    console.error("Export error:", err);
    res.status(500).send("Xuất file thất bại");
  }
});

// ============================================================
// 📧 SEND OTP MAIL (mail.js)
// ============================================================
const transporter = nodemailer.createTransport({
  service: "gmail",
  auth: {
    user: "phuc55108@gmail.com",
    pass: "fwti oiwc hfty jxda", // App password
  },
});

app.post("/send-otp", async (req, res) => {
  const { email, otp } = req.body;
  if (!email || !otp)
    return res.status(400).json({ error: "Thiếu email hoặc mã OTP" });

  const mailOptions = {
    from: "Learning <phuc55108@gmail.com>",
    to: email,
    subject: "Mã xác minh tài khoản",
    text: `Mã xác minh của bạn là: ${otp}\n\nMã có hiệu lực trong 5 phút.`,
  };

  try {
    await transporter.sendMail(mailOptions);
    console.log(`📧 Gửi OTP đến: ${email}`);
    res.json({ success: true });
  } catch (err) {
    console.error("❌ Lỗi gửi mail:", err.message);
    res.status(500).json({ error: "Không gửi được email" });
  }
});

// ============================================================
// 🚀 START SERVER
// ============================================================
const PORT = process.env.PORT || 3000;
app.listen(PORT, () =>
  console.log(`✅ All-in-one backend running on http://localhost:${PORT}`)
);
