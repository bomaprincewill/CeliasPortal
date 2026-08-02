import assert from "node:assert/strict";
import test from "node:test";
import { validateGradeBands, validateScoreConfiguration } from "../lib/settingsValidation";

test("score configuration must total 100", () => {
  assert.equal(validateScoreConfiguration({ maxCA1: 10, maxCA2: 10, maxCA3: 10, maxExam: 70 }), null);
  assert.match(validateScoreConfiguration({ maxCA1: 10, maxCA2: 10, maxCA3: 10, maxExam: 60 }) ?? "", /add up to 100/);
});

test("grade bands must fully cover 0 through 100 without gaps", () => {
  assert.equal(validateGradeBands([
    { grade: "A", min: 75, max: 100, remark: "Distinction" },
    { grade: "B", min: 40, max: 74, remark: "Pass" },
    { grade: "F", min: 0, max: 39, remark: "Fail" },
  ]), null);
  assert.match(validateGradeBands([
    { grade: "A", min: 75, max: 100, remark: "Distinction" },
    { grade: "F", min: 0, max: 39, remark: "Fail" },
  ]) ?? "", /gaps/);
});
