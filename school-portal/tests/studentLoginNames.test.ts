import assert from "node:assert/strict";
import test from "node:test";
import { buildStudentLogins, studentLoginBase } from "../lib/studentLoginNames";

test("uses short lowercase pupil names, preserving family name hyphens", () => {
  assert.equal(studentLoginBase("ALICE MORGAN"), "alice.morgan");
  assert.equal(studentLoginBase("  ADAM JAMES RILEY  "), "adam.riley");
  assert.equal(studentLoginBase("MARY SMITH-JONES"), "mary.smith-jones");
  assert.equal(studentLoginBase("ELLA"), "ella");
  assert.throws(() => studentLoginBase("..."), /name is required/);
});
test("avoids duplicate names and existing non-roster logins without changing the domain", () => {
  const pupils = [
    { userId: "b", fullName: "ADAM JOHN RILEY", admissionNumber: "CIS2026/0002" },
    { userId: "a", fullName: "ADAM JAMES RILEY", admissionNumber: "CIS2026/0001" },
  ];
  const result = buildStudentLogins(pupils, ["ADAM.RILEY@CELIAS-PORTAL"]);
  assert.equal(result.get("a"), "adam.riley2@celias-portal");
  assert.equal(result.get("b"), "adam.riley3@celias-portal");
  assert.deepEqual([...result], [...buildStudentLogins([...pupils].reverse(), ["ADAM.RILEY@CELIAS-PORTAL"])]);
});
test("rejects repeated account identities", () => {
  const pupil = { userId: "a", fullName: "ALICE MORGAN", admissionNumber: "CIS2026/0001" };
  assert.throws(() => buildStudentLogins([pupil, pupil], []), /Duplicate/);
});
