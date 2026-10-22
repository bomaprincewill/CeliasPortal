import assert from "node:assert/strict";
import test from "node:test";
import { planPortalLoginDomain, updatedPortalLogin } from "../lib/portalLoginDomain";

test("replaces the full old domain while retaining names and collision suffixes", () => {
  assert.equal(updatedPortalLogin("ALICE.MORGAN@CELIAS-PORTAL"), "alice.morgan@celiasportal.com");
  assert.equal(updatedPortalLogin("alice.morgan2@celias-portal"), "alice.morgan2@celiasportal.com");
  assert.equal(updatedPortalLogin("alice.morgan@celiasportal.com"), "alice.morgan@celiasportal.com");
});
test("does not rewrite unrelated email addresses or partially matching domains", () => {
  for (const email of ["owner@example.com", "alice@celias-portal.example.com", "person@school.edu"]) assert.equal(updatedPortalLogin(email), email);
});
test("refuses conflicts with accounts already using the new domain", () => {
  assert.throws(() => planPortalLoginDomain([{ id: "one", email: "alice@celias-portal" }, { id: "two", email: "ALICE@CELIASPORTAL.COM" }]), /already in use/);
});
test("plans each legacy account once and makes repeat runs a no-op", () => {
  const users = [{ id: "one", email: "alice@celias-portal" }, { id: "two", email: "admin@example.com" }];
  assert.deepEqual(planPortalLoginDomain(users), [{ userId: "one", oldLogin: "alice@celias-portal", newLogin: "alice@celiasportal.com" }]);
  assert.deepEqual(planPortalLoginDomain(users.map(user => ({ ...user, email: updatedPortalLogin(user.email) }))), []);
});
