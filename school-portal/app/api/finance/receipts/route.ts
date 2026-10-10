import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { writeAuditLog } from "@/lib/audit";
import { receiptValidationMessage, validateReceipt, validateReceiptDelete, validateReceiptUpdate, type ReceiptInput } from "@/lib/receiptValidation";
import { Prisma } from "@prisma/client";

const roles = new Set(["SUPER_ADMIN", "BURSAR_ACCOUNTANT", "SECRETARY"]);
async function authorizedSession() {
  const session = await getSession();
  return session && roles.has(session.user.role) ? session : null;
}
const output = (r: any) => ({ id:r.id, receipt_number:r.receiptNumber, date:r.date.toISOString().slice(0,10), student_name:r.studentName, grade:r.grade, term:r.term, admission_number:r.admissionNumber, parent_name:r.parentName, payment_method:r.paymentMethod, cheque_number:r.chequeNumber, total_amount:Number(r.totalAmount), balance_total:Number(r.balanceTotal), fee_items:r.feeItems, balance_payments:r.balancePayments, created_at:r.createdAt.toISOString() });
const input = (body: ReceiptInput) => ({ receiptNumber:body.receipt_number, date:new Date(`${body.date}T00:00:00.000Z`), studentName:body.student_name, grade:body.grade, term:body.term, admissionNumber:body.admission_number, parentName:body.parent_name, paymentMethod:body.payment_method ?? "Cash", chequeNumber:body.cheque_number || null, totalAmount:body.total_amount, balanceTotal:body.balance_total, feeItems:body.fee_items as Prisma.InputJsonValue, balancePayments:body.balance_payments as Prisma.InputJsonValue });
const invalid = (message: string) => NextResponse.json({ error: message }, { status: 400 });
const failure = (error: unknown) => {
  if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") return NextResponse.json({ error: "That receipt number already exists." }, { status: 409 });
  if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2025") return NextResponse.json({ error: "Receipt not found." }, { status: 404 });
  return NextResponse.json({ error: "Receipt request could not be completed." }, { status: 500 });
};

export async function GET(req: NextRequest) {
  const session = await authorizedSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const search = req.nextUrl.searchParams.get("search")?.trim().slice(0, 160);
  const cursor = Number(req.nextUrl.searchParams.get("cursor") ?? 0);
  if (!Number.isSafeInteger(cursor) || cursor < 0) return invalid("Invalid receipt cursor.");
  const rows = await prisma.receiptRecord.findMany({
    where: { ...(search ? { studentName: { contains: search, mode: "insensitive" as const } } : {}), ...(cursor ? { id: { lt: cursor } } : {}) },
    orderBy: { id: "desc" }, take: 101,
  });
  const items = rows.slice(0, 100);
  return NextResponse.json({ items: items.map(output), nextCursor: rows.length > 100 ? items.at(-1)!.id : null });
}

export async function POST(req: NextRequest) {
  const session = await authorizedSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const parsed = validateReceipt(await req.json().catch(() => null));
  if (!parsed.success) return invalid(receiptValidationMessage(parsed.error));
  try {
    const row = await prisma.receiptRecord.create({ data: input(parsed.data) });
    await writeAuditLog({ userId: session.user.id, action: "CREATE", entity: "ReceiptRecord", entityId: String(row.id), description: `Created receipt ${row.receiptNumber}`, newValue: { receiptNumber: row.receiptNumber, totalAmount: Number(row.totalAmount) } });
    return NextResponse.json([output(row)], { status: 201 });
  } catch (error) { return failure(error); }
}

export async function PATCH(req: NextRequest) {
  const session = await authorizedSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const parsed = validateReceiptUpdate(await req.json().catch(() => null));
  if (!parsed.success) return invalid(receiptValidationMessage(parsed.error));
  try {
    const { id, ...receipt } = parsed.data;
    const row = await prisma.receiptRecord.update({ where: { id }, data: input(receipt) });
    await writeAuditLog({ userId: session.user.id, action: "UPDATE", entity: "ReceiptRecord", entityId: String(row.id), description: `Updated receipt ${row.receiptNumber}`, newValue: { receiptNumber: row.receiptNumber, totalAmount: Number(row.totalAmount) } });
    return NextResponse.json([output(row)]);
  } catch (error) { return failure(error); }
}

export async function DELETE(req: NextRequest) {
  const session = await authorizedSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const parsed = validateReceiptDelete(await req.json().catch(() => null));
  if (!parsed.success) return invalid(receiptValidationMessage(parsed.error));
  try {
    const row = await prisma.receiptRecord.delete({ where: { id: parsed.data.id } });
    await writeAuditLog({ userId: session.user.id, action: "DELETE", entity: "ReceiptRecord", entityId: String(row.id), description: `Deleted receipt ${row.receiptNumber}`, oldValue: { receiptNumber: row.receiptNumber, totalAmount: Number(row.totalAmount) } });
    return NextResponse.json({ success: true });
  } catch (error) { return failure(error); }
}
