# Enable school portal email

The portal remains at https://celias-portal-school-portal.vercel.app.
Its email sender is `Celias Schools <admin@celiasschools.org>`.

On 10 October 2026, Resend reported the sender domain as `failed`.
The domain uses `ns1.cloudoon.com`, `ns2.cloudoon.net`, and `ns3.cloudoon.org`,
so these records must be added in the domain's Cloudoon DNS control panel.

Add or correct the following records for **celiasschools.org**:

| Type | Host/name | Value | Priority |
| --- | --- | --- | --- |
| TXT | `resend._domainkey` | `p=MIGfMA0GCSqGSIb3DQEBAQUAA4GNADCBiQKBgQChDLhPYUTCE0b/RPv4RPcDMlgleLdRIPnyIc+ec+pXwsCEuolSgBfhxc6Gs/330NXibvGsRXPv71rkxuiXwt4U/rjbZbY1aQeh90xRrbB1iLxnOGn3uOVEiDozVpI/rWRZgDLMHEpr1g9Rnjt7NgebZxyB9iQ5cnkaRWdZOs+FOQIDAQAB` | — |
| MX | `send` | `feedback-smtp.us-east-1.amazonses.com` | 10 |
| TXT | `send` | `v=spf1 include:amazonses.com ~all` | — |

Use the DNS provider's default TTL. Keep the existing website records and root
MX records for school mailboxes. These MX/SPF records apply to `send.celiasschools.org`.
Some DNS editors require the full hostname; others append the domain automatically.

After saving, open the domain in Resend and select **Verify DNS records**.
Run `node --import tsx scripts/check-email.ts` from `school-portal` to inspect
verification and public DNS without sending messages. Then test delivery with an
approved recipient and check Resend delivery events and the recipient's inbox.

These public DNS values were retrieved from the configured Resend account.
