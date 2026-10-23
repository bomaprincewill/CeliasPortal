import assert from "node:assert/strict";
import test from "node:test";
import { attendanceDateSchema, attendanceInputSchema } from "../lib/attendanceValidation";
import { hasCompleteScores, resultBatchSchema } from "../lib/resultWorkflow";
import { schoolUserSchema } from "../lib/userCreationValidation";
import { usesAdministratorRecovery } from "../lib/passwordRecovery";

const attendance = { classId: "class", sessionId: "session", term: "SECOND", date: "2026-10-23", rows: [{ studentId: "pupil", status: "ABSENT", note: "  Ill  " }] };

test("portal recovery uses the administrator setup-link flow without treating logins as inboxes", () => {
  for (const login of ["ALICE@CELIASPORTAL.COM", " alice@celiasportal.com ", "alice@celias-portal"]) assert.equal(usesAdministratorRecovery(login), true);
  for (const login of ["alice@example.com", "alice@celiasportal.com.example.com", "celiasportal.com", "alice@otherceliasportal.com"]) assert.equal(usesAdministratorRecovery(login), false);
});

test("attendance rejects impossible dates, invalid terms/statuses, and duplicate pupils", () => {
  assert.equal(attendanceDateSchema.safeParse("2024-02-29").success, true);
  for (const date of ["2026-02-29", "2026-02-30", "2026-13-01", "2026-1-1", "bad"]) assert.equal(attendanceDateSchema.safeParse(date).success, false, date);
  assert.equal(attendanceInputSchema.safeParse({ ...attendance, term: "FOURTH" }).success, false);
  assert.equal(attendanceInputSchema.safeParse({ ...attendance, rows: [...attendance.rows, ...attendance.rows] }).success, false);
  assert.equal(attendanceInputSchema.safeParse({ ...attendance, rows: [{ ...attendance.rows[0], status: "UNKNOWN" }] }).success, false);
});

test("attendance preserves statuses, trims notes, and bounds batch and note size", () => {
  for (const status of ["PRESENT", "ABSENT", "LATE", "EXCUSED"]) {
    const saved = attendanceInputSchema.parse({ ...attendance, rows: [{ ...attendance.rows[0], status }] });
    assert.equal(saved.rows[0].status, status);
    assert.equal(saved.rows[0].note, "Ill");
  }
  assert.equal(attendanceInputSchema.safeParse({ ...attendance, rows: [] }).success, false);
  assert.equal(attendanceInputSchema.safeParse({ ...attendance, rows: [{ ...attendance.rows[0], note: "x".repeat(501) }] }).success, false);
});

const scores = { ca1: 0, ca2: 10, ca3: 8, examScore: 0, maxCA1: 10, maxCA2: 10, maxCA3: 10, maxExam: 70 };

test("zero scores are complete; missing enabled components cannot be approved", () => {
  assert.equal(hasCompleteScores(scores), true);
  for (const component of ["ca1", "ca2", "ca3", "examScore"]) {
    assert.equal(hasCompleteScores({ ...scores, [component]: null }), false, component);
    assert.equal(hasCompleteScores({ ...scores, [component]: NaN }), false, component);
    assert.equal(hasCompleteScores({ ...scores, [component]: -1 }), false, component);
  }
  assert.equal(hasCompleteScores({ ...scores, examScore: 71 }), false);
  assert.equal(hasCompleteScores({ ...scores, maxCA3: 0, ca3: null }), true);
  assert.equal(hasCompleteScores({ ...scores, maxCA3: 0, ca3: 1 }), false);
});

test("result review requires every batch dimension and a supported term", () => {
  const batch = { classId: "class", sessionId: "session", subjectId: "subject", term: "THIRD" };
  assert.equal(resultBatchSchema.safeParse(batch).success, true);
  for (const field of Object.keys(batch)) assert.equal(resultBatchSchema.safeParse({ ...batch, [field]: "" }).success, false, field);
});

const teacher = { name: "Alice Morgan", email: "ALICE@CELIASPORTAL.COM", password: "Password12345", role: "SUBJECT_TEACHER", classId: "class", subjectIds: ["maths"] };

test("school accounts normalize login and reject unsupported roles and weak initial passwords", () => {
  assert.equal(schoolUserSchema.parse(teacher).email, "alice@celiasportal.com");
  assert.equal(schoolUserSchema.safeParse({ ...teacher, role: "UNRESTRICTED" }).success, false);
  assert.equal(schoolUserSchema.safeParse({ ...teacher, password: "short" }).success, false);
  assert.equal(schoolUserSchema.safeParse({ ...teacher, classId: "" }).success, false);
  assert.equal(schoolUserSchema.safeParse({ ...teacher, subjectIds: ["maths", "maths"] }).success, false);
  assert.equal(schoolUserSchema.safeParse({ ...teacher, role: "ADMIN" }).success, false);
});

test("learner creation requires real identity and admission details rather than inventing them", () => {
  const pupil = { ...teacher, role: "STUDENT", subjectIds: [], firstName: "Alice", lastName: "Morgan", admissionNumber: "CIS2026/1234", gender: "FEMALE" };
  assert.equal(schoolUserSchema.safeParse(pupil).success, true);
  for (const field of ["firstName", "lastName", "admissionNumber", "gender", "classId"]) assert.equal(schoolUserSchema.safeParse({ ...pupil, [field]: "" }).success, false, field);
  assert.equal(schoolUserSchema.safeParse({ ...pupil, dateOfBirth: "2026-02-30" }).success, false);
});
