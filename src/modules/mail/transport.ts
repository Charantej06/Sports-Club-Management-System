import nodemailer from "nodemailer";

type Env = Record<string, string | undefined>;

/** Reads SMTP settings from the environment and reports anything that is missing, without ever exposing the password. */
export function mailSettings(env: Env = process.env) {
  const mode = env.EMAIL_MODE === "smtp" ? "smtp" : "local";
  const port = Number(env.SMTP_PORT || 587);
  const secure = env.SMTP_SECURE ? env.SMTP_SECURE === "true" : port === 465;
  const missing: string[] = [];
  if (mode === "smtp") {
    if (!env.SMTP_HOST) missing.push("SMTP_HOST");
    if (!Number.isInteger(port) || port < 1 || port > 65535) missing.push("SMTP_PORT");
    if (!env.EMAIL_FROM) missing.push("EMAIL_FROM");
    if (env.SMTP_USER && !env.SMTP_PASSWORD) missing.push("SMTP_PASSWORD");
    if (!env.SMTP_USER && env.SMTP_PASSWORD) missing.push("SMTP_USER");
  }
  const warnings: string[] = [];
  if (mode === "smtp") {
    const base = env.BETTER_AUTH_URL || "";
    if (!base.startsWith("https://") && !/localhost|127\.0\.0\.1/.test(base))
      warnings.push("BETTER_AUTH_URL should be the public https:// address, because it is used for the links inside verification and reset emails.");
    if (/localhost|127\.0\.0\.1/.test(base))
      warnings.push("BETTER_AUTH_URL points to localhost, so links in emails only work on this machine.");
    if (!env.SMTP_USER) warnings.push("No SMTP_USER is set; most providers require authentication.");
    if (env.EMAIL_FROM && /@champions\.local/.test(env.EMAIL_FROM)) warnings.push("EMAIL_FROM still uses the placeholder champions.local domain; providers reject senders they do not own.");
  }
  return {
    mode,
    configured: mode === "local" || missing.length === 0,
    missing,
    warnings,
    host: env.SMTP_HOST || null,
    port,
    secure,
    user: env.SMTP_USER ? maskUser(env.SMTP_USER) : null,
    from: env.EMAIL_FROM || null,
    baseUrl: env.BETTER_AUTH_URL || null,
  };
}
function maskUser(user: string) {
  const [name, domain] = user.split("@");
  if (!domain) return `${name.slice(0, 2)}…`;
  return `${name.slice(0, 2)}…@${domain}`;
}

export function createMailTransport(env: Env = process.env) {
  const settings = mailSettings(env);
  if (settings.mode !== "smtp" || !settings.configured)
    throw new Error(`SMTP is not configured${settings.missing.length ? `: set ${settings.missing.join(", ")}` : ""}`);
  return nodemailer.createTransport({
    host: env.SMTP_HOST,
    port: settings.port,
    secure: settings.secure,
    // Port 587 must upgrade to TLS before credentials are sent; never fall back to plain text.
    requireTLS: !settings.secure && settings.port === 587,
    connectionTimeout: 10000,
    greetingTimeout: 10000,
    socketTimeout: 30000,
    auth: env.SMTP_USER ? { user: env.SMTP_USER, pass: env.SMTP_PASSWORD } : undefined,
  });
}

/** The domain of the From address, so Message-ID values match the sender instead of a made-up host. */
export function senderDomain(from = process.env.EMAIL_FROM || "") {
  return /@([^>\s]+)/.exec(from)?.[1] || "champions.local";
}

/**
 * Placeholder addresses (the demo accounts, example.com, .test and similar) can never receive real mail.
 * Sending to them only produces bounces and wastes the provider's daily quota, so the worker keeps those
 * messages in the local inbox instead of handing them to the SMTP provider.
 */
export function isUndeliverable(address: string) {
  const domain = address.split("@").pop()?.toLowerCase() ?? "";
  return /(^|\.)(local|localhost|test|invalid|example)$/.test(domain) || /^example\.(com|org|net)$/.test(domain);
}
/** Provider answers that will never succeed on retry (mailbox does not exist, sender or message rejected). */
export function isPermanentFailure(error: unknown) {
  const code = (error as { responseCode?: number } | undefined)?.responseCode;
  return typeof code === "number" && code >= 550 && code <= 554;
}

const HINTS: Record<string, string> = {
  EAUTH: "The provider rejected the username or password. Use an app password or SMTP key, not your normal login password.",
  ECONNECTION: "Could not connect. Check SMTP_HOST and SMTP_PORT and that outbound SMTP is not blocked by a firewall.",
  ESOCKET: "The connection broke during the SMTP conversation. Check SMTP_PORT and SMTP_SECURE (465 uses implicit TLS, 587 uses STARTTLS).",
  ETIMEDOUT: "The server did not respond in time. Many hosts block outbound SMTP; try port 587 or 2525, or use your provider's API-backed relay.",
  EDNS: "The SMTP host name could not be resolved. Check SMTP_HOST for typos.",
  EENVELOPE: "The sender or recipient address was rejected. Check EMAIL_FROM and that the sender is verified with your provider.",
  EMESSAGE: "The provider rejected the message content.",
};
/** A short, human-readable reason for a failed send. Credentials are removed before anything is stored or returned. */
export function describeMailError(error: unknown, env: Env = process.env) {
  const e = error as { code?: string; responseCode?: number; response?: string; message?: string } | undefined;
  const first = (e?.response || e?.message || "unknown error").split("\n")[0];
  let text = [e?.code, first.startsWith(String(e?.responseCode)) ? undefined : e?.responseCode, first].filter(Boolean).join(" · ");
  for (const secret of [env.SMTP_PASSWORD, env.SMTP_USER]) if (secret && secret.length > 2) text = text.split(secret).join("[redacted]");
  const hint = e?.code ? HINTS[e.code] : undefined;
  return `${text.slice(0, 220)}${hint ? ` — ${hint}` : ""}`.slice(0, 480);
}
