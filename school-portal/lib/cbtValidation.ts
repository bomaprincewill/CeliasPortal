export function validateManualMark(mark: number, maximum: number) {
  if (!Number.isFinite(mark) || mark < 0 || mark > maximum) return `Marks must be between 0 and ${maximum}.`;
  return null;
}

export function validateExamControls(input: { durationMinutes:number; passMark:number; maxAttempts:number }) {
  if (!Number.isInteger(input.durationMinutes) || input.durationMinutes < 1 || input.durationMinutes > 480) return "Duration must be between 1 and 480 minutes.";
  if (!Number.isFinite(input.passMark) || input.passMark < 0 || input.passMark > 100) return "Pass mark must be between 0 and 100.";
  if (!Number.isInteger(input.maxAttempts) || input.maxAttempts < 1 || input.maxAttempts > 10) return "Attempts must be between 1 and 10.";
  return null;
}
