# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

Gyema is a P2P delivery app built as a **single self-contained HTML file** (`index.html`) targeting Pi Network's in-app browser. There is no build step, no package manager, no backend, and no separate JS/CSS files. All state is in-memory and resets on page reload.

## Running locally

Open `index.html` directly in a browser, or serve it with any static file server:

```bash
npx serve .
# or
python -m http.server 8080
```

The Pi SDK (`https://sdk.minepi.com/pi-sdk.js`) only works inside the Pi Browser. Outside it, `window.Pi` is undefined and the app automatically falls back to demo mode (`loginDemo()`).

## Architecture

Everything lives in `index.html` in three sections:

- **CSS** (`<style>`) — CSS custom properties drive the entire dark-purple/gold theme. All layout uses a fixed 430px-max mobile shell with `100dvh` screens stacked absolutely; only the `.active` screen is visible.
- **HTML** — Five screens (`#splash`, `#home`, `#trips`, `#track`, `#profile`) plus two bottom-sheet modals (`#job-modal`, `#escrow-modal`). Navigation never reloads the page — `nav(screenId)` toggles the `.active` class.
- **JavaScript** (`<script>`) — A single `state` object holds all runtime data (user, jobs, myTrips, stats). No framework, no modules.

## Key flows

- **Auth**: `initPi()` → Pi SDK → `afterLogin()`. Falls back to `loginDemo()` (hardcoded user `pillghana`, balance 24.75π) or `guestMode()`.
- **Pi payments**: `confirmEscrow()` calls `Pi.createPayment()`. The `onReadyForServerApproval` callback currently only logs to console — a real backend approval endpoint is not yet implemented.
- **Job lifecycle**: `open` → (escrow accepted) → `escrow` → (mark delivered) → removed from `myTrips`. A 5% platform fee is deducted on delivery (`job.pi * 0.95`).
- **Tracking**: looks up a job ID across `state.jobs` and `state.myTrips`; demo tracking ID is `GYM-00012A`.

## Pi Network specifics

- The app runs in **sandbox mode** (`Pi.init({ version: '2.0', sandbox: true })`). Switch to production by removing `sandbox: true`.
- `validation-key.txt` contains the Pi app domain-verification hash required by the Pi Developer Portal.
- Scopes requested: `username`, `payments`.
