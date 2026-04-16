---
trigger: always_on
---

# Hono + Node API Rule

This repository runs a mission-critical notification API on Node.js and Hono.

- Use Hono route modules registered from `src/app.ts`; do not introduce Elysia or Bun runtime APIs.
- Keep local development on `pnpm`.
- Keep Docker and CI production installs on `npm ci` using `package-lock.json`.
- Production must run compiled JavaScript with `node dist/index.js`.
- Validate public request bodies with Zod and protect mutating notification endpoints with bearer auth.
- Keep services framework-agnostic so they can be tested without starting the HTTP server.
