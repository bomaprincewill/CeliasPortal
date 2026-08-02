export function validatePromotionSelection(input: { studentIds: string[]; sourceClassId: string; targetClassId: string }) {
  if (!input.sourceClassId || !input.targetClassId) return "Select both source and destination classes.";
  if (input.sourceClassId === input.targetClassId) return "The destination class must be different from the source class.";
  if (!input.studentIds.length) return "Select at least one student.";
  if (new Set(input.studentIds).size !== input.studentIds.length) return "The student selection contains duplicates.";
  return null;
}

export function studentIdFromApplication(applicationNo: string) {
  return `STU/${applicationNo.replace(/[^a-zA-Z0-9]+/g, "/").replace(/^\/+|\/+$/g, "")}`.toUpperCase();
}
