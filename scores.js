// scores.js
const express = require("express");
const XLSX = require("xlsx");

const router = express.Router();

// ✅ API: Nhận dữ liệu điểm -> Xuất Excel
router.post("/export-excel", (req, res) => {
  try {
    const { className, assignments, students } = req.body;

    if (!students || !assignments) {
      return res.status(400).json({ error: "Thiếu dữ liệu học sinh hoặc bài tập" });
    }

    const rows = students.map((student) => {
      const row = { "Học sinh": student.name };
      let total = 0;
      let wSum = 0;

      assignments.forEach((a) => {
        const found =
          a.students?.[student.id] ||
          a.students?.find?.((s) => s.name === student.name);
        const score = found ? found.score || 0 : 0;
        row[a.assignmentTitle] = score;

        const w = Number(a.weight || 0);
        total += score * w;
        wSum += w;
      });

      row["Điểm TB"] = wSum > 0 ? (total / wSum).toFixed(2) : "0.00";
      return row;
    });

    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Tổng điểm");

    const buffer = XLSX.write(wb, { type: "buffer", bookType: "xlsx" });

    res.setHeader(
      "Content-Disposition",
      `attachment; filename=DiemTong_${className || "lop"}.xlsx`
    );
    res.setHeader(
      "Content-Type",
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
    );
    res.send(buffer);
  } catch (err) {
    console.error("❌ Lỗi xuất Excel:", err);
    res.status(500).json({ error: "Không thể xuất Excel" });
  }
});

module.exports = router;

