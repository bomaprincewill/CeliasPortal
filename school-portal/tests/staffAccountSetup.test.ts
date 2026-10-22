import assert from "node:assert/strict";
import test from "node:test";
import { allocateEmployeeIds, matchStaff, staffRole, type StaffRosterEntry } from "../lib/staffAccountSetup";

const entry = (fullName: string, sourceNumber = 1): StaffRosterEntry => ({ sourceNumber, fullName, gender: "FEMALE", position: "TEACHER", sourceEmail: "" });

test("matches reordered names and additional names without matching a first name alone", () => {
  const result = matchStaff([entry("MORGAN ALICE JANE"), entry("HENRY JAMES", 2)], [{ id: "one", name: "Alice Morgan" }, { id: "two", name: "Henry" }]);
  assert.equal(result[0].userId, "one");
  assert.equal(result[1].userId, null);
});
test("accepts reviewed identities and refuses duplicate matches", () => {
  assert.equal(matchStaff([entry("ALICE MORGAN")], [{ id: "one", name: "Alice" }], new Map([[1, "one"]]))[0].method, "REVIEWED");
  assert.throws(() => matchStaff([entry("ALICE MORGAN"), entry("MORGAN ALICE", 2)], [{ id: "one", name: "Alice Morgan" }]), /duplicate/);
  assert.throws(() => matchStaff([entry("ALICE MORGAN")], [{ id: "one", name: "Alice Morgan" }, { id: "two", name: "Alice Morgan" }]), /Ambiguous/);
});
test("keeps assistant and deputy privileges pending and does not infer Super Admin", () => {
  assert.equal(staffRole("ASSIST. ADMIN"), null);
  assert.equal(staffRole("VICE PRINCIPAL ADMIN./FORM TEACHER"), null);
  assert.equal(staffRole("VICE PRINCIPAL ACADEMICS/TEACHER", "SUBJECT_TEACHER"), null);
  assert.equal(staffRole("ADMIN."), "ADMIN");
  assert.throws(() => staffRole("SUPER ADMIN"), /Unmapped/);
});
test("maps supported staff positions and preserves existing form-teacher responsibilities", () => {
  assert.equal(staffRole("TEACHER", "FORM_TEACHER"), "FORM_TEACHER");
  assert.equal(staffRole("TEACHER"), "SUBJECT_TEACHER");
  assert.equal(staffRole("FORM TEACHER (SS 3)"), "FORM_TEACHER");
  assert.equal(staffRole("ACCOUNTANT"), "BURSAR_ACCOUNTANT");
  assert.equal(staffRole("PRINCIPAL/HEAD OF SCHOOL/TEACHER"), "PRINCIPAL");
  assert.equal(staffRole("NURSERY HEAD/TEACHER"), "NURSERY_HEAD");
  assert.equal(staffRole("PRY HEAD/TEACHER"), "PRIMARY_HEAD");
});
test("allocates employee IDs beyond existing IDs and ignores demo ID formats", () => {
  assert.deepEqual(allocateEmployeeIds(["TCH101", "TCH133", "DEMO-FORM-001"], 2), ["TCH134", "TCH135"]);
});
