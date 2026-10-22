export const PORTAL_LOGIN_DOMAIN = "celiasportal.com";
const PREVIOUS_LOGIN_DOMAIN = "celias-portal";

export function updatedPortalLogin(login: string) {
  const normalized = login.trim().toLowerCase();
  const suffix = `@${PREVIOUS_LOGIN_DOMAIN}`;
  return normalized.endsWith(suffix) ? `${normalized.slice(0, -suffix.length)}@${PORTAL_LOGIN_DOMAIN}` : login;
}

export function planPortalLoginDomain(users: { id: string; email: string }[]) {
  const occupied = new Map<string, string>();
  const changes: { userId: string; oldLogin: string; newLogin: string }[] = [];
  for (const user of users) {
    const login = updatedPortalLogin(user.email);
    const owner = occupied.get(login.toLowerCase());
    if (owner && owner !== user.id) throw new Error("A proposed portal login is already in use; resolve the duplicate before updating accounts.");
    occupied.set(login.toLowerCase(), user.id);
    if (login !== user.email) changes.push({ userId: user.id, oldLogin: user.email, newLogin: login });
  }
  return changes;
}
