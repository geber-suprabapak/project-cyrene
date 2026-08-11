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
CYRENE_IMAGE=ghcr.io/geber-suprabapak/project-cyrene:latest
BACKEND_NETWORK=skanida-backend
NODE_ENV=production
SUPABASE_URL=http://supabase-kong:8000
SUPABASE_SERVICE_KEY=your-service-role-key
API_BEARER_TOKEN=change-me-shared-secret
EXPO_ACCESS_TOKEN=
PORT=3000
TZ=Asia/Jakarta
```

| Variable | Required | Description |
| --- | --- | --- |
| `CYRENE_IMAGE` | Compose | GHCR image and immutable deployment tag |
| `BACKEND_NETWORK` | Compose | External Docker network shared with Supabase |
| `NODE_ENV` | No | Set to `production` in production |
| `SUPABASE_URL` | Yes | Supabase API gateway/Kong URL; use its internal service URL on-prem |
| `SUPABASE_SERVICE_KEY` | Yes | Supabase service role key |
| `API_BEARER_TOKEN` | Yes | Shared bearer token for `/webhook` and `/broadcast` |
| `EXPO_ACCESS_TOKEN` | No | Required only when Expo Push enhanced security is enabled |
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
| `perizinan` | `INSERT`, `UPDATE` | `http://cyrene-api:3000/webhook` |
| `absences` | `INSERT` | `http://cyrene-api:3000/webhook` |
| `jadwal_absensi` | `INSERT`, `UPDATE` | `http://cyrene-api:3000/webhook` |

The Supabase container that executes Database Webhooks must also join
`BACKEND_NETWORK`. Keep Cyrene internal; no public reverse proxy is required
when Supabase runs on the same Docker host.

## Docker Deployment

CI builds the image with npm and publishes it to GHCR. Portainer only pulls the
prebuilt image:

```bash
docker network create skanida-backend
docker compose pull
docker compose up -d
```

Convenience scripts:

```bash
pnpm docker:pull
pnpm docker:up
pnpm docker:logs
pnpm docker:down
```

## CI/CD

GitHub Actions builds and tests with npm, then builds the Docker image and publishes it to GitHub Container Registry.

Image:

```text
ghcr.io/geber-suprabapak/project-cyrene
```

Triggers:

- Pull requests to `main`: run CI and Docker build without pushing.
- Pushes to `main`: push `latest`, `main`, and `sha-<commit>` tags.
- Git tags like `v1.2.3`: push semantic version tags.
- Manual `workflow_dispatch`: build and push from the selected branch.

Pull the latest image:

```bash
docker pull ghcr.io/geber-suprabapak/project-cyrene:latest
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
