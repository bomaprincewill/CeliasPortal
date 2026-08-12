import { z } from "zod";

const receiptItemSchema = z.record(z.string(), z.unknown());

const receiptFields = {
  receipt_number: z.string().trim().min(1).max(100),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Enter a valid receipt date."),
  student_name: z.string().trim().min(1).max(160),
  grade: z.string().trim().min(1).max(80),
  term: z.string().trim().min(1).max(80),
  admission_number: z.string().trim().min(1).max(100),
  parent_name: z.string().trim().min(1).max(160),
  payment_method: z.string().trim().min(1).max(80).optional(),
  cheque_number: z.string().trim().max(100).nullable().optional(),
  total_amount: z.coerce.number().finite().min(0).max(99_999_999),
  balance_total: z.coerce.number().finite().min(0).max(99_999_999).default(0),
  fee_items: z.array(receiptItemSchema).max(200).default([]),
  balance_payments: z.array(receiptItemSchema).max(200).default([]),
};

const receiptSchema = z.object(receiptFields);
const receiptUpdateSchema = receiptSchema.extend({ id: z.coerce.number().int().positive() });
const receiptDeleteSchema = z.object({ id: z.coerce.number().int().positive() });

export type ReceiptInput = z.infer<typeof receiptSchema>;

export function validateReceipt(body: unknown) {
  return receiptSchema.safeParse(body);
}

export function validateReceiptUpdate(body: unknown) {
  return receiptUpdateSchema.safeParse(body);
}

export function validateReceiptDelete(body: unknown) {
  return receiptDeleteSchema.safeParse(body);
}

export function receiptValidationMessage(error: z.ZodError) {
  return error.issues[0]?.message ?? "Receipt details are invalid.";
}
