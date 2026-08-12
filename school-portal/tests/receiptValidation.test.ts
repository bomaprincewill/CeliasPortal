import assert from "node:assert/strict";
import test from "node:test";
import { validateReceipt, validateReceiptDelete, validateReceiptUpdate } from "../lib/receiptValidation";

const receipt = {
  receipt_number: "RCT-001",
  date: "2026-08-06",
  student_name: "Ada Okafor",
  grade: "Primary 4",
  term: "Third Term",
  admission_number: "ADM-001",
  parent_name: "Chidi Okafor",
  total_amount: 120_000,
};

test("receipt validation accepts the client receipt payload", () => {
  assert.equal(validateReceipt(receipt).success, true);
  assert.equal(validateReceipt({ ...receipt, balance_total: "2500" }).success, true);
});

test("receipt validation rejects malformed and unsafe values", () => {
  assert.equal(validateReceipt({ ...receipt, date: "06/08/2026" }).success, false);
  assert.equal(validateReceipt({ ...receipt, total_amount: -1 }).success, false);
  assert.equal(validateReceipt({ ...receipt, fee_items: Array.from({ length: 201 }, () => ({})) }).success, false);
  assert.equal(validateReceiptUpdate({ ...receipt, id: 0 }).success, false);
  assert.equal(validateReceiptDelete({ id: "not-an-id" }).success, false);
});
