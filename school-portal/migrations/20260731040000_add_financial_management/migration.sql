ALTER TYPE "Role" ADD VALUE IF NOT EXISTS 'BURSAR_ACCOUNTANT';
ALTER TYPE "Role" ADD VALUE IF NOT EXISTS 'SECRETARY';
CREATE TYPE "InvoiceStatus" AS ENUM ('DRAFT','ISSUED','PARTIALLY_PAID','PAID','OVERDUE','VOID');
CREATE TYPE "PaymentMethod" AS ENUM ('CASH','BANK_TRANSFER','POS','ONLINE');
CREATE TYPE "PaymentStatus" AS ENUM ('POSTED','REVERSED');
CREATE TYPE "ReversalStatus" AS ENUM ('REQUESTED','APPROVED','REJECTED');

CREATE TABLE "fee_schedules" (
  "id" TEXT NOT NULL, "name" TEXT NOT NULL, "description" TEXT, "sessionId" TEXT NOT NULL,
  "term" "Term" NOT NULL, "classId" TEXT, "amount" DECIMAL(12,2) NOT NULL, "dueDate" DATE,
  "isActive" BOOLEAN NOT NULL DEFAULT true, "createdById" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "fee_schedules_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "fee_schedules_name_sessionId_term_classId_key" ON "fee_schedules"("name","sessionId","term","classId");
CREATE INDEX "fee_schedules_sessionId_term_classId_isActive_idx" ON "fee_schedules"("sessionId","term","classId","isActive");
ALTER TABLE "fee_schedules" ADD CONSTRAINT "fee_schedules_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "academic_sessions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "fee_schedules" ADD CONSTRAINT "fee_schedules_classId_fkey" FOREIGN KEY ("classId") REFERENCES "classes"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE TABLE "invoices" (
  "id" TEXT NOT NULL, "invoiceNo" TEXT NOT NULL, "studentId" TEXT NOT NULL, "sessionId" TEXT NOT NULL,
  "term" "Term" NOT NULL, "status" "InvoiceStatus" NOT NULL DEFAULT 'DRAFT', "issueDate" DATE NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "dueDate" DATE, "totalAmount" DECIMAL(12,2) NOT NULL, "note" TEXT, "issuedById" TEXT NOT NULL,
  "voidedAt" TIMESTAMP(3), "voidedById" TEXT, "voidReason" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "invoices_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "invoices_invoiceNo_key" ON "invoices"("invoiceNo");
CREATE UNIQUE INDEX "invoices_studentId_sessionId_term_key" ON "invoices"("studentId","sessionId","term");
CREATE INDEX "invoices_status_dueDate_idx" ON "invoices"("status","dueDate");
CREATE INDEX "invoices_studentId_createdAt_idx" ON "invoices"("studentId","createdAt");
ALTER TABLE "invoices" ADD CONSTRAINT "invoices_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "students"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "invoices" ADD CONSTRAINT "invoices_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "academic_sessions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE TABLE "invoice_items" (
  "id" TEXT NOT NULL, "invoiceId" TEXT NOT NULL, "feeScheduleId" TEXT, "description" TEXT NOT NULL,
  "quantity" INTEGER NOT NULL DEFAULT 1, "unitAmount" DECIMAL(12,2) NOT NULL, "amount" DECIMAL(12,2) NOT NULL,
  CONSTRAINT "invoice_items_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "invoice_items_invoiceId_idx" ON "invoice_items"("invoiceId");
ALTER TABLE "invoice_items" ADD CONSTRAINT "invoice_items_invoiceId_fkey" FOREIGN KEY ("invoiceId") REFERENCES "invoices"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "invoice_items" ADD CONSTRAINT "invoice_items_feeScheduleId_fkey" FOREIGN KEY ("feeScheduleId") REFERENCES "fee_schedules"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE TABLE "payments" (
  "id" TEXT NOT NULL, "receiptNo" TEXT NOT NULL, "studentId" TEXT NOT NULL, "amount" DECIMAL(12,2) NOT NULL,
  "method" "PaymentMethod" NOT NULL, "reference" TEXT, "payerName" TEXT, "note" TEXT, "paidAt" TIMESTAMP(3) NOT NULL,
  "recordedById" TEXT NOT NULL, "status" "PaymentStatus" NOT NULL DEFAULT 'POSTED', "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "payments_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "payments_receiptNo_key" ON "payments"("receiptNo");
CREATE UNIQUE INDEX "payments_reference_key" ON "payments"("reference");
CREATE INDEX "payments_studentId_paidAt_idx" ON "payments"("studentId","paidAt");
CREATE INDEX "payments_status_paidAt_idx" ON "payments"("status","paidAt");
ALTER TABLE "payments" ADD CONSTRAINT "payments_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "students"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE TABLE "payment_allocations" (
  "id" TEXT NOT NULL, "paymentId" TEXT NOT NULL, "invoiceId" TEXT NOT NULL, "amount" DECIMAL(12,2) NOT NULL,
  CONSTRAINT "payment_allocations_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "payment_allocations_paymentId_invoiceId_key" ON "payment_allocations"("paymentId","invoiceId");
CREATE INDEX "payment_allocations_invoiceId_idx" ON "payment_allocations"("invoiceId");
ALTER TABLE "payment_allocations" ADD CONSTRAINT "payment_allocations_paymentId_fkey" FOREIGN KEY ("paymentId") REFERENCES "payments"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "payment_allocations" ADD CONSTRAINT "payment_allocations_invoiceId_fkey" FOREIGN KEY ("invoiceId") REFERENCES "invoices"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE TABLE "payment_reversals" (
  "id" TEXT NOT NULL, "paymentId" TEXT NOT NULL, "reason" TEXT NOT NULL, "status" "ReversalStatus" NOT NULL DEFAULT 'REQUESTED',
  "requestedById" TEXT NOT NULL, "requestedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "reviewedById" TEXT, "reviewedAt" TIMESTAMP(3), "reviewNote" TEXT,
  CONSTRAINT "payment_reversals_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "payment_reversals_paymentId_key" ON "payment_reversals"("paymentId");
CREATE INDEX "payment_reversals_status_requestedAt_idx" ON "payment_reversals"("status","requestedAt");
ALTER TABLE "payment_reversals" ADD CONSTRAINT "payment_reversals_paymentId_fkey" FOREIGN KEY ("paymentId") REFERENCES "payments"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
