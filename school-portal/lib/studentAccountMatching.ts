export type RosterPupil = { sourceNumber: number; fullName: string; gender: string; sourceClass: string };
export type ExistingPupil = { id: string; studentId: string; firstName: string; middleName: string | null; lastName: string; isActive: boolean; status: string; _count: { results: number } };

export function nameTokens(name: string) {
  return name.toUpperCase().replace(/[^A-Z0-9]+/g, " ").trim().split(/\s+/).filter(Boolean);
}

export function pupilName(pupil: ExistingPupil) {
  return [pupil.firstName, pupil.middleName, pupil.lastName].filter(Boolean).join(" ");
}

function nameKey(name: string) { return nameTokens(name).sort().join(" "); }
function substantiveTokens(name: string) { return nameTokens(name).filter(token => token.length > 1); }

// Full token containment permits omitted middle names, but never a shared surname alone.
function containsName(a: string, b: string) {
  const left = substantiveTokens(a), right = substantiveTokens(b);
  const shorter = left.length <= right.length ? left : right;
  const longer = left.length <= right.length ? right : left;
  if (new Set(shorter).size < 2) return false;
  const remaining = [...longer];
  return shorter.every(token => { const index = remaining.indexOf(token); if (index < 0) return false; remaining.splice(index, 1); return true; });
}

export function matchRoster(roster: RosterPupil[], students: ExistingPupil[]) {
  const eligible = students.filter(student => student.isActive && student.status === "ACTIVE" && student._count.results > 0 && /^CIS\d{4}\/\d+$/i.test(student.studentId));
  const matches = roster.map(pupil => {
    const exact = eligible.filter(student => nameKey(pupilName(student)) === nameKey(pupil.fullName));
    const candidates = exact.length ? exact : eligible.filter(student => containsName(pupil.fullName, pupilName(student)));
    return { ...pupil, method: exact.length ? "EXACT" : "MIDDLE_NAMES", matchedId: candidates.length === 1 ? candidates[0].id : null, candidates: candidates.map(s => s.id), reason: candidates.length > 1 ? "AMBIGUOUS" : candidates.length === 0 ? "NO_CONFIRMED_MATCH" : "MATCHED" };
  });
  const counts = new Map<string, number>();
  for (const match of matches) if (match.matchedId) counts.set(match.matchedId, (counts.get(match.matchedId) ?? 0) + 1);
  for (const match of matches) if (match.matchedId && counts.get(match.matchedId)! > 1) {
    match.matchedId = null;
    match.reason = "ROSTER_COLLISION";
  }
  return matches;
}

export function rosterClass(sourceClass: string) {
  const name = sourceClass.trim().toUpperCase();
  if (name === "BASIC 1/LAVENDER/TRANSION") return { name: "Year 1", arm: "A", level: "primary" };
  const primary = /^BASIC ([2-6])(?: (PEARL|RUBY|DIAMOND))?$/.exec(name);
  if (primary) return { name: `Year ${primary[1]}`, arm: primary[2] ? primary[2][0] + primary[2].slice(1).toLowerCase() : "A", level: "primary" };
  const junior = /^JSS ([1-3])([AB])?$/.exec(name);
  if (junior) return { name: `Year ${6 + Number(junior[1])}`, arm: junior[2] ?? "A", level: "secondary" };
  const senior = /^SS ([1-3])$/.exec(name);
  if (senior) return { name: `Year ${9 + Number(senior[1])}`, arm: "A", level: "secondary" };
  if (name === "ANGEL/CRECHE") return { name: "Angel/Creche", arm: "A", level: "nursery" };
  if (name === "RAINBOW") return { name: "Rainbow", arm: "A", level: "nursery" };
  const nursery = /^(GLORIOUS STAR|BRIGHT STAR) ([EVI])$/.exec(name);
  if (nursery) return { name: nursery[1] === "GLORIOUS STAR" ? "Glorious Star" : "Bright Star", arm: nursery[2], level: "nursery" };
  throw new Error(`Unmapped roster class: ${sourceClass}`);
}

export function allocateAdmissionNumbers(existing: string[], count: number, year: number) {
  const prefix = `CIS${year}/`;
  const occupied = new Set(existing.map(value => value.toUpperCase()));
  let next = Math.max(0, ...existing.filter(id => id.startsWith(prefix)).map(id => Number(id.slice(prefix.length))).filter(Number.isFinite)) + 1;
  const output: string[] = [];
  while (output.length < count) {
    if (next > 9999) throw new Error(`Admission number range exhausted for ${year}; review the school numbering format.`);
    const id = `${prefix}${String(next++).padStart(4, "0")}`;
    if (!occupied.has(id)) { output.push(id); occupied.add(id); }
  }
  return output;
}
