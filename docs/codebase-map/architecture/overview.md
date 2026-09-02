# Cyrene Architecture

Historically, `createApp` loaded configuration and registered `/webhook` and `/broadcast`. Handlers called services for token/schedule lookup and Expo push delivery; scheduler lifecycle was separate from HTTP-triggered work.

This is not active topology: the README records replacement by Astra’s internal transactional notification outbox worker. The inspected legacy sources establish Supabase-compatible data and Expo dependencies, but no direct Astra runtime dependency.

**Evidence:** `src/app.ts`, `src/handlers/`, `src/services/`.
