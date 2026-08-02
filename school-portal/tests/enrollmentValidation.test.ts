import assert from "node:assert/strict";
import test from "node:test";
import { studentIdFromApplication, validatePromotionSelection } from "../lib/enrollmentValidation";

test("promotion requires distinct classes and at least one unique student", () => {
  assert.equal(validatePromotionSelection({ sourceClassId: "old", targetClassId: "new", studentIds: ["one", "two"] }), null);
  assert.match(validatePromotionSelection({ sourceClassId: "same", targetClassId: "same", studentIds: ["one"] }) ?? "", /different/);
  assert.match(validatePromotionSelection({ sourceClassId: "old", targetClassId: "new", studentIds: [] }) ?? "", /at least one/);
  assert.match(validatePromotionSelection({ sourceClassId: "old", targetClassId: "new", studentIds: ["one", "one"] }) ?? "", /duplicates/);
});

test("student IDs are derived deterministically from application numbers", () => {
  assert.equal(studentIdFromApplication("APP/2026/0042"), "STU/APP/2026/0042");
});
