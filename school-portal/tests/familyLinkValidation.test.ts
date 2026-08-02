import assert from "node:assert/strict";
import test from "node:test";
import { validateFamilyLinks } from "../lib/familyLinkValidation";

test("family links accept unique children and a linked primary child", () => {
  assert.equal(validateFamilyLinks(["one", "two"], "two"), null);
  assert.match(validateFamilyLinks(["one", "one"]) ?? "", /twice/);
  assert.match(validateFamilyLinks(["one"], "two") ?? "", /primary child/);
});
