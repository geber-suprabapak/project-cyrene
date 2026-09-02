# Decision Index

| Decision | Status | Source | Affects |
| --- | --- | --- | --- |
| Decommission Cyrene in favor of Astra notification outbox | Documented | `README.md` (ADR-0002, ISS-09) | Production topology |
| HTTP handlers separate input translation from delivery | Observed | `src/handlers/` | API boundary |
| Scheduling has explicit reload/stop lifecycle | Observed | `src/services/scheduler.ts` | Reminder jobs |

Rationale not recorded.
