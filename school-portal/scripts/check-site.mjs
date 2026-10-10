const origin = process.argv[2];
if (!origin || !/^https:\/\//.test(origin)) throw new Error("Usage: node scripts/check-site.mjs https://your-site.vercel.app");
const checks = [
  ["/auth/signin", 200], ["/auth/reset-password", 200],
  ["/api/health", 200], ["/api/health/ready", 200],
  ["/admin/dashboard", 307], ["/teacher/dashboard", 307],
  ["/student/dashboard", 307], ["/parent/dashboard", 307],
  ["/finance/dashboard", 307], ["/applicant/dashboard", 307],
  ["/api/finance/receipts", 307], ["/api/cbt/exam/invalid", 307],
];
let failures = 0;
for (const [path, expected] of checks) {
  try {
    const response = await fetch(new URL(path, origin), { redirect: "manual", signal: AbortSignal.timeout(15_000) });
    let passed = response.status === expected;
    if (expected === 307) passed &&= new URL(response.headers.get("location") ?? "", origin).pathname === "/auth/signin";
    if (path === "/api/health/ready" && passed) passed &&= (await response.json()).status === "ready";
    if (path === "/auth/signin") passed &&= Boolean(response.headers.get("content-security-policy")) && response.headers.get("x-content-type-options") === "nosniff";
    console.log(`${passed ? "PASS" : "FAIL"} ${path}: HTTP ${response.status}`);
    if (!passed) failures++;
  } catch { console.log(`FAIL ${path}: request could not complete.`); failures++; }
}
console.log(`${failures} failure(s). Authenticated workflows and email delivery require separate acceptance testing.`);
process.exitCode = failures ? 1 : 0;
