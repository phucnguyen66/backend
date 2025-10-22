// server.js
require('dotenv').config({ path: './.env' }); // ../ trỏ lên một cấp
const cloudinary = require('cloudinary').v2;
const express = require("express");
const router = express.Router(); // thêm dòng này ✅

const cors = require("cors");
const multer = require("multer");
const streamifier = require("streamifier");
const fetch = require("node-fetch"); // npm i node-fetch@2
const { db } = require("./firebase"); // đảm bảo bạn export `db` từ file firebase
const { ref, set, remove, get } = require("firebase/database");
const bodyParser = require("body-parser"); // ✅ THÊM DÒNG NÀY

// Middleware
router.use(cors());
router.use(bodyParser.json());
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

const app = express();
router.use(cors());
router.use(express.json());
router.use(express.urlencoded({ extended: true }));

// Multer memory (RAM)
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 200 * 1024 * 1024 }, // up to 200MB, nếu cần tăng
});

function getTeacherId(req) {
  return (
    (req.body && req.body.teacherId) ||
    (req.query && req.query.teacherId) ||
    req.headers["x-teacher-id"] ||
    "unknown"
  );
}

// Upload buffer to Cloudinary using stream (works for raw/image/video)
function uploadBufferToCloudinary(
  buffer,
  folder,
  originalName,
  mimetype = "application/octet-stream"
) {
  return new Promise((resolve, reject) => {
    // ✅ Xác định loại resource (rất quan trọng!)
    let resourceType = "raw";
    if (mimetype.startsWith("image/")) resourceType = "image";
    else if (mimetype.startsWith("video/")) resourceType = "video";
    else resourceType = "raw"; // PDF, DOCX, EXE... => raw

    // ✅ Nếu là PDF nhưng Cloudinary hiểu nhầm là image => ép về raw luôn
    if (originalName.toLowerCase().endsWith(".pdf")) resourceType = "raw";

    const uploadStream = cloudinary.uploader.upload_stream(
      {
        folder,
        resource_type: resourceType,
        public_id: originalName.replace(/\.[^.]+$/, ""), // bỏ đuôi .pdf.pdf
        use_filename: true,
        unique_filename: false,
        overwrite: true,
        upload_preset: "ml_default",
      },
      (error, result) => {
        if (error) return reject(error);
        resolve(result);
      }
    );

    streamifier.createReadStream(buffer).pipe(uploadStream);
  });
}


/* Upload for class files */
router.post("/upload/:classId", upload.single("file"), async (req, res) => {
  try {
    const { classId } = req.params;
    const teacherId = getTeacherId(req);
    const file = req.file;
    if (!file)
      return res.status(400).json({ error: "Không có file được gửi lên" });

    // ✅ Giới hạn dung lượng tối đa 10MB
    const MAX_SIZE = 10 * 1024 * 1024; // 10MB
    if (file.size > MAX_SIZE) {
      return res.status(400).json({
        error: "File vượt quá dung lượng cho phép (tối đa 10MB)",
      });
    }

    // ✅ CHỈ CHO PHÉP các định dạng này
    const allowedTypes = [
      "application/pdf", // .pdf
      "application/msword", // .doc
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document", // .docx
      "application/vnd.ms-powerpoint", // .ppt
      "application/vnd.openxmlformats-officedocument.presentationml.presentation", // .pptx
      "application/vnd.ms-excel", // .xls
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", // .xlsx
      "image/jpeg", // .jpg
      "image/png", // .png
      "application/x-msdownload", // .exe
      "text/plain", // .txt
      "video/mp4", // .mp4
    ];

    if (!allowedTypes.includes(file.mimetype)) {
      return res.status(400).json({
        error:
          "Sai định dạng file! Chỉ cho phép: .pdf, .doc, .docx, .ppt, .pptx, .xls, .xlsx, .jpg, .png, .exe, .txt, .mp4",
      });
    }

    // decode tên gốc tiếng Việt
    const originalName = Buffer.from(file.originalname, "latin1").toString("utf8");

    const folder = `uploads/${teacherId}/${classId}`;
    const result = await uploadBufferToCloudinary(
      file.buffer,
      folder,
      originalName,
      file.mimetype
    );

    const fileId = Date.now().toString();
    const fileMeta = {
      id: fileId,
      name: originalName,
      url: result.secure_url,
      public_id: result.public_id,
      format: result.format || originalName.split(".").pop(),
      resource_type: result.resource_type || "raw",
      bytes: result.bytes || file.size || 0,
      uploadedAt: new Date().toISOString(),
      uploadedBy: teacherId,
    };

    await set(ref(db, `CLASS_IF/${classId}/files/${fileId}`), fileMeta);

    return res.json({ message: "Upload thành công", file: fileMeta });
  } catch (err) {
    console.error("Upload error:", err);
    return res
      .status(500)
      .json({ error: "Upload thất bại", details: err.message });
  }
});

/* ✅ Upload for assignment (classId + assignmentId) */
router.post("/upload/:classId/:assignmentId", upload.single("file"), async (req, res) => {
  try {
    const { classId, assignmentId } = req.params;
    const teacherId = getTeacherId(req);
    const file = req.file;

    if (!file) return res.status(400).json({ error: "Không có file được gửi lên" });

    // ✅ Giới hạn dung lượng tối đa 10MB
    const MAX_SIZE = 10 * 1024 * 1024;
    if (file.size > MAX_SIZE)
      return res.status(400).json({ error: "File vượt quá dung lượng cho phép (tối đa 10MB)" });

    // ✅ Chỉ cho phép các định dạng này
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
      return res.status(400).json({
        error: "Sai định dạng file! Chỉ cho phép .pdf, .doc, .docx, .ppt, .pptx, .xls, .xlsx, .jpg, .png, .txt, .mp4",
      });

    // ✅ Giải mã tên file gốc tiếng Việt
    const originalName = Buffer.from(file.originalname, "latin1").toString("utf8");

    // ✅ Đặt thư mục upload riêng cho từng học sinh/bài tập
    const folder = `submissions/${classId}/${assignmentId}`;

    // ✅ Upload buffer → Cloudinary (giống upload giáo viên)
    const result = await uploadBufferToCloudinary(
      file.buffer,
      folder,
      originalName,
      file.mimetype
    );

    // ✅ Tạo metadata
    const fileId = Date.now().toString();
    const fileMeta = {
      id: fileId,
      name: originalName,
      url: result.secure_url,
      public_id: result.public_id,
      format: result.format || originalName.split(".").pop(),
      resource_type: result.resource_type || "raw",
      bytes: result.bytes || file.size || 0,
      uploadedAt: new Date().toISOString(),
      uploadedBy: teacherId,
    };

    // ✅ Lưu vào Firebase (đúng chỗ nộp bài)
    await set(ref(db, `SUBMISSIONS/${classId}/${assignmentId}/${teacherId}`), {
      userId: teacherId,
      submittedAt: new Date().toISOString(),
      file: fileMeta,
    });

    return res.json({ message: "✅ Upload bài nộp thành công", file: fileMeta });
  } catch (err) {
    console.error("Upload error:", err);
    return res.status(500).json({ error: "Upload bài tập thất bại", details: err.message });
  }
});


/* ✅ Download - luôn stream qua server, không redirect */
router.get("/download/:classId/:fileId", async (req, res) => {
  try {
    const { classId, fileId } = req.params;
    const fileRef = ref(db, `CLASS_IF/${classId}/files/${fileId}`);
    const snapshot = await get(fileRef);
    if (!snapshot.exists())
      return res.status(404).json({ error: "File không tồn tại" });

    const fileMeta = snapshot.val();
    const fileUrl = fileMeta.url;
    if (!fileUrl)
      return res.status(400).json({ error: "Thiếu URL file" });

    console.log("⬇️ Đang tải file từ Cloudinary:", fileUrl);

    const response = await fetch(fileUrl, { headers: { "User-Agent": "Node.js Server" } });
    if (!response.ok) {
      console.error("❌ Fetch Cloudinary error:", response.status, response.statusText);
      return res.status(500).json({ error: "Không thể tải file từ Cloudinary" });
    }

    // ✅ Nếu là PDF thì đổi đuôi thành .download để IDM KHÔNG nhận ra
    let fakeName = fileMeta.name || "download";
    if (fakeName.toLowerCase().endsWith(".pdf")) {
      fakeName = fakeName.replace(/\.pdf$/i, ".download");
    }

    // Ép trình duyệt tải file (không preview, không cache)
    res.setHeader("Content-Type", "application/octet-stream");
    res.setHeader("X-Content-Type-Options", "nosniff");
    res.setHeader("Cache-Control", "no-store, no-cache, must-revalidate");
    res.setHeader("Pragma", "no-cache");
    res.setHeader(
      "Content-Disposition",
      `attachment; filename*=UTF-8''${encodeURIComponent(fakeName)}`
    );

    // Gửi stream dữ liệu
    response.body.pipe(res);
  } catch (err) {
    console.error("Download error:", err);
    res.status(500).json({ error: "Không thể tải file", details: err.message });
  }
});

/* ===================================================
   🗑️ Xóa toàn bộ file Cloudinary (cho giáo viên xóa lớp)
   =================================================== */
router.post("/delete-file", async (req, res) => {
  try {
    const { fileUrls } = req.body;

    if (!Array.isArray(fileUrls) || fileUrls.length === 0) {
      return res.json({ success: true, message: "Không có file nào để xóa" });
    }

    console.log("🗑️ Đang xóa Cloudinary:", fileUrls.length, "file");

    let deletedCount = 0;

    for (const fileUrl of fileUrls) {
      if (!fileUrl || typeof fileUrl !== "string") {
        console.warn("⚠️ Bỏ qua URL không hợp lệ:", fileUrl);
        continue;
      }

      // ✅ Xác định loại resource từ URL
      let resourceType = "raw";
      if (fileUrl.includes("/image/upload/")) resourceType = "image";
      else if (fileUrl.includes("/video/upload/")) resourceType = "video";
      else if (fileUrl.includes("/raw/upload/")) resourceType = "raw";
      else resourceType = "auto"; // fallback

      // ✅ Trích public_id chính xác
      const match = fileUrl.match(/\/upload\/v\d+\/(.+)$/);
      if (!match || !match[1]) {
        console.warn("⚠️ Không thể lấy public_id từ URL:", fileUrl);
        continue;
      }

      let publicId = decodeURIComponent(match[1]);
      publicId = publicId.replace(/\.[a-zA-Z0-9]+$/, ""); // bỏ đuôi .mp4, .pdf...

      console.log(`🗑️ Xóa file: ${publicId} [${resourceType}]`);

      try {
        const result = await cloudinary.uploader.destroy(publicId, {
          resource_type: resourceType,
        });

        if (result.result === "ok") {
          console.log(`✅ Đã xóa: ${publicId}`);
          deletedCount++;
        } else {
          console.warn(`⚠️ Không tìm thấy hoặc đã xóa trước đó: ${publicId}`);
        }
      } catch (err) {
        console.error("❌ Lỗi khi xóa Cloudinary:", err.message);
      }
    }

    return res.json({
      success: true,
      deleted: deletedCount,
      message: `Đã xử lý xong ${deletedCount}/${fileUrls.length} file.`,
    });
  } catch (err) {
    console.error("❌ Lỗi trong API /delete-file:", err);
    res.status(500).json({ success: false, error: err.message });
  }
});

/* Delete file */
router.delete("/delete/:classId/:fileId", async (req, res) => {
  try {
    const { classId, fileId } = req.params;
    const fileRef = ref(db, `CLASS_IF/${classId}/files/${fileId}`);
    const snapshot = await get(fileRef);
    if (!snapshot.exists()) return res.status(404).json({ error: "File không tồn tại" });

    const fileMeta = snapshot.val();
    const resourceType =
      fileMeta.resource_type ||
      (fileMeta.format?.match(/mp4|mov|avi|mkv/) ? "video" :
        fileMeta.format?.match(/jpg|jpeg|png|gif/) ? "image" : "raw");

    await cloudinary.uploader.destroy(fileMeta.public_id, { resource_type: resourceType });
    await remove(fileRef);

    return res.json({ message: "Đã xóa file" });
  } catch (err) {
    console.error("Delete error:", err);
    return res.status(500).json({ error: "Xóa thất bại", details: err.message });
  }
});
module.exports = router;

