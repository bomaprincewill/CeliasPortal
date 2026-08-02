/** @type {import('next').NextConfig} */
const allowedOrigins = (process.env.SERVER_ACTION_ALLOWED_ORIGINS ?? "localhost:3000")
  .split(",").map(value => value.trim()).filter(Boolean);
const isProduction = process.env.NODE_ENV === "production";

const securityHeaders = [
  { key: "Content-Security-Policy", value: `default-src 'self'; base-uri 'self'; form-action 'self'; frame-ancestors 'none'; object-src 'none'; img-src 'self' data: blob: https:; font-src 'self' data:; style-src 'self' 'unsafe-inline'; script-src 'self' 'unsafe-inline'${isProduction ? "" : " 'unsafe-eval'"}; connect-src 'self' https:${isProduction ? "; upgrade-insecure-requests" : " http: ws:"}` },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
  ...(isProduction ? [{ key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains; preload" }] : []),
];

const nextConfig = {
  experimental: { serverActions: { allowedOrigins } },
  images: { remotePatterns: [] },
  serverExternalPackages: ["read-excel-file", "unzipper"],
  poweredByHeader: false,
  async headers() { return [{ source: "/(.*)", headers: securityHeaders }]; },
};
export default nextConfig;
