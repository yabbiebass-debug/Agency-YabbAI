# YABBAI Mission Control

The agent operating system behind Basham Automations. Real data, real AI, and hard gates:
no agent can send outreach, ship work, or create a client on its own.

## What it does

- **The loop** — eight stages: Scout, Qualify, Pitch, Close, Build, Ship, Support, Reinvest.
  Pressing *Run cycle* scores new leads, drafts outreach for hot ones, pushes builds forward,
  queues shipping, and flags clients at risk of leaving.
- **Your gates** — outreach, proposals and shipping all wait in the approval queue. The database
  itself refuses to record an action unless you approved it first.
- **Human-only closing** — an agent can never create a client. A client only exists when you
  confirm the close yourself, or when a payment is verified by the server.
- **Licence policy** — the Forge checks any open-source tool before it touches a build.
  Permissive licences get queued for you; unknown or proprietary ones are blocked in the database.
- **The Treasurer reads money, never moves it.**

## Money in

Two ways, both verified on the server before a client is created:

| Method | How it confirms |
| --- | --- |
| PayPal business | Order created and captured against your PayPal account (`yabbai-shipped`) |
| Solana (Phantom) | Transaction signature checked on chain against your wallet |

Solana support is receive-and-verify only. The app holds no wallet keys and can never spend,
transfer, or trade anything.

## Settings you must supply

Stored securely, never in the code:

- `PAYPAL_CLIENT_ID`, `PAYPAL_CLIENT_SECRET`, `PAYPAL_ENV` (`live` or `sandbox`) — set
- `SOLANA_RPC_URL` — optional; a private RPC endpoint is more reliable than the public one
- `LOVABLE_API_KEY` — already set; powers the agents

## Before going live

1. **Rotate the PayPal secret.** The current one was pasted into a chat window, so treat it as
   exposed: create a new secret in your PayPal developer dashboard, delete the old one, and save
   the new value here.
2. Sign in once, add a real lead, run a cycle, and approve one item end to end.
3. Take one small live payment through each method you plan to use.

## Not included, on purpose

No auto-sending of emails, no auto-closing of deals, no scraping of sources that forbid it,
no custody or movement of crypto, and no fake data anywhere in the app.
