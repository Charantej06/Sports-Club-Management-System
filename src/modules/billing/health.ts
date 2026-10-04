type Env = Record<string, string | undefined>;

/** How online payments are configured, with problems spelled out. Secrets are never returned. */
export function paymentSettings(env: Env = process.env) {
  const mode = env.PAYMENT_MODE === "razorpay" ? "razorpay" : env.PAYMENT_MODE === "local" ? "local" : "off";
  const keyId = env.RAZORPAY_KEY_ID || "";
  const secret = env.RAZORPAY_KEY_SECRET || "";
  const webhook = env.RAZORPAY_WEBHOOK_SECRET || "";
  const missing: string[] = [];
  const warnings: string[] = [];
  if (mode === "razorpay") {
    if (!keyId) missing.push("RAZORPAY_KEY_ID");
    if (!secret) missing.push("RAZORPAY_KEY_SECRET");
    if (!webhook) missing.push("RAZORPAY_WEBHOOK_SECRET");
    if (keyId && !/^rzp_(test|live)_[A-Za-z0-9]{8,}$/.test(keyId)) warnings.push("RAZORPAY_KEY_ID should look like rzp_test_xxxxxxxxxxxxxx or rzp_live_xxxxxxxxxxxxxx.");
    if (secret && secret.length !== 24) warnings.push("RAZORPAY_KEY_SECRET is normally 24 characters. Copy it again without spaces or quotes.");
    if (webhook && /^rzp_/.test(webhook)) warnings.push("RAZORPAY_WEBHOOK_SECRET looks like a key ID. It must be the secret you typed when creating the webhook in the Razorpay dashboard.");
    if (/localhost|127\.0\.0\.1/.test(env.BETTER_AUTH_URL || "")) warnings.push("The app address is localhost, so Razorpay cannot call the webhook. Payments still complete through the checkout window; for webhooks use a public address or a tunnel.");
    if (keyId.startsWith("rzp_live_")) warnings.push("Live keys are configured: real money will move.");
  }
  if (mode === "local") warnings.push("Local mode records simulated payments. No money moves and receipts say so.");
  if (mode === "off") warnings.push("No payment mode is set. Customers cannot pay online; staff can still record cash, card and UPI.");
  return {
    mode,
    configured: mode === "local" || (mode === "razorpay" && missing.length === 0),
    missing,
    warnings,
    testMode: keyId.startsWith("rzp_test_"),
    keyId: keyId ? `${keyId.slice(0, 9)}…${keyId.slice(-3)}` : null,
    webhookUrl: `${env.BETTER_AUTH_URL || "http://localhost:3000"}/api/payments/webhook`,
  };
}

/** A read-only call that proves Razorpay accepts the configured key pair. No order is created and no money moves. */
export async function verifyProvider(env: Env = process.env): Promise<{ ok: boolean; message: string }> {
  const settings = paymentSettings(env);
  if (settings.mode === "local") return { ok: true, message: "Local mode: payments are simulated, so there is nothing to verify with a provider." };
  if (settings.mode !== "razorpay") return { ok: false, message: "No payment mode is set. Set PAYMENT_MODE=razorpay (or local for demos) in .env and restart." };
  if (settings.missing.length) return { ok: false, message: `Razorpay settings are incomplete. Missing: ${settings.missing.join(", ")}.` };
  try {
    const response = await fetch("https://api.razorpay.com/v1/orders?count=1", {
      headers: { Authorization: "Basic " + Buffer.from(`${env.RAZORPAY_KEY_ID}:${env.RAZORPAY_KEY_SECRET}`).toString("base64") },
      signal: AbortSignal.timeout(15000),
    });
    if (response.ok) return { ok: true, message: `Razorpay accepted the keys (${settings.testMode ? "test mode, no real money" : "LIVE mode"}). Checkout is ready.` };
    if (response.status === 401 || response.status === 403)
      return { ok: false, message: "Razorpay rejected the Key ID and Key Secret (authentication failed). In the Razorpay dashboard open Account & Settings → API keys, generate a new test key pair, copy both values into RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET, then restart the app. The secret is shown only once." };
    return { ok: false, message: `Razorpay answered with HTTP ${response.status}. Try again shortly.` };
  } catch (error) {
    return { ok: false, message: `Could not reach Razorpay (${error instanceof Error ? error.name : "network error"}). Check the internet connection.` };
  }
}
