import assert from "node:assert/strict";
import test from "node:test";
import { authOptions } from "../lib/auth";
import { prisma } from "../lib/prisma";
import { credentialTag } from "../lib/sessionCredentials";

process.env.NEXTAUTH_SECRET ||= "test-only-secret-for-session-regression-checks";

test("client session updates cannot inject teacher permissions", async () => {
  const original = prisma.user.findUnique;
  prisma.user.findUnique = (async () => ({ id:"teacher", name:"Teacher", email:"teacher@example.com", passwordHash:"current-hash", role:"FORM_TEACHER", isActive:true, teacher:{formClassId:"actual",assignments:[{classId:"actual",subjectId:"math"}]}, parent:null })) as never;
  try {
  const token = await authOptions.callbacks!.jwt!({ token:{sub:"teacher",credentialTag:credentialTag("current-hash"),role:"SUPER_ADMIN",formClassId:"forged"}, trigger:"update", session:{role:"SUPER_ADMIN",formClassId:"forged",assignedClassIds:["forged"]} } as never);
  assert.equal(token.role,"FORM_TEACHER");
  assert.equal(token.formClassId,"actual");
  assert.deepEqual(token.assignedClassIds,["actual"]);
  } finally { prisma.user.findUnique = original; }
});

test("server sessions reject deactivated accounts even with a valid old token", async () => {
  const original = prisma.user.findUnique;
  prisma.user.findUnique = (async () => ({ isActive:false })) as never;
  try {
  const session = await authOptions.callbacks!.session!({ token:{sub:"teacher",role:"SUPER_ADMIN"},session:{user:{},expires:"2099-01-01"} } as never);
  assert.equal(session,null);
  } finally { prisma.user.findUnique = original; }
});

test("password changes revoke old and legacy sessions while a fresh login works", async () => {
  const original = prisma.user.findUnique;
  prisma.user.findUnique = (async () => ({ id: "teacher", name: "Teacher", email: "teacher@example.com", role: "FORM_TEACHER", isActive: true, passwordHash: "new-hash", teacher: null, parent: null })) as never;
  try {
    for (const tag of [undefined, credentialTag("old-hash")]) {
      const session = await authOptions.callbacks!.session!({ token: { sub: "teacher", credentialTag: tag }, session: { user: {}, expires: "2099-01-01" } } as never);
      assert.equal(session, null);
      const updated = await authOptions.callbacks!.jwt!({ token: { sub: "teacher", credentialTag: tag }, trigger: "update", session: { credentialTag: credentialTag("new-hash") } } as never);
      assert.deepEqual(updated, {});
    }
    const token = await authOptions.callbacks!.jwt!({ token: { sub: "teacher" }, user: { role: "FORM_TEACHER", credentialTag: credentialTag("new-hash") } } as never);
    const session = await authOptions.callbacks!.session!({ token, session: { user: {}, expires: "2099-01-01" } } as never);
    assert.ok("id" in session.user);
    assert.equal(session.user.id, "teacher");
    assert.equal("credentialTag" in session.user, false);
    assert.equal("passwordHash" in session.user, false);
  } finally { prisma.user.findUnique = original; }
});
