export type StudentLoginName = { userId: string; fullName: string; admissionNumber: string };

export function studentLoginBase(fullName: string) {
  const words = fullName.normalize("NFKD").toLowerCase().split(/\s+/)
    .map(word => word.replace(/[^a-z0-9-]/g, "").replace(/^-+|-+$/g, "")).filter(Boolean);
  if (!words.length) throw new Error("A pupil name is required to generate a login.");
  return words.length === 1 ? words[0] : `${words[0]}.${words[words.length - 1]}`;
}

export function buildStudentLogins(pupils: StudentLoginName[], reservedLogins: string[]) {
  if (new Set(pupils.map(pupil => pupil.userId)).size !== pupils.length) throw new Error("Duplicate pupil accounts in login plan.");
  const occupied = new Set(reservedLogins.map(login => login.toLowerCase()));
  const logins = new Map<string, string>();
  for (const pupil of [...pupils].sort((a, b) => a.admissionNumber.localeCompare(b.admissionNumber))) {
    const base = studentLoginBase(pupil.fullName);
    let login = `${base}@celias-portal`;
    let suffix = 2;
    while (occupied.has(login)) login = `${base}${suffix++}@celias-portal`;
    occupied.add(login);
    logins.set(pupil.userId, login);
  }
  return logins;
}
