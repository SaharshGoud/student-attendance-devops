const express = require("express");
const path = require("path");
const { DatabaseSync } = require("node:sqlite");

const app = express();
const PORT = process.env.PORT || 3000;
const DB_FILE = process.env.DB_FILE || path.join(__dirname, "data", "attendance.db");
require("fs").mkdirSync(path.dirname(DB_FILE), { recursive: true });
const db = new DatabaseSync(DB_FILE);
db.exec(`
  CREATE TABLE IF NOT EXISTS students (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    roll_no TEXT NOT NULL UNIQUE,
    name TEXT NOT NULL,
    department TEXT NOT NULL DEFAULT 'CSE',
    active INTEGER NOT NULL DEFAULT 1
  );
  CREATE TABLE IF NOT EXISTS attendance (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    student_id INTEGER NOT NULL,
    attendance_date TEXT NOT NULL,
    period INTEGER NOT NULL CHECK(period BETWEEN 1 AND 7),
    status TEXT NOT NULL CHECK(status IN ('P','A')),
    UNIQUE(student_id, attendance_date, period),
    FOREIGN KEY(student_id) REFERENCES students(id)
  );
`);

const studentCount = db.prepare("SELECT COUNT(*) AS count FROM students").get().count;
if (studentCount === 0) {
  const add = db.prepare("INSERT INTO students (roll_no, name, department) VALUES (?, ?, ?)");
  db.exec("BEGIN");
  try {
    [
      ["101", "Student 1", "CSE"],
      ["102", "Student 2", "CSE"],
      ["103", "Student 3", "CSE"],
      ["104", "Student 4", "CSE"],
      ["105", "Student 5", "CSE"]
    ].forEach(s => add.run(...s));
    db.exec("COMMIT");
  } catch (err) {
    db.exec("ROLLBACK");
    throw err;
  }
}

app.use(express.json());
app.use(express.static(path.join(__dirname, "public")));

function validDate(value) {
  return typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value) &&
    !Number.isNaN(Date.parse(`${value}T00:00:00Z`));
}

app.get("/api/health", (_req, res) => res.json({ status: "ok" }));

app.get("/api/students", (_req, res) => {
  res.json(db.prepare("SELECT id, roll_no AS rollNo, name, department FROM students WHERE active = 1 ORDER BY roll_no").all());
});

app.post("/api/students", (req, res) => {
  const { rollNo, name, department = "CSE" } = req.body || {};
  if (!String(rollNo || "").trim() || !String(name || "").trim()) {
    return res.status(400).json({ error: "Roll number and student name are required." });
  }
  try {
    const result = db.prepare("INSERT INTO students (roll_no, name, department) VALUES (?, ?, ?)")
      .run(String(rollNo).trim(), String(name).trim(), String(department).trim() || "CSE");
    res.status(201).json({ id: result.lastInsertRowid, rollNo: String(rollNo).trim(), name: String(name).trim(), department });
  } catch (err) {
    if (String(err.code).includes("SQLITE_CONSTRAINT")) return res.status(409).json({ error: "That roll number already exists." });
    throw err;
  }
});

app.get("/api/attendance", (req, res) => {
  const date = req.query.date;
  if (!validDate(date)) return res.status(400).json({ error: "Provide a date in YYYY-MM-DD format." });
  const rows = db.prepare(`
    SELECT s.id AS studentId, a.period, a.status
    FROM students s LEFT JOIN attendance a
      ON a.student_id = s.id AND a.attendance_date = ?
    WHERE s.active = 1
  `).all(date);
  const result = {};
  for (const row of rows) {
    if (!result[row.studentId]) result[row.studentId] = {};
    if (row.period) result[row.studentId][row.period] = row.status;
  }
  res.json(result);
});

app.put("/api/attendance", (req, res) => {
  const { date, records } = req.body || {};
  if (!validDate(date)) return res.status(400).json({ error: "Provide a date in YYYY-MM-DD format." });
  if (!Array.isArray(records)) return res.status(400).json({ error: "Records must be an array." });
  const studentExists = db.prepare("SELECT id FROM students WHERE id = ? AND active = 1");
  const save = db.prepare(`
    INSERT INTO attendance (student_id, attendance_date, period, status) VALUES (?, ?, ?, ?)
    ON CONFLICT(student_id, attendance_date, period) DO UPDATE SET status = excluded.status
  `);
  const remove = db.prepare("DELETE FROM attendance WHERE student_id = ? AND attendance_date = ? AND period = ?");
  try {
    db.exec("BEGIN");
    try {
      for (const r of records) {
        const studentId = Number(r.studentId), period = Number(r.period), status = r.status;
        if (!Number.isInteger(studentId) || !studentExists.get(studentId)) throw new Error("A student record is invalid.");
        if (!Number.isInteger(period) || period < 1 || period > 7) throw new Error("Period must be between 1 and 7.");
        if (status === "P" || status === "A") save.run(studentId, date, period, status);
        else if (status === null || status === "") remove.run(studentId, date, period);
        else throw new Error("Status must be P, A, or blank.");
      }
      db.exec("COMMIT");
    } catch (err) {
      db.exec("ROLLBACK");
      throw err;
    }
    res.json({ message: "Attendance saved successfully.", date, savedRecords: records.length });
  } catch (err) {
    res.status(400).json({ error: err.message || "Unable to save attendance." });
  }
});

app.get("/api/reports/monthly", (req, res) => {
  const month = req.query.month;
  const threshold = Math.max(0, Math.min(100, Number(req.query.threshold ?? 75)));
  if (typeof month !== "string" || !/^\d{4}-\d{2}$/.test(month)) {
    return res.status(400).json({ error: "Provide a month in YYYY-MM format." });
  }
  const totals = db.prepare(`
    SELECT s.id, s.roll_no AS rollNo, s.name, s.department,
      COUNT(a.id) AS workingPeriods,
      SUM(CASE WHEN a.status = 'P' THEN 1 ELSE 0 END) AS present,
      SUM(CASE WHEN a.status = 'A' THEN 1 ELSE 0 END) AS absent
    FROM students s
    LEFT JOIN attendance a ON a.student_id = s.id AND substr(a.attendance_date, 1, 7) = ?
    WHERE s.active = 1
    GROUP BY s.id
    ORDER BY s.roll_no
  `).all(month).map(s => {
    const workingPeriods = Number(s.workingPeriods || 0);
    const present = Number(s.present || 0);
    const absent = Number(s.absent || 0);
    const percentage = workingPeriods ? Number((present / workingPeriods * 100).toFixed(2)) : 0;
    return { ...s, workingPeriods, present, absent, percentage, belowThreshold: workingPeriods > 0 && percentage < threshold };
  });
  res.json({ month, threshold, students: totals });
});

app.get("/api/reports/monthly.csv", (req, res) => {
  const month = req.query.month;
  if (typeof month !== "string" || !/^\d{4}-\d{2}$/.test(month)) return res.status(400).send("Provide month=YYYY-MM");
  const rows = db.prepare(`
    SELECT s.roll_no AS rollNo, s.name,
      COUNT(a.id) AS workingPeriods,
      SUM(CASE WHEN a.status = 'P' THEN 1 ELSE 0 END) AS present,
      SUM(CASE WHEN a.status = 'A' THEN 1 ELSE 0 END) AS absent
    FROM students s LEFT JOIN attendance a
      ON a.student_id = s.id AND substr(a.attendance_date, 1, 7) = ?
    WHERE s.active = 1 GROUP BY s.id ORDER BY s.roll_no
  `).all(month);
  const csv = [
    ["Roll No", "Student", "Working Periods", "Present", "Absent", "Attendance %"].join(","),
    ...rows.map(r => {
      const total = Number(r.workingPeriods || 0), present = Number(r.present || 0);
      const name = `"${String(r.name).replace(/"/g, '""')}"`;
      return [r.rollNo, name, total, present, Number(r.absent || 0), total ? (present / total * 100).toFixed(2) : "0.00"].join(",");
    })
  ].join("\n");
  res.setHeader("Content-Type", "text/csv; charset=utf-8");
  res.setHeader("Content-Disposition", `attachment; filename="attendance-${month}.csv"`);
  res.send(csv);
});

app.use((err, _req, res, _next) => {
  console.error(err);
  res.status(500).json({ error: "An unexpected server error occurred." });
});

if (require.main === module) {
  app.listen(PORT, () => console.log(`Attendance app running at http://localhost:${PORT}`));
}
module.exports = app;
