import assert from "node:assert/strict";
import test from "node:test";
import { authOptions } from "../lib/auth";
import { prisma } from "../lib/prisma";

test("client session updates cannot inject teacher permissions", async () => {
  const original = prisma.user.findUnique;
  prisma.user.findUnique = (async () => ({ id:"teacher", name:"Teacher", email:"teacher@example.com", role:"FORM_TEACHER", isActive:true, teacher:{formClassId:"actual",assignments:[{classId:"actual",subjectId:"math"}]}, parent:null })) as never;
  try {
  const token = await authOptions.callbacks!.jwt!({ token:{sub:"teacher",role:"SUPER_ADMIN",formClassId:"forged"}, trigger:"update", session:{role:"SUPER_ADMIN",formClassId:"forged",assignedClassIds:["forged"]} } as never);
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
