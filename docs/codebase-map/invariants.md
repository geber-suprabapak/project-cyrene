# Invariants

## INV-CYRENE-001 — Do not redeploy the legacy service

**Rule:** This repository is archive/reference only; do not deploy it to production.
**Evidence:** `README.md` (ADR-0002 and ISS-09 notice).

## INV-CYRENE-002 — Historical HTTP inputs passed through handlers

**Rule:** Preserve handler validation/translation before notification services run.
**Evidence:** `src/handlers/webhook.ts`, `src/handlers/broadcast.ts`.

## INV-CYRENE-003 — Historical scheduler lifecycle is explicit

**Rule:** Reload/stop clears scheduled work before replacing it.
**Evidence:** `src/services/scheduler.ts`.

## INV-CYRENE-004 — Push delivery is separate from business state

**Rule:** A delivery outcome must not redefine the source event’s business status.
**Evidence:** `src/services/expo-push.ts`.
