export function lastNameForWelcome(name: string | null | undefined, fallback = "User") {
  return name?.trim().split(/\s+/).filter(Boolean).pop() || fallback;
}
