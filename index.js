// index.js
require("dotenv").config({ path: "./.env" });
const express = require("express");
const cors = require("cors");
const multer = require("multer");
const streamifier = require("streamifier");
const fetch = require("node-fetch");
const { v2: cloudinary } = require("cloudinary");
const { db } = require("./firebase");
const { ref, set, remove, get } = require("firebase/database");
const ExcelJS = require("exceljs");
const nodemailer = require("nodemailer");
const bodyParser = require("body-parser");

const app = express();
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(bodyParser.json());

// ✅ Cloudinary
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

// ✅ Multer config
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 200 * 1024 * 1024 },
});

// ✅ Helper functions
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

async function deleteCloudFile(public_id, resource_type = "raw") {
  try {
    await cloudinary.uploader.destroy(public_id, { resource_type });
  } catch (err) {
    console.error("❌ Cloudinary delete error:", err.message);
  }
}

// ==========================================================
// 📧 MAIL SERVER - gửi OTP qua Gmail
// ==========================================================
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
    console.log(`📧 Gửi OTP thành công đến: ${email}`);
    res.json({ success: true });
  } catch (err) {
    console.error("❌ Lỗi gửi email:", err.message);
    res.status(500).json({ error: "Không gửi được email." });
  }
});

// ==========================================================
// 📁 SERVER UPLOAD (CLASS + ASSIGNMENT)
// ==========================================================
app.post("/upload/:classId", upload.single("file"), async (req, res) => {
  try {
    const { classId } = req.params;
    const teacherId = getTeacherId(req);
    const file = req.file;
    if (!file) return res.status(400).json({ error: "Không có file được gửi lên" });

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
    console.error("Upload error:", err);
    res.status(500).json({ error: "Upload thất bại", details: err.message });
  }
});

// ==========================================================
// 📤 NỘP BÀI (STUDENT)
// ==========================================================
app.post("/upload/:classId/:assignmentId", upload.single("file"), async (req, res) => {
  try {
    const { classId, assignmentId } = req.params;
    const studentId = getStudentId(req);
    const file = req.file;
    if (!file) return res.status(400).json({ error: "Không có file được gửi lên" });

    const originalName = Buffer.from(file.originalname, "latin1").toString("utf8");
    const folder = `submissions/${classId}/${assignmentId}`;
    const uploadResult = await uploadBufferToCloudinary(file.buffer, folder, originalName, file.mimetype);

    const fileMeta = {
      name: originalName,
      url: uploadResult.secure_url,
      public_id: uploadResult.public_id,
      resource_type: uploadResult.resource_type,
      uploadedAt: new Date().toISOString(),
    };

    await set(ref(db, `SUBMISSIONS/${classId}/${assignmentId}/${studentId}`), {
      userId: studentId,
      submittedAt: new Date().toISOString(),
      file: fileMeta,
    });

    res.json({ message: "✅ Upload bài nộp thành công", file: fileMeta });
  } catch (err) {
    console.error("Upload submission error:", err);
    res.status(500).json({ error: "Upload thất bại", details: err.message });
  }
});

// ==========================================================
// 📦 XUẤT EXCEL ĐIỂM
// ==========================================================
app.get("/export-scores/:classId/:assignmentId", async (req, res) => {
  try {
    const { classId, assignmentId } = req.params;
    const snapshot = await get(ref(db, `SUBMISSIONS/${classId}/${assignmentId}`));
    if (!snapshot.exists()) return res.status(404).send("Không có dữ liệu.");

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

// ==========================================================
// 🗑 XÓA LỚP / BÀI TẬP / FILE
// ==========================================================
app.delete("/delete-class/:classId", async (req, res) => {
  try {
    const { classId } = req.params;
    const filesSnap = await get(ref(db, `CLASS_IF/${classId}/files`));
    if (filesSnap.exists()) {
      for (const [id, f] of Object.entries(filesSnap.val())) {
        await deleteCloudFile(f.public_id, f.resource_type);
      }
    }
    await remove(ref(db, `CLASS_IF/${classId}`));
    await remove(ref(db, `ASSIGNMENTS/${classId}`));
    await remove(ref(db, `SUBMISSIONS/${classId}`));
    res.json({ message: "✅ Đã xoá toàn bộ lớp và dữ liệu liên quan" });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.delete("/delete-assignment/:classId/:assignmentId", async (req, res) => {
  try {
    const { classId, assignmentId } = req.params;
    const subSnap = await get(ref(db, `SUBMISSIONS/${classId}/${assignmentId}`));
    if (subSnap.exists()) {
      for (const [sid, sub] of Object.entries(subSnap.val())) {
        if (sub.file?.public_id)
          await deleteCloudFile(sub.file.public_id, sub.file.resource_type);
      }
    }
    await remove(ref(db, `ASSIGNMENTS/${classId}/${assignmentId}`));
    await remove(ref(db, `SUBMISSIONS/${classId}/${assignmentId}`));
    res.json({ message: "✅ Đã xoá bài tập" });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.delete("/delete-scores-file/:classId/:assignmentId", async (req, res) => {
  try {
    const { classId, assignmentId } = req.params;
    const prefix = `Scores_${classId}_${assignmentId}`;
    const result = await cloudinary.api.delete_resources_by_prefix(prefix, {
      resource_type: "raw",
    });
    res.json({ message: "✅ Đã xoá file điểm", deleted: result.deleted });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ==========================================================
// 🚀 START ALL
// ==========================================================
const PORT = process.env.PORT || 3000;
app.listen(PORT, () =>
  console.log(`✅ All servers running on http://localhost:${PORT}`)
);


