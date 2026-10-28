const $ = id => document.getElementById(id);
const today = new Date();
const localDate = d => `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`;
const localMonth = d => localDate(d).slice(0,7);
$("attendanceDate").value = localDate(today);
$("reportMonth").value = localMonth(today);
let students = [];
let attendance = {};

async function api(url, options = {}) {
  const response = await fetch(url, { headers: { "Content-Type": "application/json", ...(options.headers || {}) }, ...options });
  if (!response.ok) {
    let message = "Request failed.";
    try { message = (await response.json()).error || message; } catch {}
    throw new Error(message);
  }
  return response;
}
function showMessage(id, text, error = false) {
  $(id).textContent = text;
  $(id).classList.toggle("error", error);
}
async function loadStudents() {
  students = await (await api("/api/students")).json();
  renderStudents();
  await loadAttendance();
}
function renderStudents() {
  $("studentsBody").innerHTML = students.map(s => `<tr><td>${escapeHtml(s.rollNo)}</td><td>${escapeHtml(s.name)}</td><td>${escapeHtml(s.department)}</td></tr>`).join("");
}
function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, c => ({ "&":"&amp;", "<":"&lt;", ">":"&gt;", '"':"&quot;", "'":"&#39;" }[c]));
}
async function loadAttendance() {
  const date = $("attendanceDate").value;
  if (!date) return;
  attendance = await (await api(`/api/attendance?date=${encodeURIComponent(date)}`)).json();
  renderAttendance();
}
function renderAttendance() {
  const body = $("attendanceTable").querySelector("tbody");
  body.innerHTML = students.map(s => `<tr><td>${escapeHtml(s.rollNo)}</td><td>${escapeHtml(s.name)}</td><td>${escapeHtml(s.department)}</td>${Array.from({length:7},(_,i) => {
    const period = i+1, status = attendance[s.id]?.[period] || "";
    return `<td class="attendance-cell"><button class="mark ${status === "P" ? "p" : status === "A" ? "a" : ""}" data-student="${s.id}" data-period="${period}" aria-label="${escapeHtml(s.name)} period ${period}: ${status || "not marked"}">${status || "—"}</button></td>`;
  }).join("")}</tr>`).join("");
}
$("attendanceTable").addEventListener("click", e => {
  const button = e.target.closest("button.mark");
  if (!button) return;
  const id = button.dataset.student, period = button.dataset.period;
  if (!attendance[id]) attendance[id] = {};
  const current = attendance[id][period] || "";
  attendance[id][period] = current === "" ? "P" : current === "P" ? "A" : "";
  renderAttendance();
});
$("attendanceDate").addEventListener("change", async () => {
  try { await loadAttendance(); showMessage("dailyMessage", ""); }
  catch (e) { showMessage("dailyMessage", e.message, true); }
});
$("allPresent").addEventListener("click", () => setAll("P"));
$("allAbsent").addEventListener("click", () => setAll("A"));
function setAll(status) {
  attendance = {};
  students.forEach(s => { attendance[s.id] = {}; for (let p=1;p<=7;p++) attendance[s.id][p] = status; });
  renderAttendance();
}
$("saveAttendance").addEventListener("click", async () => {
  const records = [];
  students.forEach(s => { for (let p=1;p<=7;p++) records.push({ studentId:s.id, period:p, status:attendance[s.id]?.[p] || null }); });
  try {
    const result = await (await api("/api/attendance", { method:"PUT", body:JSON.stringify({ date:$("attendanceDate").value, records }) })).json();
    showMessage("dailyMessage", `${result.message} (${result.savedRecords} cells processed)`);
  } catch (e) { showMessage("dailyMessage", e.message, true); }
});
async function generateReport() {
  try {
    const month = $("reportMonth").value, threshold = Number($("threshold").value);
    if (!month) throw new Error("Select a month.");
    if (!Number.isFinite(threshold) || threshold < 0 || threshold > 100) throw new Error("Threshold must be between 0 and 100.");
    const data = await (await api(`/api/reports/monthly?month=${encodeURIComponent(month)}&threshold=${threshold}`)).json();
    const rows = data.students;
    $("reportTable").querySelector("tbody").innerHTML = rows.map(s => `<tr><td>${escapeHtml(s.rollNo)}</td><td>${escapeHtml(s.name)}</td><td>${s.workingPeriods}</td><td>${s.present}</td><td>${s.absent}</td><td class="attendance-value ${s.belowThreshold ? "low" : "good"}">${s.percentage.toFixed(2)}%</td><td><span class="pill ${s.belowThreshold ? "absent" : "present"}">${s.workingPeriods ? (s.belowThreshold ? "Below threshold" : "On track") : "No records"}</span></td></tr>`).join("");
    $("studentStat").textContent = rows.length;
    const withRecords = rows.filter(s => s.workingPeriods);
    $("averageStat").textContent = withRecords.length ? `${(withRecords.reduce((sum,s)=>sum+s.percentage,0)/withRecords.length).toFixed(1)}%` : "—";
    $("lowStat").textContent = rows.filter(s=>s.belowThreshold).length;
    showMessage("reportMessage", `Report generated for ${month}.`);
  } catch (e) { showMessage("reportMessage", e.message, true); }
}
$("generateReport").addEventListener("click", generateReport);
$("exportCsv").addEventListener("click", () => {
  if (!$("reportMonth").value) return showMessage("reportMessage", "Select a month before exporting.", true);
  window.location.href = `/api/reports/monthly.csv?month=${encodeURIComponent($("reportMonth").value)}`;
});
$("studentForm").addEventListener("submit", async e => {
  e.preventDefault();
  try {
    await api("/api/students", { method:"POST", body:JSON.stringify({ rollNo:$("rollNo").value, name:$("studentName").value, department:$("department").value }) });
    $("studentForm").reset(); $("department").value = "CSE";
    await loadStudents();
    showMessage("studentMessage", "Student added successfully.");
  } catch (err) { showMessage("studentMessage", err.message, true); }
});
document.querySelectorAll(".tab").forEach(tab => tab.addEventListener("click", () => {
  document.querySelectorAll(".tab").forEach(t=>t.classList.toggle("active", t===tab));
  ["daily","monthly","students"].forEach(name => $(`${name}Panel`).classList.toggle("hidden", name !== tab.dataset.tab));
  if (tab.dataset.tab === "monthly") generateReport();
}));
loadStudents().catch(e => showMessage("dailyMessage", e.message, true));
