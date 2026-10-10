import assert from "node:assert/strict";
import test from "node:test";
import { schoolGrade, nextSchoolClass } from "../lib/sessionPromotion";

const source = { id: "source", name: "Basic 3", arm: "Pearl", level: "primary", capacity: 100 };
const target = { id: "target", name: "Year 4", arm: "Pearl", level: "primary", capacity: 40 };

test("promotion maps historical Basic/JSS/SS names onto Year grades", () => {
  for (const [name, grade] of [["Basic 1", 1], ["Primary 6", 6], ["JSS 1", 7], ["JSS 3", 9], ["SS 1", 10], ["SSS 3", 12], ["Year 12", 12]] as const) assert.equal(schoolGrade(name), grade);
  for (const name of ["Basic 7", "Year 13", "Rainbow"]) assert.equal(schoolGrade(name), null);
});

test("promotion preserves the class arm and reuses an exact destination", () => {
  const plan = nextSchoolClass(source, [target], "graduate");
  assert.equal(plan.graduate, false);
  if ("existing" in plan) assert.equal(plan.existing?.id, target.id);
  const missingArm = nextSchoolClass({ ...source, arm: "Ruby" }, [target], "graduate");
  assert.equal(missingArm.graduate, false);
  if ("existing" in missingArm) {
    assert.equal(missingArm.existing, undefined);
    assert.equal(missingArm.name, "Year 4");
    assert.equal(missingArm.arm, "Ruby");
  }
});

test("primary-to-secondary transitions and final-year policy are explicit", () => {
  const transition = nextSchoolClass({ ...source, name: "Basic 6", arm: "Diamond" }, [], "graduate");
  assert.equal(transition.graduate, false);
  if ("existing" in transition) { assert.equal(transition.name, "Year 7"); assert.equal(transition.level, "secondary"); }
  assert.equal(nextSchoolClass({ ...source, name: "SS 3" }, [], "graduate").graduate, true);
  const retained = nextSchoolClass({ ...source, name: "SS 3" }, [{ ...target, name: "Year 12" }], "retain");
  assert.equal(retained.graduate, false);
  if ("existing" in retained) assert.equal(retained.name, "Year 12");
  assert.throws(() => nextSchoolClass({ ...source, name: "Rainbow" }, [], "graduate"), /No grade mapping/);
  assert.throws(() => nextSchoolClass(source, [target, { ...target, id: "duplicate", name: "Basic 4" }], "graduate"), /Ambiguous/);
});
