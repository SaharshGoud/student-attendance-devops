const test = require("node:test");
const assert = require("node:assert/strict");

test("attendance percentage formula is correct", () => {
  const present = 140;
  const working = 154;
  const percentage = Number((present / working * 100).toFixed(2));
  assert.equal(percentage, 90.91);
});

test("seven periods are represented", () => {
  const periods = Array.from({ length: 7 }, (_, i) => i + 1);
  assert.deepEqual(periods, [1, 2, 3, 4, 5, 6, 7]);
});
