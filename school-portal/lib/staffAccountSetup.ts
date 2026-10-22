import type { Role } from "@prisma/client";

export type StaffRosterEntry = { sourceNumber: number; fullName: string; gender: string; position: string; sourceEmail: string };
export type StaffIdentity = { id: string; name: string };

function tokens(name: string) {
  return name.toUpperCase().replace(/[^A-Z0-9]+/g, " ").trim().split(/\s+/)
    .filter(word => word.length > 1 && !["MR", "MRS", "MISS", "MS", "DR", "LADY"].includes(word));
}
function key(name: string) { return tokens(name).sort().join(" "); }

export function matchStaff(roster: StaffRosterEntry[], users: StaffIdentity[], reviewed: Map<number, string> = new Map()) {
  const result = roster.map(staff => {
    const reviewedId = reviewed.get(staff.sourceNumber);
    if (reviewedId) {
      if (!users.some(user => user.id === reviewedId)) throw new Error("Reviewed staff account no longer exists.");
      return { ...staff, userId: reviewedId, method: "REVIEWED", ambiguous: false };
    }
    const exact = users.filter(user => key(user.name) === key(staff.fullName));
    const candidates = exact.length ? exact : users.filter(user => {
      const a = tokens(staff.fullName), b = tokens(user.name);
      const shorter = a.length <= b.length ? a : b, longer = a.length <= b.length ? b : a;
      return new Set(shorter).size >= 2 && shorter.every(token => longer.includes(token));
    });
    return { ...staff, userId: candidates.length === 1 ? candidates[0].id : null, method: exact.length ? "EXACT" : candidates.length ? "ADDITIONAL_NAMES" : "NEW", ambiguous: candidates.length > 1 };
  });
  const assigned = result.flatMap(row => row.userId ? [row.userId] : []);
  if (result.some(row => row.ambiguous) || new Set(assigned).size !== assigned.length) throw new Error("Ambiguous or duplicate staff matches need review.");
  return result;
}

export function staffRole(position: string, currentRole?: Role): Role | null {
  const value = position.trim().toUpperCase();
  if (/ASSIST\.?\s*ADMIN|VICE PRINCIPAL/.test(value)) return null;
  if (/^ADMIN\.?$/.test(value)) return "ADMIN";
  if (value === "ACCOUNTANT") return "BURSAR_ACCOUNTANT";
  if (value.startsWith("NURSERY HEAD")) return "NURSERY_HEAD";
  if (value.startsWith("PRY HEAD")) return "PRIMARY_HEAD";
  if (value.startsWith("PRINCIPAL/")) return "PRINCIPAL";
  if (value.startsWith("FORM TEACHER")) return "FORM_TEACHER";
  if (value === "TEACHER" || value === "CORPER(TEACHER)") return currentRole === "FORM_TEACHER" ? "FORM_TEACHER" : "SUBJECT_TEACHER";
  throw new Error(`Unmapped staff position: ${position}`);
}

export function allocateEmployeeIds(existing: string[], count: number) {
  let next = Math.max(100, ...existing.map(value => /^TCH(\d+)$/.exec(value)).filter(Boolean).map(match => Number(match![1]))) + 1;
  return Array.from({ length: count }, () => `TCH${next++}`);
}
