# Cyrene Notification API

Sistem push notification untuk aplikasi absensi. Menerima webhook dari Supabase, mengirim notifikasi via Expo Push, dan menjadwalkan reminder absensi otomatis.

**Stack:** Bun + ElysiaJS + Expo Server SDK + Supabase

## Cara Kerja

```
Supabase DB (perizinan, absences, jadwal_absensi)
        │
        ▼  Database Webhook
┌───────────────────────────────────┐
│       Cyrene Notification API     │
│                                   │
│  POST /webhook                    │  ← Supabase triggers
│  POST /broadcast                  │  ← Admin manual push
│  GET  /health                     │  ← Health check
│                                   │
│  Internal Scheduler               │  ← Reminder otomatis
│  • 30min sebelum masuk            │
│  • 5min sebelum window tutup      │
│  • 30min sebelum pulang           │
└───────────────┬───────────────────┘
                │
                ▼  Expo Push API
          User Devices (Android/iOS)
```

**Flow:**
1. Supabase mengirim webhook saat ada perubahan di tabel `perizinan`, `absences`, atau `jadwal_absensi`
2. API memproses event dan mengirim push notification ke user yang relevan
3. Saat startup (dan setiap tengah malam), scheduler membaca `jadwal_absensi` aktif lalu menjadwalkan reminder via `setTimeout`
4. Jika `jadwal_absensi` diubah, webhook otomatis me-reload scheduler

## Endpoints

### `GET /health`

```json
{ "status": "ok", "timestamp": "2026-02-06T01:20:00.000Z" }
```

### `POST /webhook`

Menerima payload webhook dari Supabase Database Webhooks.

**Body:**
```json
{
  "type": "INSERT | UPDATE | DELETE",
  "table": "perizinan | absences | jadwal_absensi",
  "schema": "public",
  "record": { },
  "old_record": { }
}
```

**Event yang dihandle:**

| Tabel | Event | Kondisi | Notifikasi |
|-------|-------|---------|------------|
| `perizinan` | INSERT | `approval_status = pending` | 📋 Perizinan Diterima |
| `perizinan` | UPDATE | `approval_status → approved` | ✅ Perizinan Disetujui |
| `perizinan` | UPDATE | `approval_status → rejected` | ❌ Perizinan Ditolak + alasan |
| `absences` | INSERT | `status = Hadir` | 🌅 Absen Masuk Berhasil |
| `absences` | INSERT | `status = Pulang` | 🌇 Absen Pulang Berhasil |
| `jadwal_absensi` | * | any | Reload scheduler |

### `POST /broadcast`

Kirim push notification ke semua user atau user tertentu.

**Body:**
```json
{
  "title": "Pengumuman",
  "body": "Isi pesan notifikasi",
  "data": { "key": "value" },
  "target_user_ids": ["uuid1", "uuid2"]
}
```

- `data` — opsional, data tambahan yang dikirim ke device
- `target_user_ids` — opsional, kosongkan atau hilangkan untuk broadcast ke semua user

**Response:**
```json
{ "success": true, "sent": 45, "failed": 2, "total_tokens": 47 }
```

## Scheduler / Reminder

Scheduler membaca tabel `jadwal_absensi` yang aktif untuk hari ini, lalu menjadwalkan 3 reminder:

| ID | Waktu | Pesan |
|----|-------|-------|
| `masuk_30min` | `mulai_masuk` - 30min | ⏰ Waktu absen masuk dimulai pukul {jam} |
| `masuk_5min` | `selesai_masuk` - 5min | ⚠️ Window absen masuk tutup dalam 5 menit |
| `pulang_30min` | `mulai_pulang` - 30min | ⏰ Jangan lupa absen pulang |

Reminder dikirim ke **semua user** yang punya `notification_token`.

**Lifecycle:**
- Saat server start → `loadActiveSchedule()` → schedule reminders + schedule reschedule tengah malam
- Tengah malam → clear semua jobs → load ulang jadwal hari baru
- Webhook `jadwal_absensi` → `reloadSchedule()` → clear + load ulang

## Database

### `user_profiles`
| Kolom | Tipe | Keterangan |
|-------|------|------------|
| `id` | uuid | PK |
| `notification_token` | text | Expo Push Token (`ExponentPushToken[xxx]`) |

### `jadwal_absensi`
| Kolom | Tipe | Contoh | Keterangan |
|-------|------|--------|------------|
| `id` | uuid | | PK |
| `hari` | varchar | `"senin"` | Hari dalam lowercase |
| `mulai_masuk` | varchar | `"06:30:00"` | Awal window masuk |
| `selesai_masuk` | varchar | `"07:30:00"` | Akhir window masuk |
| `mulai_pulang` | varchar | `"15:00:00"` | Awal window pulang |
| `is_active` | bool | `true` | Aktif/nonaktif |

### `perizinan`
| Kolom | Tipe | Keterangan |
|-------|------|------------|
| `id` | uuid | PK |
| `user_id` | uuid | FK → `user_profiles` |
| `approval_status` | text | `pending` / `approved` / `rejected` |
| `rejection_reason` | text | Alasan jika ditolak |
| `kategori_izin` | text | Jenis izin (sakit, cuti, dll) |

### `absences`
| Kolom | Tipe | Keterangan |
|-------|------|------------|
| `id` | uuid | PK |
| `user_id` | uuid | FK → `user_profiles` |
| `status` | text | `Hadir` (masuk) / `Pulang` |
| `date` | date | Tanggal absensi |

## Setup

### 1. Install

```bash
bun install
```

### 2. Environment Variables

Buat file `.env`:

```env
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_KEY=your-service-role-key
EXPO_ACCESS_TOKEN=your-expo-token    # opsional, untuk push security
PORT=3000                            # opsional, default 3000
TZ=Asia/Jakarta                      # opsional, default Asia/Jakarta
```

| Variable | Required | Keterangan |
|----------|----------|------------|
| `SUPABASE_URL` | Ya | URL project Supabase |
| `SUPABASE_SERVICE_KEY` | Ya | Service role key (bukan anon key) |
| `EXPO_ACCESS_TOKEN` | Tidak | Expo push security token |
| `PORT` | Tidak | Port server (default: `3000`) |
| `TZ` | Tidak | IANA timezone (default: `Asia/Jakarta`) |

**Timezone Indonesia:**
| Zona | IANA | UTC |
|------|------|-----|
| WIB | `Asia/Jakarta` | +7 |
| WITA | `Asia/Makassar` | +8 |
| WIT | `Asia/Jayapura` | +9 |

### 3. Database Permissions

Jalankan di Supabase SQL Editor (atau lihat `supabase/grant_permissions.sql`):

```sql
GRANT SELECT ON user_profiles TO service_role;
GRANT SELECT ON jadwal_absensi TO service_role;
GRANT SELECT ON perizinan TO service_role;
GRANT SELECT ON absences TO service_role;
```

### 4. Supabase Webhooks

Buat di Supabase Dashboard → Database → Webhooks:

| Tabel | Events | URL |
|-------|--------|-----|
| `perizinan` | INSERT, UPDATE | `https://your-domain/webhook` |
| `absences` | INSERT | `https://your-domain/webhook` |
| `jadwal_absensi` | INSERT, UPDATE | `https://your-domain/webhook` |

### 5. Jalankan

```bash
bun run dev      # development (hot reload)
bun run start    # production
```

## Project Structure

```
src/
├── index.ts                  Entry point, register plugins
├── handlers/
│   ├── webhook.ts            Handle Supabase database webhooks
│   └── broadcast.ts          Handle admin broadcast notifications
└── services/
    ├── supabase.ts           Supabase client, fetchTokens, getActiveSchedule
    ├── expo-push.ts          Expo push notification sender (batch + chunking)
    └── scheduler.ts          Reminder scheduler (setTimeout-based)
```

**Arsitektur:**
- **Handlers** = Elysia plugins yang define routes. Masing-masing file export satu Elysia instance.
- **Services** = Pure functions, tidak bergantung pada Elysia context. Bisa dipanggil dari handler maupun scheduler.
- `fetchTokens(userIds?)` — satu fungsi untuk fetch token spesifik user atau semua user
- `sendBatchNotifications(tokens, payload)` — otomatis filter token valid, chunk, dan kirim via Expo
- Scheduler pakai config array `REMINDERS[]` — gampang ditambah/diubah reminder tanpa ubah logic

## Testing

### Health check
```bash
curl http://localhost:3000/health
```

### Broadcast ke semua user
```bash
curl -X POST http://localhost:3000/broadcast \
  -H "Content-Type: application/json" \
  -d '{"title": "Test", "body": "Hello!"}'
```

### Broadcast ke user tertentu
```bash
curl -X POST http://localhost:3000/broadcast \
  -H "Content-Type: application/json" \
  -d '{"title": "Test", "body": "Hello!", "target_user_ids": ["uuid-1"]}'
```

### Simulate webhook perizinan
```bash
curl -X POST http://localhost:3000/webhook \
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

### Simulate webhook absensi
```bash
curl -X POST http://localhost:3000/webhook \
  -H "Content-Type: application/json" \
  -d '{
    "type": "INSERT",
    "table": "absences",
    "record": {
      "id": "absence-id",
      "user_id": "user-uuid",
      "status": "Hadir"
    }
  }'
```

## License

MIT
