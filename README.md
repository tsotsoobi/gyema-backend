# gyema-pi-payments

**Pi Network server-side payment backend for [Gyema](https://github.com/tsotsoobi/gyema-app), bundled with a self-contained Testnet demo client.**

This repo handles the two server-side steps the Pi SDK requires to settle a payment (approval and completion) by calling the Pi Platform API with a server-side key. It also serves a single-file demo client (`index.html`) and the Pi domain-verification file.

## Relationship to the other Gyema repos

This is **not** the backend for the production app. The production frontend, [gyema-app](https://github.com/tsotsoobi/gyema-app), carries its own backend internally (Supabase plus Next.js API routes for the Pi to Supabase auth bridge).

This repo is a separate, standalone Pi payment-approval server running against **Pi Testnet / sandbox**. It exists as the lightweight payment rail and demo environment, distinct from the production app.

| Repo | Role |
|---|---|
| [gyema-app](https://github.com/tsotsoobi/gyema-app) | Production frontend (Next.js) with its own Supabase backend |
| [gyema-contracts](https://github.com/tsotsoobi/gyema-contracts) | V2 Soroban escrow contracts (pre-deployment) |
| **this repo** | Standalone Testnet Pi payment server plus single-file demo client |

## Network

Testnet / sandbox. The bundled client initialises with `Pi.init({ version: '2.0', sandbox: true })`, and the server calls the Pi Platform API with a sandbox key.

The `validation-key.txt` in this repo is the Pi Developer Portal domain-verification hash. To confirm which Pi app this is registered to, open the `/validation-key.txt` path on each candidate subdomain in the Pi Browser and match the hash. Testnet is expected to be `gyema3681.pinet.com`; Mainnet (`gyema8841.pinet.com`) should not match.

## Stack

- Node.js with Express
- lowdb (JSON file store, `gyema.json`)
- axios (calls to the Pi Platform API)
- dotenv, cors

## Payment flow

The client drives `Pi.createPayment()`. Its callbacks call this server:

1. `onReadyForServerApproval(paymentId)` calls **POST /payments/approve**, which approves the payment with Pi and records it locally.
2. `onReadyForServerCompletion(paymentId, txid)` calls **POST /payments/complete**, which passes the blockchain txid to Pi to finalise the payment.

## Endpoints

| Method | Path | Purpose |
|---|---|---|
| POST | `/payments/approve` | Approve a Pi payment (body: `paymentId`, optional `jobId`, `amount`, `memo`) |
| POST | `/payments/complete` | Finalise a Pi payment (body: `paymentId`, `txid`) |
| GET | `/jobs` | List open delivery jobs (injects default tracking steps) |
| GET | `/jobs/seed` | One-time seed of 3 sample jobs (no-op if jobs exist) |
| GET | `/payments/:paymentId` | Inspect a stored payment's status |
| GET | `/` | Serve the bundled demo client (`index.html`) |
| GET | `/validation-key.txt` | Serve the Pi domain-verification hash |

## Data

A single `gyema.json` file managed by lowdb, with two collections:

- `payments`: `payment_id`, `status` (pending, approved, completed, error), `txid`, `job_id`, `amount`, `memo`, timestamps
- `jobs`: seeded sample delivery listings

State is file-based and intended for Testnet use, not production scale.

## Running locally

Prerequisites: Node.js and a Pi sandbox API key from [developer.minepi.com](https://developer.minepi.com).

```bash
git clone https://github.com/tsotsoobi/gyema-pi-payments.git
cd gyema-pi-payments

npm install
cp .env.example .env   # then fill in PI_API_KEY

npm run dev            # nodemon, or: npm start
```

The server listens on `http://localhost:3001` by default. After first boot, hit `GET /jobs/seed` once to populate sample data.

The Pi SDK only runs inside the Pi Browser. Opened in a normal browser, the client falls back to demo mode.

## Environment variables

| Variable | Description |
|---|---|
| `PI_API_KEY` | Server-side Pi API key (sandbox) |
| `PI_API_BASE` | Pi Platform API base, default `https://api.minepi.com/v2` |
| `PORT` | Server port, default `3001` |

## Status

Testnet / sandbox only. Demo data, file-based storage, no audit. The production user experience lives in [gyema-app](https://github.com/tsotsoobi/gyema-app).

## License

Copyright (c) 2026 Pi Logistics Ltd. All rights reserved.
