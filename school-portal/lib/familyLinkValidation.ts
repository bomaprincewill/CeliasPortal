export function validateFamilyLinks(studentIds: string[], primaryStudentId?: string) {
  if (new Set(studentIds).size !== studentIds.length) return "A student cannot be linked twice.";
  if (primaryStudentId && !studentIds.includes(primaryStudentId)) return "The primary child must be one of the linked students.";
  return null;
}
