import assert from "node:assert/strict";
import test from "node:test";
import { assignGrade, configuredGradeBands } from "../lib/grading";
import { canManageCredentials } from "../lib/accountPermissions";
import { examDeadline, attemptExpired, SUBMISSION_GRACE_MS } from "../lib/examTiming";
import { toCsv } from "../lib/csv";

test("decimal scores classify continuously at every grading boundary", () => {
  for (const [score, grade] of [[0,"F"],[39.5,"F"],[40,"E"],[44.5,"E"],[45,"D"],[54.5,"D"],[55,"C"],[64.5,"C"],[65,"B"],[74.5,"B"],[75,"A"],[100,"A"]] as const) {
    assert.equal(assignGrade(score).grade, grade, String(score));
  }
  for (const score of [NaN, Infinity, -1, 100.1]) assert.throws(() => assignGrade(score));
});

test("configured school grades override defaults without decimal gaps", () => {
  const bands = configuredGradeBands([{grade:"A",minScore:80,maxScore:100,remark:"Excellent"},{grade:"B",minScore:50,maxScore:79,remark:"Pass"},{grade:"F",minScore:0,maxScore:49,remark:"Fail"}]);
  assert.equal(assignGrade(79.9, bands).grade, "B");
  assert.equal(assignGrade(80, bands).remark, "Excellent");
  assert.equal(assignGrade(49.9, bands).grade, "F");
});

test("school admins cannot reset super admin or peer admin credentials", () => {
  const admin = { id:"admin",role:"ADMIN" };
  assert.equal(canManageCredentials(admin,{id:"super",role:"SUPER_ADMIN"}),false);
  assert.equal(canManageCredentials(admin,{id:"peer",role:"ADMIN"}),false);
  assert.equal(canManageCredentials(admin,admin),true);
  assert.equal(canManageCredentials(admin,{id:"teacher",role:"FORM_TEACHER"}),true);
  assert.equal(canManageCredentials({id:"super",role:"SUPER_ADMIN"},admin),true);
  assert.equal(canManageCredentials({id:"teacher",role:"FORM_TEACHER"},admin),false);
});

test("exam deadline is anchored to reserved start, including reload and scheduled closure", () => {
  const start = new Date("2026-10-10T10:00:00Z");
  const end = new Date("2026-10-10T12:00:00Z");
  const deadline = examDeadline(start,30,end);
  assert.equal(deadline.toISOString(),"2026-10-10T10:30:00.000Z");
  assert.equal(examDeadline(start,30,end).getTime(),deadline.getTime());
  assert.equal(examDeadline(start,180,end).getTime(),end.getTime());
  assert.equal(attemptExpired(deadline,new Date(deadline.getTime()+SUBMISSION_GRACE_MS)),false);
  assert.equal(attemptExpired(deadline,new Date(deadline.getTime()+SUBMISSION_GRACE_MS+1)),true);
});

test("CSV export escapes names and blocks spreadsheet formula injection", () => {
  assert.equal(toCsv([["Doe, Jane",'A "quote"',75]]),'\uFEFF"Doe, Jane","A ""quote""","75"');
  for (const value of ["=1+1"," +cmd","-1+1","@SUM(A1)","\tunsafe"]) assert.ok(toCsv([[value]]).startsWith('\uFEFF"\''));
});
