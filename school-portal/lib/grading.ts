export interface GradeBand { min: number; max: number; grade: string; gradePoint: number; remark: string }

export const GRADING_SCALE: GradeBand[] = [
  { min: 75, max: 100, grade: "A", gradePoint: 4, remark: "Distinction" },
  { min: 65, max: 74, grade: "B", gradePoint: 3.5, remark: "Credit" },
  { min: 55, max: 64, grade: "C", gradePoint: 3, remark: "Merit" },
  { min: 45, max: 54, grade: "D", gradePoint: 2, remark: "Pass" },
  { min: 40, max: 44, grade: "E", gradePoint: 1, remark: "Weak Pass" },
  { min: 0, max: 39, grade: "F", gradePoint: 0, remark: "Fail" },
];

export function assignGrade(total: number, bands: readonly GradeBand[] = GRADING_SCALE): GradeBand {
  if (!Number.isFinite(total) || total < 0 || total > 100 || !bands.length) throw new Error("Invalid score or grading scale.");
  // Whole-number upper bounds are display labels; lower thresholds classify decimals.
  return [...bands].sort((a, b) => b.min - a.min).find(band => total >= band.min) ?? bands[bands.length - 1];
}

export function configuredGradeBands(bands: { grade: string; minScore: number; maxScore: number; remark: string }[]): GradeBand[] {
  return bands.length ? bands.map(band => ({ min: band.minScore, max: band.maxScore, grade: band.grade,
    gradePoint: GRADING_SCALE.find(item => item.grade === band.grade)?.gradePoint ?? 0, remark: band.remark })) : GRADING_SCALE;
}
