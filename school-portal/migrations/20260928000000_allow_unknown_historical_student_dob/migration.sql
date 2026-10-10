-- Historical result sheets do not contain student dates of birth. Keep those
-- profiles accurate by allowing the field to remain unrecorded until supplied.
ALTER TABLE "students" ALTER COLUMN "dateOfBirth" DROP NOT NULL;
