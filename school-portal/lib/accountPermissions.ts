export function canManageCredentials(actor: { id: string; role: string }, target: { id: string; role: string }) {
  if (actor.role === "SUPER_ADMIN") return true;
  if (actor.role !== "ADMIN") return false;
  return target.role !== "SUPER_ADMIN" && (target.role !== "ADMIN" || target.id === actor.id);
}
