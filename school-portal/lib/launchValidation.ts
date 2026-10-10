export function validateLaunchEnvironment(env: Record<string, string | undefined>) {
  const issues: string[] = [];
  for (const key of ["DATABASE_URL", "DIRECT_URL"]) {
    try {
      const value = new URL(env[key] ?? "");
      if (!["postgres:", "postgresql:"].includes(value.protocol) || /localhost|PROJECT_REF/.test(value.hostname) || !value.password) issues.push(`${key} needs a production PostgreSQL connection.`);
    } catch { issues.push(`${key} needs a production PostgreSQL connection.`); }
  }
  if (!env.NEXTAUTH_SECRET || env.NEXTAUTH_SECRET.length < 32 || /your-super-secret|ci-only|test-only/i.test(env.NEXTAUTH_SECRET)) issues.push("Set a unique NEXTAUTH_SECRET of at least 32 characters.");
  let site: URL | undefined;
  try {
    site = new URL(env.NEXTAUTH_URL ?? "");
    if (site.protocol !== "https:" || /^(localhost|127\.0\.0\.1)$/.test(site.hostname) || site.username || site.password || site.pathname !== "/") issues.push("NEXTAUTH_URL must be the public HTTPS site origin.");
  } catch { issues.push("NEXTAUTH_URL must be the public HTTPS site origin."); }
  const origins = (env.SERVER_ACTION_ALLOWED_ORIGINS ?? "").split(",").map(value => value.trim());
  if (!site || !origins.includes(site.host)) issues.push("SERVER_ACTION_ALLOWED_ORIGINS must include the public site host without https://.");
  if (env.ENABLE_DEMO_QUICK_LOGIN !== "false") issues.push("Set ENABLE_DEMO_QUICK_LOGIN=false for launch.");
  if (!env.EMAIL_FROM || !/[^\s<>@]+@[^\s<>@]+\.[^\s<>@]+/.test(env.EMAIL_FROM)) issues.push("Set EMAIL_FROM to a verified sender address.");
  if (!env.RESEND_API_KEY && !(env.SMTP_HOST && env.SMTP_PORT && env.SMTP_USER && env.SMTP_PASS)) issues.push("Configure Resend or complete SMTP credentials.");
  return issues;
}
