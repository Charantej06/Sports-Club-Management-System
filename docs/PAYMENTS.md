# Setting up online payments (Razorpay)

Champions Club takes online payments for memberships, court bookings and shop orders through Razorpay. Until it is configured the app runs in a clearly labelled **local demo mode** where payments are simulated and no money moves.

## How a payment works (so you know what to expect)

1. The customer chooses something (a slot, a plan, a cart). The server **prices it itself**; the browser never sends an amount.
2. The server creates a Razorpay **order** for exactly that amount and the Razorpay payment window opens. For a court or shop order the window opens straight away.
3. After paying, the server **verifies the payment signature** with your secret and checks the amount, currency and order. Only then does it confirm the booking, order or membership and email a receipt.
4. If the customer's slot hold ran out, or a plan price changed while they were paying, the money is **not** silently accepted: the payment is flagged for the owner to review and repay.

Test mode (keys starting `rzp_test_`) behaves exactly like live mode but moves no real money.

## Step 1: get your keys

1. Sign in to the Razorpay dashboard and switch to **Test mode** (toggle at the top).
2. Go to **Account & Settings → API keys → Generate Test Key**.
3. Copy the **Key ID** (`rzp_test_…`) and the **Key Secret**. **The secret is shown only once.** If you lose it, generate a new key pair.

## Step 2: edit `.env`

```env
PAYMENT_MODE=razorpay
RAZORPAY_KEY_ID=rzp_test_xxxxxxxxxxxxxx
RAZORPAY_KEY_SECRET=xxxxxxxxxxxxxxxxxxxxxxxx
RAZORPAY_WEBHOOK_SECRET=any-long-random-string-you-choose
```

- The Key ID and Key Secret must come from the **same** key pair. A mismatch gives "Authentication failed".
- The webhook secret is **not** a Razorpay-issued key. It is a string you invent and also enter when creating the webhook (Step 4).
- Do not wrap values in spaces. Never commit `.env`.
- Restart the app after editing (`npm run dev:all` or `npm run start:all`).

## Step 3: check it works (before taking a payment)

Sign in as the owner, open **Payments & email**, and press **Test Razorpay keys**. It makes a harmless read-only call and tells you in plain words whether Razorpay accepts the keys:

| Message | What to do |
|---|---|
| "Razorpay accepted the keys (test mode…)" | You are ready. |
| "Razorpay rejected the Key ID and Key Secret" | Copy both values again from the dashboard, or generate a new test key pair, update `.env`, restart. |
| "Missing: RAZORPAY_…" | Add the missing variable. |
| "Could not reach Razorpay" | Check the internet connection. |

The same card also lists any warnings (for example a webhook secret that looks like a key ID, or `localhost` addresses).

## Step 4 (optional): webhooks

Payments complete through the checkout window without a webhook. A webhook adds a safety net if a customer closes the window right after paying. It needs an address Razorpay can reach:

1. Expose the app, for example with a tunnel such as `ngrok http 3000`, and set `BETTER_AUTH_URL` and `TRUSTED_ORIGINS` to that public address.
2. In the dashboard open **Account & Settings → Webhooks → Add new webhook**.
3. URL: shown on the **Payments & email** card, ending `/api/payments/webhook`.
4. Secret: the same string as `RAZORPAY_WEBHOOK_SECRET`.
5. Events: `payment.captured`.

## Testing with Razorpay test mode

| Method | Details |
|---|---|
| Card | `4111 1111 1111 1111`, any future expiry, any CVV, any name |
| UPI | `success@razorpay` succeeds; `failure@razorpay` fails |
| OTP | `1234` if asked |

## Going live

Replace the keys with **live** keys (`rzp_live_…`) after Razorpay activates your account, and use a public `https://` address. The Payments card will warn that real money moves.

## Troubleshooting

| What you see | Cause and fix |
|---|---|
| Customers see "Online payment is temporarily unavailable" | The keys were rejected (HTTP 401). Use **Test Razorpay keys** for the exact cause. |
| Pay button missing and the page says payments await configuration | `PAYMENT_MODE` is not `razorpay`, or one of the three variables is empty. |
| Payment succeeded in Razorpay but nothing was confirmed | Check **Payments & email → Online payments** for `needs review`. The owner reviews and repays; the customer should not pay again. |
| Webhook never arrives | `BETTER_AUTH_URL` is `localhost` or the secret differs. Payments still complete through the checkout window. |
