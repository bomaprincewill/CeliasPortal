export type PromotionClass = { id: string; name: string; arm: string; level: string; capacity: number };
export type PromotionDestination = { graduate: true } | { graduate: false; existing: PromotionClass | undefined; template?: PromotionClass; name: string; arm: string; level: string };

export function schoolGrade(name: string): number | null {
  const normalized = name.trim().replace(/\s+/g, " ");
  const year = /^(?:year|basic|primary)\s*(\d+)$/i.exec(normalized);
  if (year) {
    const grade = Number(year[1]);
    return grade >= 1 && grade <= (/^year/i.test(normalized) ? 12 : 6) ? grade : null;
  }
  const junior = /^jss\s*([1-3])$/i.exec(normalized);
  if (junior) return 6 + Number(junior[1]);
  const senior = /^sss?\s*([1-3])$/i.exec(normalized);
  return senior ? 9 + Number(senior[1]) : null;
}

export function nextSchoolClass(source: PromotionClass, targets: PromotionClass[], finalYear: "graduate" | "retain"): PromotionDestination {
  const grade = schoolGrade(source.name);
  if (grade === null) throw new Error(`No grade mapping is defined for ${source.name}.`);
  if (grade === 12 && finalYear === "graduate") return { graduate: true as const };
  const nextGrade = grade === 12 ? grade : grade + 1;
  const sameGrade = targets.filter(item => schoolGrade(item.name) === nextGrade);
  const exactArm = sameGrade.filter(item => item.arm.toLowerCase() === source.arm.toLowerCase());
  if (exactArm.length > 1) throw new Error(`Ambiguous destination for ${source.name} ${source.arm}.`);
  if (exactArm.length) return { graduate: false as const, existing: exactArm[0], name: exactArm[0].name, arm: exactArm[0].arm, level: exactArm[0].level };
  const template = sameGrade.find(item => item.arm === "A") ?? sameGrade[0];
  return {
    graduate: false as const,
    existing: undefined,
    template,
    name: template?.name ?? `Year ${nextGrade}`,
    arm: source.arm,
    level: nextGrade <= 6 ? "primary" : "secondary",
  };
}
