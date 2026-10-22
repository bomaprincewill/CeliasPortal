import nodemailer from "nodemailer";
import { Resend } from "resend";
import { logger } from "@/lib/logger";

type ApplicantCredentials = {
  to: string;
  name: string;
  password: string;
  applicationNo: string;
  applyingForClass: string;
};

type ApplicantSetupDetails = {
  to: string;
  name: string;
  setupUrl: string;
  applicationNo: string;
  applyingForClass: string;
  deliveryId: string;
};

function escapeHtml(value: string) {
  return value.replace(/[&<>'"]/g, character => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;",
  })[character]!);
}

type TransactionalEmail = {
  to: string;
  subject: string;
  text: string;
  html: string;
  idempotencyKey: string;
};

async function sendTransactionalEmail(message: TransactionalEmail) {
  const from = process.env.EMAIL_FROM?.trim() || "Celias Schools <admin@celiasschools.org>";
  const recipientDomain = message.to.split("@")[1];

  if (process.env.RESEND_API_KEY) {
    const resend = new Resend(process.env.RESEND_API_KEY);
    const { error } = await resend.emails.send(
      {
        from,
        to: [message.to],
        subject: message.subject,
        text: message.text,
        html: message.html,
      },
      { idempotencyKey: message.idempotencyKey },
    );

    if (error) {
      logger.error("email.resend_failed", error, { recipientDomain, errorName: error.name });
      if (error.name === "validation_error") {
        return { sent: false as const, error: "The email address or message configuration is invalid." };
      }
      return { sent: false as const, error: "Resend could not deliver the message. Check domain verification and email logs." };
    }

    return { sent: true as const };
  }

  const { SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS } = process.env;
  if (!SMTP_HOST || !SMTP_PORT || !SMTP_USER || !SMTP_PASS || !process.env.EMAIL_FROM) {
    return { sent: false as const, error: "Email delivery is not configured." };
  }

  const transporter = nodemailer.createTransport({
    host: SMTP_HOST,
    port: Number(SMTP_PORT),
    secure: process.env.SMTP_SECURE === "true" || Number(SMTP_PORT) === 465,
    auth: { user: SMTP_USER, pass: SMTP_PASS },
  });

  try {
    await transporter.sendMail({ from, to: message.to, subject: message.subject, text: message.text, html: message.html });
    return { sent: true as const };
  } catch (error) {
    logger.error("email.smtp_failed", error, { recipientDomain });
    const mailError = error as { code?: string; responseCode?: number };
    if (mailError.code === "EAUTH" || mailError.responseCode === 535) {
      return { sent: false as const, error: "The mail server rejected the configured username or password." };
    }
    if (["ECONNECTION", "ESOCKET", "ETIMEDOUT"].includes(mailError.code ?? "")) {
      return { sent: false as const, error: "The application could not connect securely to the mail server." };
    }
    return { sent: false as const, error: "The email provider could not deliver the message." };
  }
}

export async function sendApplicantCredentialsEmail(details: ApplicantCredentials) {
  const schoolName = process.env.SCHOOL_NAME?.trim() || "Celias Portal";
  const loginUrl = `${(process.env.NEXTAUTH_URL || "http://localhost:3000").replace(/\/$/, "")}/auth/signin`;
  return sendTransactionalEmail({
    to: details.to,
    subject: `${schoolName} applicant login details`,
    idempotencyKey: `applicant-credentials/${details.applicationNo}`,
    text: [
        `Hello ${details.name},`,
        "",
        `Your applicant account for ${schoolName} has been created.`,
        `Application number: ${details.applicationNo}`,
        `Applying for: ${details.applyingForClass}`,
        `Login page: ${loginUrl}`,
        `Email: ${details.to}`,
        `Temporary password: ${details.password}`,
        "",
        "Please sign in and keep these details private.",
    ].join("\n"),
    html: `
        <div style="font-family:Arial,sans-serif;line-height:1.6;color:#172033;max-width:600px">
          <h2>${escapeHtml(schoolName)} applicant account</h2>
          <p>Hello ${escapeHtml(details.name)},</p>
          <p>Your applicant account has been created.</p>
          <table style="border-collapse:collapse;width:100%;margin:20px 0">
            <tr><td style="padding:8px;border:1px solid #ddd"><strong>Application number</strong></td><td style="padding:8px;border:1px solid #ddd">${escapeHtml(details.applicationNo)}</td></tr>
            <tr><td style="padding:8px;border:1px solid #ddd"><strong>Applying for</strong></td><td style="padding:8px;border:1px solid #ddd">${escapeHtml(details.applyingForClass)}</td></tr>
            <tr><td style="padding:8px;border:1px solid #ddd"><strong>Email</strong></td><td style="padding:8px;border:1px solid #ddd">${escapeHtml(details.to)}</td></tr>
            <tr><td style="padding:8px;border:1px solid #ddd"><strong>Temporary password</strong></td><td style="padding:8px;border:1px solid #ddd"><code>${escapeHtml(details.password)}</code></td></tr>
          </table>
          <p><a href="${escapeHtml(loginUrl)}" style="display:inline-block;padding:10px 16px;background:#4f46e5;color:#fff;text-decoration:none;border-radius:6px">Sign in to the applicant portal</a></p>
          <p>Please keep these login details private.</p>
        </div>`,
  });
}

export async function sendApplicantSetupEmail(details: ApplicantSetupDetails) {
  const schoolName = process.env.SCHOOL_NAME?.trim() || "Celias Portal";
  return sendTransactionalEmail({
    to: details.to,
    subject: `${schoolName} applicant login details`,
    idempotencyKey: `applicant-setup/${details.deliveryId}`,
    text: [
      `Hello ${details.name},`,
      "",
      `Your applicant account for ${schoolName} is ready.`,
      `Application number: ${details.applicationNo}`,
      `Applying for: ${details.applyingForClass}`,
      `Login email: ${details.to}`,
      "",
      "Create or reset your password using this secure one-time link (valid for 24 hours):",
      details.setupUrl,
      "",
      `After setting your password, sign in using this email address: ${details.to}`,
      "If you did not expect this message, contact the school administration.",
    ].join("\n"),
    html: `
      <div style="font-family:Arial,sans-serif;line-height:1.6;color:#172033;max-width:600px">
        <h2>${escapeHtml(schoolName)} applicant account</h2>
        <p>Hello ${escapeHtml(details.name)},</p>
        <p>Your applicant account is ready.</p>
        <table style="border-collapse:collapse;width:100%;margin:20px 0">
          <tr><td style="padding:8px;border:1px solid #ddd"><strong>Application number</strong></td><td style="padding:8px;border:1px solid #ddd">${escapeHtml(details.applicationNo)}</td></tr>
          <tr><td style="padding:8px;border:1px solid #ddd"><strong>Applying for</strong></td><td style="padding:8px;border:1px solid #ddd">${escapeHtml(details.applyingForClass)}</td></tr>
          <tr><td style="padding:8px;border:1px solid #ddd"><strong>Login email</strong></td><td style="padding:8px;border:1px solid #ddd">${escapeHtml(details.to)}</td></tr>
        </table>
        <p>Use the button below to create or reset your password. The link works once and expires after 24 hours.</p>
        <p><a href="${escapeHtml(details.setupUrl)}" style="display:inline-block;padding:10px 16px;background:#00843d;color:#fff;text-decoration:none;border-radius:6px">Create or reset password</a></p>
        <p>After setting your password, sign in using <strong>${escapeHtml(details.to)}</strong>.</p>
        <p>If you did not expect this message, contact the school administration.</p>
      </div>`,
  });
}

export async function sendPasswordResetEmail(details: { to: string; name: string; token: string }) {
  const schoolName = process.env.SCHOOL_NAME?.trim() || "Celias Portal";
  const resetUrl = `${(process.env.NEXTAUTH_URL || "http://localhost:3000").replace(/\/$/, "")}/auth/reset-password/${encodeURIComponent(details.token)}`;
  return sendTransactionalEmail({
    to: details.to,
    subject: `Reset your ${schoolName} password`,
    idempotencyKey: `password-reset/${details.token}`,
    text: `Hello ${details.name},\n\nReset your password using this link (valid for 30 minutes):\n${resetUrl}\n\nIf you did not request this, ignore this email.`,
    html: `<div style="font-family:Arial,sans-serif;line-height:1.6;color:#172033;max-width:600px"><h2>Reset your password</h2><p>Hello ${escapeHtml(details.name)},</p><p>This link is valid for 30 minutes.</p><p><a href="${escapeHtml(resetUrl)}" style="display:inline-block;padding:10px 16px;background:#4f46e5;color:#fff;text-decoration:none;border-radius:6px">Choose a new password</a></p><p>If you did not request this, you can ignore this email.</p></div>`,
  });
}
