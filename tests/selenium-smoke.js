// Optional Selenium smoke test. Start the app first with `npm run dev`.
// Install a compatible browser/driver before running: node tests/selenium-smoke.js
const { Builder, By, until } = require("selenium-webdriver");

(async function smokeTest() {
  const driver = await new Builder().forBrowser("chrome").build();
  try {
    await driver.get("http://localhost:3000");
    await driver.wait(until.titleIs("Student Attendance Management"), 10000);
    await driver.wait(until.elementLocated(By.css("#attendanceTable tbody tr")), 10000);
    const rows = await driver.findElements(By.css("#attendanceTable tbody tr"));
    if (rows.length < 1) throw new Error("No students displayed.");
    console.log(`PASS: attendance page loaded with ${rows.length} students.`);
  } finally {
    await driver.quit();
  }
})().catch(err => { console.error(err); process.exitCode = 1; });
