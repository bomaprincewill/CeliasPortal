import { PORTAL_LOGIN_DOMAIN } from "./portalLoginDomain";

export const administratorRecoveryMessage = "For a portal login, contact the school administrator for a secure, one-time password setup link. Your portal login is not an email inbox.";

export function usesAdministratorRecovery(login: string) {
  const domain = login.trim().toLowerCase().split("@")[1];
  return domain === PORTAL_LOGIN_DOMAIN || domain === "celias-portal";
}
