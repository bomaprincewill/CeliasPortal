CREATE TABLE "receipt_records" (
  "id" SERIAL NOT NULL,
  "receipt_number" TEXT NOT NULL,
  "date" DATE NOT NULL,
  "student_name" TEXT NOT NULL,
  "grade" TEXT NOT NULL,
  "term" TEXT NOT NULL,
  "admission_number" TEXT NOT NULL,
  "parent_name" TEXT NOT NULL,
  "payment_method" TEXT,
  "cheque_number" TEXT,
  "total_amount" DECIMAL(12,2) NOT NULL,
  "balance_total" DECIMAL(12,2) NOT NULL,
  "fee_items" JSONB NOT NULL,
  "balance_payments" JSONB NOT NULL,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "receipt_records_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "receipt_records_receipt_number_key" ON "receipt_records"("receipt_number");
CREATE INDEX "receipt_records_student_name_idx" ON "receipt_records"("student_name");
CREATE INDEX "receipt_records_grade_created_at_idx" ON "receipt_records"("grade", "created_at");
