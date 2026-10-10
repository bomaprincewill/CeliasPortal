import { loadEnvConfig } from "@next/env";
import { Resend } from "resend";
import { resolveTxt } from "node:dns/promises";

loadEnvConfig(process.cwd());
async function main() {
  const address = process.env.EMAIL_FROM?.match(/[^\s<>@]+@([^\s<>@]+\.[^\s<>@]+)/);
  if (!address || !process.env.RESEND_API_KEY) throw new Error("Configure EMAIL_FROM and RESEND_API_KEY.");
  const domain = address[1];
  const resend = new Resend(process.env.RESEND_API_KEY);
  const { data, error } = await resend.domains.list({ limit: 100 });
  if (error) {
    console.log(`UNVERIFIED Resend domain status: ${error.name}. A sending-only API key may not permit domain inspection.`);
    process.exitCode = 1;
  } else {
    const sender = data.data.find(item => item.name === domain);
    console.log(`${sender?.status === "verified" ? "PASS" : "BLOCK"} Resend sender domain ${domain}: ${sender?.status ?? "not found"}.`);
    if (sender?.status !== "verified") process.exitCode = 1;
    if (sender) {
      const details = await resend.domains.get(sender.id);
      if (details.data) {
        console.log("Required sender DNS records (public values):");
        for (const record of details.data.records) {
          console.log(JSON.stringify({ type: record.type, name: record.name, value: record.value, priority: "priority" in record ? record.priority : undefined, status: record.status }));
        }
      }
    }
  }
  const records = await resolveTxt(`resend._domainkey.${domain}`).catch(() => []);
  console.log(`${records.length ? "PASS" : "UNVERIFIED"} DKIM DNS: ${records.length ? "record exists" : "no Resend TXT record found"}.`);
  console.log("No emails sent. Delivery and inbox placement still require a test recipient.");
}
main().catch(() => { console.error("BLOCK Email checks could not complete. Check configuration and network access."); process.exitCode = 1; });
