# Modules

## App composition

**Historical purpose:** Load configuration, register HTTP routes, and own service lifecycle.
**Entry point:** `src/app.ts`.

## Handlers

**Historical purpose:** Validate and translate webhook/broadcast HTTP requests.
**Entry points:** `src/handlers/webhook.ts`, `src/handlers/broadcast.ts`.

## Services

**Historical purpose:** Read tokens/schedules, create reminder jobs, and send Expo push batches.
**Entry points:** `src/services/{supabase,scheduler,expo-push}.ts`.
