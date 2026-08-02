import assert from "node:assert/strict";
import test from "node:test";
import { validateExamControls, validateManualMark } from "../lib/cbtValidation";

test("manual marks cannot exceed the question maximum", () => {
  assert.equal(validateManualMark(7.5, 10), null);
  assert.match(validateManualMark(11, 10) ?? "", /between 0 and 10/);
  assert.match(validateManualMark(-1, 10) ?? "", /between 0 and 10/);
});

test("exam controls constrain duration, pass mark, and attempts", () => {
  assert.equal(validateExamControls({ durationMinutes: 60, passMark: 50, maxAttempts: 2 }), null);
  assert.match(validateExamControls({ durationMinutes: 60, passMark: 50, maxAttempts: 0 }) ?? "", /between 1 and 10/);
});
