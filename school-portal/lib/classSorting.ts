const naturalCollator = new Intl.Collator("en", { numeric: true, sensitivity: "base" });

export function compareClasses(
  a: { name: string; arm?: string | null },
  b: { name: string; arm?: string | null },
) {
  return naturalCollator.compare(a.name, b.name)
    || naturalCollator.compare(a.arm ?? "", b.arm ?? "");
}

/** Returns classes in human-friendly order: Year 2 before Year 10. */
export function sortClasses<T extends { name: string; arm?: string | null }>(classes: T[]): T[] {
  return [...classes].sort(compareClasses);
}
