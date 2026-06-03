import type { IEmailProvider, EmailMessage } from "./auth-types";
import { logger } from "../lib/logger";

/**
 * email-provider.ts — Pluggable email provider abstraction.
 *
 * In development (EMAIL_PROVIDER=console, the default): emails are logged to
 * stdout. This keeps the server functional without an SMTP server.
 *
 * Production: set EMAIL_PROVIDER=smtp and configure SMTP_* env vars.
 * The abstraction allows swapping providers without application code changes.
 */

// ---------------------------------------------------------------------------
// Console email provider (development / testing)
// ---------------------------------------------------------------------------

class ConsoleEmailProvider implements IEmailProvider {
  readonly name = "console";

  async send(message: EmailMessage): Promise<void> {
    logger.info(
      {
        emailProvider: "console",
        to: message.to,
        subject: message.subject,
        body: message.textBody,
      },
      "[EMAIL] Message logged (console provider — set EMAIL_PROVIDER=smtp for real delivery)",
    );
  }
}

// ---------------------------------------------------------------------------
// SMTP email provider (production)
// ---------------------------------------------------------------------------

class SmtpEmailProvider implements IEmailProvider {
  readonly name = "smtp";
  private readonly host: string;
  private readonly port: number;
  private readonly user: string;
  private readonly pass: string;
  private readonly from: string;

  constructor() {
    this.host = process.env["SMTP_HOST"] ?? "";
    this.port = Number(process.env["SMTP_PORT"] ?? 587);
    this.user = process.env["SMTP_USER"] ?? "";
    this.pass = process.env["SMTP_PASS"] ?? "";
    this.from = process.env["SMTP_FROM"] ?? "noreply@quantforge.app";
  }

  async send(message: EmailMessage): Promise<void> {
    // Lazy-import nodemailer only when SMTP provider is active.
    // nodemailer is a peer dependency; install it if using SMTP.
    try {
      // eslint-disable-next-line @typescript-eslint/ban-ts-comment
      // @ts-ignore — nodemailer is an optional peer dep; install it to enable SMTP
      const nodemailer = await import("nodemailer");
      const transporter = nodemailer.createTransport({
        host: this.host,
        port: this.port,
        secure: this.port === 465,
        auth: { user: this.user, pass: this.pass },
      });
      await transporter.sendMail({
        from: this.from,
        to: message.to,
        subject: message.subject,
        text: message.textBody,
        html: message.htmlBody,
      });
    } catch (err) {
      logger.error({ err, to: message.to, subject: message.subject }, "SMTP send failed");
      throw err;
    }
  }
}

// ---------------------------------------------------------------------------
// Factory — selects provider from EMAIL_PROVIDER env var
// ---------------------------------------------------------------------------

let _instance: IEmailProvider | null = null;

export function getEmailProvider(): IEmailProvider {
  if (_instance) return _instance;
  const providerName = (process.env["EMAIL_PROVIDER"] ?? "console").toLowerCase();
  switch (providerName) {
    case "smtp":
      _instance = new SmtpEmailProvider();
      break;
    case "console":
    default:
      _instance = new ConsoleEmailProvider();
      break;
  }
  logger.info({ emailProvider: (_instance as unknown as { name: string }).name }, "Email provider initialized");
  return _instance;
}

// ---------------------------------------------------------------------------
// Template helpers
// ---------------------------------------------------------------------------

const BASE_URL = process.env["APP_BASE_URL"] ?? process.env["REPLIT_DEV_DOMAIN"] ? `https://${process.env["REPLIT_DEV_DOMAIN"]}` : "http://localhost:5000";

export function buildVerificationEmail(email: string, token: string): EmailMessage {
  const url = `${BASE_URL}/verify-email?token=${token}`;
  return {
    to: email,
    subject: "Verify your QuantForge email address",
    textBody: `Welcome to QuantForge!\n\nPlease verify your email address by visiting:\n${url}\n\nThis link expires in 24 hours.\n\nIf you did not create an account, ignore this email.`,
    htmlBody: `<p>Welcome to QuantForge!</p><p>Please <a href="${url}">verify your email address</a>.</p><p>This link expires in 24 hours.</p><p>If you did not create an account, ignore this email.</p>`,
  };
}

export function buildPasswordResetEmail(email: string, token: string): EmailMessage {
  const url = `${BASE_URL}/reset-password?token=${token}`;
  return {
    to: email,
    subject: "Reset your QuantForge password",
    textBody: `You requested a password reset.\n\nVisit this link to reset your password:\n${url}\n\nThis link expires in 1 hour.\n\nIf you did not request this, ignore this email.`,
    htmlBody: `<p>You requested a password reset.</p><p>Please <a href="${url}">reset your password</a>.</p><p>This link expires in 1 hour.</p><p>If you did not request this, ignore this email.</p>`,
  };
}

export function buildInvitationEmail(email: string, orgName: string, invitedByEmail: string, token: string): EmailMessage {
  const url = `${BASE_URL}/accept-invitation?token=${token}`;
  return {
    to: email,
    subject: `You've been invited to join ${orgName} on QuantForge`,
    textBody: `${invitedByEmail} has invited you to join ${orgName} on QuantForge.\n\nAccept the invitation:\n${url}\n\nThis link expires in 7 days.`,
    htmlBody: `<p>${invitedByEmail} has invited you to join <strong>${orgName}</strong> on QuantForge.</p><p><a href="${url}">Accept the invitation</a></p><p>This link expires in 7 days.</p>`,
  };
}
