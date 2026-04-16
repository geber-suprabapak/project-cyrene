# Cyrene Notification API

Sistem push notification untuk aplikasi absensi. API menerima webhook dari Supabase, mengirim notifikasi via Expo Push, dan menjadwalkan reminder absensi otomatis.

**Stack:** Node.js 24 + Hono + Zod + Expo Server SDK + Supabase

## Cara Kerja

```text
Supabase DB (perizinan, absences, jadwal_absensi)
        |
        v  Database Webhook
+-------------------------------+
|   Cyrene Notification API     |
|                               |
|  POST /webhook                |  Supabase triggers
|  POST /broadcast              |  Admin manual push
|  GET  /health                 |  Health check
|                               |
|  Internal Scheduler           |  Reminder otomatis
+---------------+---------------+
                |
                v  Expo Push API
          User Devices (Android/iOS)
```

## Runtime Policy

- Local development: `pnpm`
- Docker and CI production install: `npm ci`
- Production runtime: compiled JavaScript via `node dist/index.js`

The repository intentionally keeps both lockfiles:

- `pnpm-lock.yaml` for local development
- `package-lock.json` for Docker/CI

## Endpoints

### `GET /health`

Public health check.

```json
{ "status": "ok", "timestamp": "2026-02-06T01:20:00.000Z" }
```

### Auth For Mutating Endpoints

`POST /webhook` and `POST /broadcast` require:

```http
Authorization: Bearer <API_BEARER_TOKEN>
```

Missing or invalid auth returns `401`. Invalid request bodies return `400`.

### `POST /webhook`

Menerima payload Supabase Database Webhooks.

```json
{
  "type": "INSERT",
  "table": "perizinan",
  "schema": "public",
  "record": {},
  "old_record": {}
}
```

Handled events:

| Table | Event | Condition | Action |
| --- | --- | --- | --- |
| `perizinan` | `INSERT` | `approval_status = pending` | Notify user that request was received |
| `perizinan` | `UPDATE` | status changes to `approved` | Notify user that request was approved |
| `perizinan` | `UPDATE` | status changes to `rejected` | Notify user that request was rejected |
| `absences` | `INSERT` | `status = Hadir` | Notify successful check-in |
| `absences` | `INSERT` | `status = Pulang` | Notify successful check-out |
| `jadwal_absensi` | any | any | Reload scheduler |

### `POST /broadcast`

Kirim push notification ke semua user atau user tertentu.

```json
{
  "title": "Pengumuman",
  "body": "Isi pesan notifikasi",
  "data": { "key": "value" },
  "target_user_ids": ["uuid1", "uuid2"]
}
```

`target_user_ids` is optional. Omit it or send an empty array to broadcast to all users with a notification token.

Successful response:

```json
{ "success": true, "sent": 45, "failed": 2, "total_tokens": 47 }
```

## Scheduler

Saat server start, scheduler membaca `jadwal_absensi` aktif untuk hari ini lalu menjadwalkan reminder:

| ID | Time | Message |
| --- | --- | --- |
| `masuk_30min` | `mulai_masuk - 30 minutes` | Reminder absen masuk |
| `masuk_5min` | `selesai_masuk - 5 minutes` | Reminder window absen masuk segera tutup |
| `pulang_30min` | `mulai_pulang - 30 minutes` | Reminder absen pulang |

Scheduler reloads at midnight and whenever the `jadwal_absensi` webhook is received.

## Setup

### 1. Install For Local Development

```bash
pnpm install
```

### 2. Environment Variables

Create `.env` from `.env.example`:

```env
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_KEY=your-service-role-key
API_BEARER_TOKEN=change-me-shared-secret
EXPO_ACCESS_TOKEN=optional-for-push-security
PORT=3000
TZ=Asia/Jakarta
```

| Variable | Required | Description |
| --- | --- | --- |
| `SUPABASE_URL` | Yes | Supabase project URL |
| `SUPABASE_SERVICE_KEY` | Yes | Supabase service role key |
| `API_BEARER_TOKEN` | Yes | Shared bearer token for `/webhook` and `/broadcast` |
| `EXPO_ACCESS_TOKEN` | No | Expo push access token |
| `PORT` | No | Defaults to `3000` |
| `TZ` | No | Defaults to `Asia/Jakarta` |

### 3. Run Locally

```bash
pnpm dev
pnpm typecheck
pnpm test
pnpm build
pnpm start
```

### 4. Database Permissions

Run the SQL in `supabase/grant_permissions.sql` from the Supabase SQL editor.

### 5. Supabase Webhooks

Configure Supabase Database Webhooks with the bearer token header.

| Table | Events | URL |
| --- | --- | --- |
| `perizinan` | `INSERT`, `UPDATE` | `https://your-domain/webhook` |
| `absences` | `INSERT` | `https://your-domain/webhook` |
| `jadwal_absensi` | `INSERT`, `UPDATE` | `https://your-domain/webhook` |

## Docker Deployment

Docker uses npm intentionally:

```bash
npm ci
npm run build
docker compose up -d --build
```

Convenience scripts:

```bash
pnpm docker:build
pnpm docker:up
pnpm docker:logs
pnpm docker:down
```

## Project Structure

```text
src/
├── app.ts                     Hono app factory and middleware
├── config.ts                  Environment validation
├── index.ts                   Node server entrypoint
├── handlers/
│   ├── webhook.ts             Supabase webhook routes
│   └── broadcast.ts           Admin broadcast route
└── services/
    ├── supabase.ts            Supabase client and queries
    ├── expo-push.ts           Expo push sender
    └── scheduler.ts           Reminder scheduler
```

Handlers own HTTP validation and response shape. Services stay framework-agnostic so they can be tested without starting the server.

## Testing With curl

```bash
curl http://localhost:3000/health
```

```bash
curl -X POST http://localhost:3000/broadcast \
  -H "Authorization: Bearer $API_BEARER_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"title": "Test", "body": "Hello!"}'
```

```bash
curl -X POST http://localhost:3000/webhook \
  -H "Authorization: Bearer $API_BEARER_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "type": "INSERT",
    "table": "perizinan",
    "record": {
      "id": "test-id",
      "user_id": "user-uuid",
      "approval_status": "pending",
      "kategori_izin": "sakit"
    }
  }'
```

## License

MIT
