import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

const roles = new Set(["SUPER_ADMIN", "BURSAR_ACCOUNTANT", "SECRETARY"]);
async function allowed() { const session = await getSession(); return !!session && roles.has(session.user.role); }
const output = (r: any) => ({ id:r.id, receipt_number:r.receiptNumber, date:r.date.toISOString().slice(0,10), student_name:r.studentName, grade:r.grade, term:r.term, admission_number:r.admissionNumber, parent_name:r.parentName, payment_method:r.paymentMethod, cheque_number:r.chequeNumber, total_amount:Number(r.totalAmount), balance_total:Number(r.balanceTotal), fee_items:r.feeItems, balance_payments:r.balancePayments, created_at:r.createdAt.toISOString() });
const input = (b:any) => ({ receiptNumber:b.receipt_number, date:new Date(`${b.date}T00:00:00.000Z`), studentName:b.student_name, grade:b.grade, term:b.term, admissionNumber:b.admission_number, parentName:b.parent_name, paymentMethod:b.payment_method ?? "Cash", chequeNumber:b.cheque_number || null, totalAmount:b.total_amount, balanceTotal:b.balance_total ?? 0, feeItems:b.fee_items ?? [], balancePayments:b.balance_payments ?? [] });

export async function GET(req:NextRequest){if(!await allowed())return NextResponse.json({error:"Unauthorized"},{status:401});const search=req.nextUrl.searchParams.get("search")?.trim();const rows=await prisma.receiptRecord.findMany({where:search?{studentName:{contains:search,mode:"insensitive"}}:undefined,orderBy:{createdAt:"desc"}});return NextResponse.json(rows.map(output));}
export async function POST(req:NextRequest){if(!await allowed())return NextResponse.json({error:"Unauthorized"},{status:401});const row=await prisma.receiptRecord.create({data:input(await req.json())});return NextResponse.json([output(row)],{status:201});}
export async function PATCH(req:NextRequest){if(!await allowed())return NextResponse.json({error:"Unauthorized"},{status:401});const b=await req.json();const row=await prisma.receiptRecord.update({where:{id:Number(b.id)},data:input(b)});return NextResponse.json([output(row)]);}
export async function DELETE(req:NextRequest){if(!await allowed())return NextResponse.json({error:"Unauthorized"},{status:401});const b=await req.json();await prisma.receiptRecord.delete({where:{id:Number(b.id)}});return NextResponse.json({success:true});}
