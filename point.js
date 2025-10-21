// point.js
require("dotenv").config({ path: "../.env" });
const express = require("express");
const cors = require("cors");
const multer = require("multer");
const streamifier = require("streamifier");
const fetch = require("node-fetch");
const { v2: cloudinary } = require("cloudinary");
const { db } = require("./firebase");
const { ref, get, set, remove } = require("firebase/database");
const ExcelJS = require("exceljs");

const app = express();
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// ✅ Cấu hình Cloudinary
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

// ✅ Multer lưu vào RAM
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 200 * 1024 * 1024 },
});

// 🔹 Helper: Lấy ID người nộp (student)
function getStudentId(req) {
  return (
    req.headers["x-student-id"] ||
    req.body?.studentId ||
    req.query?.studentId ||
    "unknown"
  );
}
function getTeacherId(req) {
  return (
    (req.body && req.body.teacherId) ||
    (req.query && req.query.teacherId) ||
    req.headers["x-teacher-id"] ||
    "unknown"
  );
}
// 🔹 Helper: Upload buffer lên Cloudinary
function uploadBufferToCloudinary(buffer, folder, originalName, mimetype = "application/octet-stream") {
  return new Promise((resolve, reject) => {
    let resourceType = "raw";
    if (mimetype.startsWith("image/")) resourceType = "image";
    else if (mimetype.startsWith("video/")) resourceType = "video";

    const uploadStream = cloudinary.uploader.upload_stream(
      {
        folder,
        resource_type: resourceType,
        public_id: originalName.replace(/\.[^.]+$/, ""), // bỏ đuôi
        use_filename: true,
        unique_filename: false,
        overwrite: true,
      },
      (error, result) => {
        if (error) return reject(error);
        resolve(result);
      }
    );

    streamifier.createReadStream(buffer).pipe(uploadStream);
  });
}

// 🔹 Helper: Xoá file trên Cloudinary
async function deleteCloudFile(public_id, resource_type = "raw") {
  try {
    await cloudinary.uploader.destroy(public_id, { resource_type });
  } catch (err) {
    console.error("Cloudinary delete error:", err.message);
  }
}

/* 🗑 Xoá toàn bộ lớp */
app.delete("/delete-class/:classId", async (req, res) => {
  try {
    const { classId } = req.params;

    // 1️⃣ Xoá file trong CLASS_IF
    const filesSnap = await get(ref(db, `CLASS_IF/${classId}/files`));
    if (filesSnap.exists()) {
      for (const [id, f] of Object.entries(filesSnap.val())) {
        await deleteCloudFile(f.public_id, f.resource_type || "raw");
      }
    }
    await remove(ref(db, `CLASS_IF/${classId}`));

    // 2️⃣ Xoá bài tập + submissions
    const assignSnap = await get(ref(db, `ASSIGNMENTS/${classId}`));
    if (assignSnap.exists()) {
      for (const [aid] of Object.entries(assignSnap.val())) {
        await remove(ref(db, `SUBMISSIONS/${classId}/${aid}`));
      }
    }
    await remove(ref(db, `ASSIGNMENTS/${classId}`));

    res.json({ message: "Đã xoá toàn bộ lớp và dữ liệu liên quan" });
  } catch (err) {
    console.error("Delete class error:", err);
    res.status(500).json({ error: "Xoá lớp thất bại" });
  }
});
app.post("/delete-file", async (req, res) => {
  try {
    const { fileUrls } = req.body;
    if (!Array.isArray(fileUrls) || fileUrls.length === 0) {
      return res.json({ success: true, message: "Không có file nào để xóa" });
    }

    console.log("🗑️ Đang xóa Cloudinary:", fileUrls.length, "file");

    for (const fileUrl of fileUrls) {
      if (!fileUrl) continue;
      const match = fileUrl.match(/\/upload\/v\d+\/(.+)\.[a-zA-Z0-9]+$/);
      if (!match || !match[1]) {
        console.warn("⚠️ Không thể lấy public_id từ:", fileUrl);
        continue;
      }

      const publicId = match[1];
      await cloudinary.v2.uploader.destroy(publicId, { resource_type: "auto" });
    }

    res.json({ success: true, deleted: fileUrls.length });
  } catch (err) {
    console.error("❌ Lỗi khi xóa Cloudinary:", err);
    res.status(500).json({ success: false, error: err.message });
  }
});

/* 🗑 Xoá bài tập + submissions */
app.delete("/delete-assignment/:classId/:assignmentId", async (req, res) => {
  try {
    const { classId, assignmentId } = req.params;

    const subSnap = await get(ref(db, `SUBMISSIONS/${classId}/${assignmentId}`));
    if (subSnap.exists()) {
      for (const [sid, sub] of Object.entries(subSnap.val())) {
        if (sub.file?.public_id)
          await deleteCloudFile(sub.file.public_id, sub.file.resource_type || "raw");
      }
    }
    await remove(ref(db, `SUBMISSIONS/${classId}/${assignmentId}`));
    await remove(ref(db, `ASSIGNMENTS/${classId}/${assignmentId}`));

    res.json({ message: "Đã xoá bài tập và các bài nộp" });
  } catch (err) {
    console.error("Delete assignment error:", err);
    res.status(500).json({ error: "Xoá bài tập thất bại" });
  }
});

/* ✅ Xuất điểm học sinh ra Excel */
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

/* ✅ Học sinh tải bài nộp */
app.get("/downloadSubmission/:classId/:assignmentId/:studentId", async (req, res) => {
  try {
    const { classId, assignmentId, studentId } = req.params;

    const snap = await get(ref(db, `SUBMISSIONS/${classId}/${assignmentId}/${studentId}`));
    if (!snap.exists()) return res.status(404).send("Không tìm thấy bài nộp.");

    const fileMeta = snap.val().file;
    if (!fileMeta?.url) return res.status(400).send("Thiếu URL file.");

    console.log("📥 Download submission:", fileMeta.name);

    const response = await fetch(fileMeta.url);
    if (!response.ok) throw new Error(`Cloudinary fetch error ${response.status}`);

    res.setHeader("Content-Type", "application/octet-stream");
    res.setHeader(
      "Content-Disposition",
      `attachment; filename*=UTF-8''${encodeURIComponent(fileMeta.name)}`
    );

    response.body.pipe(res);
  } catch (err) {
    console.error("Download submission error:", err);
    res.status(500).send("Lỗi tải file: " + err.message);
  }
});

app.post("/upload/:classId/:assignmentId", upload.single("file"), async (req, res) => {
  try {
    const { classId, assignmentId } = req.params;
    const studentId = getTeacherId(req); // hoặc userId gửi từ client
    const file = req.file;

    if (!file) return res.status(400).json({ error: "Không có file được gửi lên" });

    // 📌 Lấy bài cũ nếu có
    const oldRef = ref(db, `SUBMISSIONS/${classId}/${assignmentId}/${studentId}`);
    const oldSnap = await get(oldRef);
    if (oldSnap.exists()) {
      const oldData = oldSnap.val();
      const oldFile = oldData.file;
      if (oldFile?.public_id) {
        await cloudinary.uploader.destroy(oldFile.public_id, {
          resource_type: oldFile.resource_type || "raw",
        });
      }
    }

    // 📤 Upload file mới
    const originalName = Buffer.from(file.originalname, "latin1").toString("utf8");
    const folder = `submissions/${classId}/${assignmentId}`;
    const uploadResult = await uploadBufferToCloudinary(file.buffer, folder, originalName, file.mimetype);

    // 🗂️ Tạo metadata
    const fileMeta = {
      id: Date.now().toString(),
      name: originalName,
      url: uploadResult.secure_url,
      public_id: uploadResult.public_id,
      format: uploadResult.format || originalName.split(".").pop(),
      resource_type: uploadResult.resource_type || "raw",
      bytes: uploadResult.bytes || file.size || 0,
      uploadedAt: new Date().toISOString(),
      uploadedBy: studentId,
    };

    // 💾 Ghi đè Firebase
    await set(ref(db, `SUBMISSIONS/${classId}/${assignmentId}/${studentId}`), {
      userId: studentId,
      submittedAt: new Date().toISOString(),
      file: fileMeta,
    });

    return res.json({ message: "✅ Upload bài nộp thành công", file: fileMeta });
  } catch (err) {
    console.error("Upload submission error:", err);
    res.status(500).json({ error: "Upload thất bại", details: err.message });
  }
});

/* ✅ Download file qua server, không redirect */
app.get("/download/:classId/:fileId", async (req, res) => {
  try {
    const { classId, fileId } = req.params;
const fileRef = ref(db, `SUBMISSIONS/${classId}/${assignmentId}/${studentId}/file`);
    const snapshot = await get(fileRef);
    if (!snapshot.exists())
      return res.status(404).json({ error: "File không tồn tại" });

    const fileMeta = snapshot.val();
    const fileUrl = fileMeta.url;
    if (!fileUrl) return res.status(400).json({ error: "Thiếu URL file" });

    console.log("⬇️ Đang tải file từ Cloudinary:", fileUrl);
    const response = await fetch(fileUrl, { headers: { "User-Agent": "Node.js Server" } });
    if (!response.ok)
      return res.status(500).json({ error: "Không thể tải file từ Cloudinary" });

    let fakeName = fileMeta.name || "download";
    if (fakeName.toLowerCase().endsWith(".pdf")) {
      fakeName = fakeName.replace(/\.pdf$/i, ".download");
    }

    res.setHeader("Content-Type", "application/octet-stream");
    res.setHeader("X-Content-Type-Options", "nosniff");
    res.setHeader("Cache-Control", "no-store, no-cache, must-revalidate");
    res.setHeader("Pragma", "no-cache");
    res.setHeader(
      "Content-Disposition",
      `attachment; filename*=UTF-8''${encodeURIComponent(fakeName)}`
    );

    response.body.pipe(res);
  } catch (err) {
    console.error("Download error:", err);
    res.status(500).json({ error: "Không thể tải file", details: err.message });
  }
});
/* 🗑 Xoá file điểm của 1 bài tập (theo prefix tên file) */
app.delete("/delete-scores-file/:classId/:assignmentId", async (req, res) => {
  try {
    const { classId, assignmentId } = req.params;
    const prefix = `Scores_${classId}_${assignmentId}`;

    console.log("🗑️ Đang xoá file Cloudinary có prefix:", prefix);

    // Xoá tất cả file có tên bắt đầu bằng prefix (ở mọi thư mục)
    const result = await cloudinary.api.delete_resources_by_prefix(prefix, {
      resource_type: "raw",
    });

    console.log("✅ Đã xoá file điểm:", result.deleted);
    res.json({ message: "✅ Đã xoá file điểm thành công", deleted: result.deleted });
  } catch (err) {
    console.error("❌ Lỗi xoá file điểm:", err);
    res.status(500).json({ error: "Xoá file điểm thất bại", details: err.message });
  }
});
const PORT = process.env.POINT_PORT || 3001;
app.listen(PORT, () =>
  console.log(`✅ Point server running at http://localhost:${PORT}`)
);
