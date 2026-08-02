export type GradeBandInput = { grade: string; min: number; max: number; remark: string };

export function validateScoreConfiguration(values: { maxCA1: number; maxCA2: number; maxCA3: number; maxExam: number }) {
  const scores = Object.values(values);
  if (scores.some(value => !Number.isFinite(value) || value < 0 || value > 100)) {
    return "Score limits must be numbers between 0 and 100.";
  }
  if (scores.reduce((sum, value) => sum + value, 0) !== 100) {
    return "Score components must add up to 100.";
  }
  return null;
}

export function validateGradeBands(bands: GradeBandInput[]) {
  if (!bands.length) return "Add at least one grade band.";
  const normalized = [...bands].sort((a, b) => a.min - b.min);
  for (const band of normalized) {
    if (!band.grade.trim() || !band.remark.trim()) return "Every grade band needs a grade and remark.";
    if (!Number.isFinite(band.min) || !Number.isFinite(band.max) || band.min < 0 || band.max > 100 || band.min > band.max) {
      return "Grade ranges must be valid values between 0 and 100.";
    }
  }
  if (normalized[0].min !== 0 || normalized.at(-1)?.max !== 100) return "Grade bands must cover scores from 0 through 100.";
  for (let index = 1; index < normalized.length; index++) {
    if (normalized[index].min !== normalized[index - 1].max + 1) return "Grade bands cannot overlap or leave gaps.";
  }
  return null;
}
