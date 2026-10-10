import assert from "node:assert/strict";
import test from "node:test";
import { validateLaunchEnvironment } from "../lib/launchValidation";

const valid = {
  DATABASE_URL: "postgresql://app:password@database.example.com:6543/postgres",
  DIRECT_URL: "postgresql://app:password@database.example.com:5432/postgres",
  NEXTAUTH_SECRET: "a-unique-production-secret-more-than-32-characters",
  NEXTAUTH_URL: "https://school.vercel.app",
  SERVER_ACTION_ALLOWED_ORIGINS: "school.vercel.app",
  ENABLE_DEMO_QUICK_LOGIN: "false",
  EMAIL_FROM: "School <office@example.com>",
  RESEND_API_KEY: "example-key",
};

test("launch configuration rejects local URLs and mismatched server action origins", () => {
  assert.deepEqual(validateLaunchEnvironment(valid), []);
  assert.match(validateLaunchEnvironment({ ...valid, NEXTAUTH_URL: "http://localhost:3000" }).join(" "), /HTTPS/);
  assert.match(validateLaunchEnvironment({ ...valid, SERVER_ACTION_ALLOWED_ORIGINS: "https://school.vercel.app" }).join(" "), /site host/);
});

test("launch configuration rejects missing mail delivery and placeholder credentials", () => {
  const issues = validateLaunchEnvironment({ ...valid, RESEND_API_KEY: "", NEXTAUTH_SECRET: "your-super-secret-key-minimum-32-characters-long", DATABASE_URL: "", ENABLE_DEMO_QUICK_LOGIN: "true" });
  assert.ok(issues.some(issue => issue.includes("SMTP")));
  assert.ok(issues.some(issue => issue.includes("NEXTAUTH_SECRET")));
  assert.ok(issues.some(issue => issue.includes("DATABASE_URL")));
  assert.ok(issues.some(issue => issue.includes("QUICK_LOGIN")));
});
