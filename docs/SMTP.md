# Setting up email (SMTP) for Champions Club

Champions Club sends three kinds of email: **account verification**, **password reset** and **membership expiry reminders**. Until you configure SMTP, every email is stored in the *Local test inbox* (owner workspace) and **nothing is sent to a real person**. That is why a new customer never receives a verification email on a fresh install.

This guide takes you from "no email" to "verified, real emails arriving" in about ten minutes.

---

## How email works in this project (read once)

1. The web app never talks to the mail server. It writes the message to the database and creates a durable job.
2. The **worker** (`npm run worker`) picks the job up and sends it through SMTP. **If the worker is not running, no email is sent**, even in SMTP mode.
3. Failed sends are retried up to five times with a growing delay, then marked `FAILED`. The owner can retry from **Owner workspace → Reminders & delivery**.
4. The mode is decided **when a message is queued**. Messages queued while `EMAIL_MODE=local` stay local; they are not re-sent after you switch to SMTP. Create a new account or request a new reset to test.
5. Both the web app **and** the worker read `.env` only at start-up. Restart both after any change.

---

## Step 1: Choose a provider and get credentials

You need five values from your provider: **host**, **port**, **username**, **password** (or API key) and a **verified sender address**.

| Provider | `SMTP_HOST` | `SMTP_PORT` | `SMTP_USER` | `SMTP_PASSWORD` | Notes |
|---|---|---|---|---|---|
| **Gmail** (quickest for a demo) | `smtp.gmail.com` | `587` | your full Gmail address | a 16-character **App Password** | Needs 2-Step Verification. About 500 recipients/day. |
| **Google Workspace** | `smtp.gmail.com` | `587` | the Workspace address | App Password | An admin may need to allow app passwords. |
| **Brevo** | `smtp-relay.brevo.com` | `587` | the SMTP login shown under *SMTP & API* | an **SMTP key** | Free tier ~300/day. Verify your sender first. |
| **Resend** | `smtp.resend.com` | `587` | `resend` | your API key | Verify your domain first. |
| **SendGrid** | `smtp.sendgrid.net` | `587` | the literal word `apikey` | your API key (`SG.…`) | Verify a *Single Sender* or your domain. |
| **Amazon SES** | `email-smtp.<region>.amazonaws.com` | `587` | SES **SMTP** username | SES **SMTP** password | These are not your IAM keys. New accounts are in *sandbox* and can only email verified addresses until you request production access. |
| **Mailgun** | `smtp.mailgun.org` (EU: `smtp.eu.mailgun.org`) | `587` | `postmaster@your-domain` | the domain's SMTP password | Add and verify the sending domain. |
| **Zoho Mail** | `smtp.zoho.in` (or `.com`) | `587` | your Zoho address | an app-specific password | Use the data-centre host that matches your account. |

### Gmail App Password, step by step

1. Sign in to the Google account that will send the email.
2. Open **Google Account → Security** and turn on **2-Step Verification** (App Passwords are hidden until it is on).
3. Go to **https://myaccount.google.com/apppasswords**.
4. Name it `Champions Club` and click **Create**.
5. Copy the 16-character password. Paste it **without spaces**. Google only shows it once.
6. Use the Gmail address as both `SMTP_USER` and the address inside `EMAIL_FROM`. Gmail rewrites any other sender address.

> Your normal Gmail password will **not** work. Google rejects it with `535 Username and Password not accepted`.

### Ports and encryption

| Port | Security | What the app does |
|---|---|---|
| `587` | STARTTLS | **Recommended.** TLS is required before the login is sent; the app never falls back to plain text. |
| `465` | Implicit TLS | Detected automatically. |
| `2525` | STARTTLS | Alternative when 587 is blocked by your host. |
| `1025` | none | Only for a local test mail catcher (see the end of this guide). |

To override detection, set `SMTP_SECURE=true` (implicit TLS) or `SMTP_SECURE=false`.

---

## Step 2: Edit `.env`

Open `.env` in the project folder (create it with `npm run setup:env` if it does not exist). **Never commit this file.**

```env
EMAIL_MODE=smtp
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=yourclub@gmail.com
SMTP_PASSWORD=abcdefghijklmnop
EMAIL_FROM=Champions Club <yourclub@gmail.com>

# Links inside emails are built from this address. It must be the address
# customers really open, not localhost, or the verification link will not work for them.
BETTER_AUTH_URL=https://club.example.com
TRUSTED_ORIGINS=https://club.example.com
```

Checklist:

- `EMAIL_FROM` is `Display Name <address@domain>`. The address must belong to you and be **verified with your provider**. Placeholder `@champions.local` addresses are rejected by real providers.
- If your password contains `#` or spaces, wrap it in quotes: `SMTP_PASSWORD="my pass#word"`.
- Running locally just to try it? Leave `BETTER_AUTH_URL=http://localhost:3000`; links will only open on your own machine.
- Docker: `compose.yaml` loads `.env` into both the `app` and `worker` containers, so the same file is enough.

---

## Step 3: Verify the settings (before starting the app)

```bash
npm run mail:verify
```

This prints the settings it found (the password is never shown), connects to the server and tests the login. To also send a real message:

```bash
npm run mail:verify -- you@example.com
```

Expected output:

```
Email mode: smtp
✔ SMTP_HOST smtp.gmail.com
✔ SMTP_PORT 587 · STARTTLS (required)
✔ SMTP_USER yo…@gmail.com
✔ EMAIL_FROM Champions Club <yourclub@gmail.com>
✔ Connected and logged in successfully.
✔ Test email accepted by the server for you@example.com
```

Check the inbox **and the spam folder**. If a step fails, the message explains why; see *Troubleshooting* below.

---

## Step 4: Restart the app **and** the worker

```bash
npm run dev:all                 # app + worker together (Ctrl+C stops both)
# or, in production mode:  npm run build && npm run start:all
```

(The older way still works: `npm run dev` or `npm start` in one terminal and `npm run worker` in another. The worker must be running or no email is sent.)

---

## Step 5: Verify inside the application

1. Sign in as the owner (`owner@champions.local`).
2. Open **Reminders & delivery**. The **Email delivery** card shows the mode, server, login (masked), sender and the queue counts.
3. Press **Test SMTP connection**. You should see *Connected … and the login was accepted.*
4. Press **Send me a test email**. The worker sends it within a few seconds, and the message appears in the list below with status `DELIVERED`.
5. End-to-end check: sign out, create a new account with a real address you control. The *Welcome to Champions Club: verify your email* message should arrive. Click its link, and you are signed in with a verified account.
6. Request a password reset from **Forgot password** and confirm that email arrives too.

If a message shows `RETRYING` or `FAILED`, the reason is printed under it (credentials are redacted). Fix `.env`, restart app and worker, and press **Retry delivery**.

---

## Troubleshooting

| What you see | Cause and fix |
|---|---|
| `EAUTH · 535 … Username and Password not accepted` | Wrong user or password. Gmail needs an **App Password**; SendGrid needs the user `apikey`; Brevo needs the SMTP login and an SMTP key, not your account login. |
| `ECONNECTION` or `ETIMEDOUT` | Wrong host/port, or the network blocks outbound SMTP. Try 587, then 2525. Some cloud hosts block ports 25 and 465 by default. |
| `ESOCKET … wrong version number` | Port and security do not match. Use `587` (STARTTLS) or `465` (TLS), or set `SMTP_SECURE` explicitly. |
| `EENVELOPE` or `550 … sender not verified` | `EMAIL_FROM` is not a verified sender or domain with the provider. Verify it in the provider dashboard. |
| Test passes but no email arrives | Check spam. Make sure the **worker** is running. On a custom domain, add SPF, DKIM and DMARC records (below). |
| Messages stay `QUEUED` | The worker is not running, or it started before you edited `.env`. Restart it. |
| Old messages still say `local` | They were queued before the switch. Send a new one. |
| Link in the email opens `localhost` | `BETTER_AUTH_URL` is still `http://localhost:3000`. Set the public address and restart. |

---

## Deliverability for a real club domain

Providers like Brevo, Resend, SendGrid, SES and Mailgun give you DNS records to add after you verify a domain. Add all of them, or mail from your domain lands in spam:

- **SPF**: lists which servers may send for your domain.
- **DKIM**: a cryptographic signature on each message.
- **DMARC**: tells receivers what to do when SPF/DKIM fail. Start with `v=DMARC1; p=none; rua=mailto:you@your-domain`.

Send from a dedicated address such as `club@your-domain` rather than a personal inbox.

---

## Trying it with no provider at all (local mail catcher)

To watch real SMTP traffic without sending anything to the internet, run a catcher such as [Mailpit](https://github.com/axllent/mailpit):

```bash
brew install mailpit && mailpit      # SMTP on 1025, inbox at http://localhost:8025
```

```env
EMAIL_MODE=smtp
SMTP_HOST=127.0.0.1
SMTP_PORT=1025
SMTP_USER=
SMTP_PASSWORD=
EMAIL_FROM=Champions Club <club@example.com>
```

Run `npm run mail:verify -- anyone@example.com`, restart the app and worker, then sign up a new user. The verification email shows up in the Mailpit inbox.

---

## Security notes

- Keep SMTP credentials only in `.env` or your host's secret store. They are never written to the database, the audit log or the interface.
- Prefer a provider API key or app password that can be revoked, and rotate it if it leaks.
- SMTP cannot guarantee exactly-once delivery: if the process crashes after the provider accepts a message but before the status is saved, the message may be sent twice. This is documented in the README.
