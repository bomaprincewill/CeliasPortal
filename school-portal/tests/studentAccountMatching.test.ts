import assert from "node:assert/strict";
import test from "node:test";
import { allocateAdmissionNumbers, matchRoster, rosterClass, type ExistingPupil, type RosterPupil } from "../lib/studentAccountMatching";

const pupil = (fullName: string): RosterPupil => ({ fullName, sourceNumber: 1, gender: "MALE", sourceClass: "BASIC 2" });
const student = (id: string, firstName: string, lastName: string, middleName: string | null = null): ExistingPupil => ({ id, firstName, lastName, middleName, studentId: `CIS2025/${id}`, isActive: true, status: "ACTIVE", _count: { results: 10 } });

test("matches reordered names and punctuation while retaining the existing identity", () => {
  const result = matchRoster([pupil("JAMES-SMITH OLIVER")], [student("1234", "OLIVER", "SMITH", "JAMES")]);
  assert.equal(result[0].matchedId, "1234");
  assert.equal(result[0].method, "EXACT");
});
test("accepts omitted middle names and initials", () => {
  const result = matchRoster([pupil("MARY-ANNE C. MORGAN")], [student("1234", "MARY-ANNE", "MORGAN")]);
  assert.equal(result[0].matchedId, "1234");
});
test("does not match siblings using a surname or similar spelling alone", () => {
  const result = matchRoster([pupil("PETER SMITH-JONES"), pupil("MARIAN JAMES MILLER")], [student("1234", "ALICE", "SMITH-JONES"), student("5678", "MARION", "JAMES-MILLER")]);
  assert.ok(result.every(item => item.matchedId === null));
});
test("rejects ambiguous records and duplicate roster assignments", () => {
  assert.equal(matchRoster([pupil("ADAM MORGAN")], [student("1234", "ADAM", "MORGAN", "JAMES"), student("5678", "ADAM", "MORGAN", "HENRY")])[0].reason, "AMBIGUOUS");
  const result = matchRoster([pupil("OLIVER SMITH"), pupil("SMITH JAMES OLIVER")], [student("1234", "OLIVER", "SMITH")]);
  assert.ok(result.every(item => item.matchedId === null && item.reason === "ROSTER_COLLISION"));
});
test("requires an active student with an admission number backed by imported results", () => {
  for (const extra of [{ isActive: false }, { status: "GRADUATED" }, { _count: { results: 0 } }, { studentId: "STU/DEMO/1234" }]) {
    assert.equal(matchRoster([pupil("OLIVER SMITH")], [{ ...student("1234", "OLIVER", "SMITH"), ...extra }])[0].matchedId, null);
  }
});

test("allocates unique admission numbers after the existing current-year range", () => {
  assert.deepEqual(allocateAdmissionNumbers(["CIS2025/9999", "CIS2026/9237", "CIS2026/2924"], 3, 2026), ["CIS2026/9238", "CIS2026/9239", "CIS2026/9240"]);
  assert.deepEqual(allocateAdmissionNumbers([], 2, 2026), ["CIS2026/0001", "CIS2026/0002"]);
  assert.throws(() => allocateAdmissionNumbers(["CIS2026/9999"], 1, 2026), /exhausted/);
});

test("maps roster classes to the portal grades and preserves arms", () => {
  assert.deepEqual(rosterClass("BASIC 1/LAVENDER/TRANSION"), { name: "Year 1", arm: "A", level: "primary" });
  assert.deepEqual(rosterClass("BASIC 3 PEARL"), { name: "Year 3", arm: "Pearl", level: "primary" });
  assert.deepEqual(rosterClass("JSS 1B"), { name: "Year 7", arm: "B", level: "secondary" });
  assert.deepEqual(rosterClass("SS 3"), { name: "Year 12", arm: "A", level: "secondary" });
  assert.deepEqual(rosterClass("GLORIOUS STAR V"), { name: "Glorious Star", arm: "V", level: "nursery" });
  assert.throws(() => rosterClass("unknown"), /Unmapped/);
});
