# Legacy Notification Delivery

This flow is historical only; do not deploy it in production. The active replacement is documented in `README.md` as Astra’s internal transactional notification outbox worker.

1. A webhook event or broadcast HTTP request reached a registered handler.
2. The handler validates/maps its payload and resolves target user/device data through services.
3. `buildPushMessages` prepares Expo messages and `sendBatchNotifications` delivers batches.
4. Scheduler-originated reminders followed the same service delivery boundary after active schedules were loaded.

**Evidence:** `src/handlers/webhook.ts`, `src/handlers/broadcast.ts`, `src/services/scheduler.ts`, `src/services/expo-push.ts`.
