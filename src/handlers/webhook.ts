import { zValidator } from "@hono/zod-validator";
import { z } from "zod";
import { fetchTokens } from "../services/supabase.js";
import { sendBatchNotifications, type NotificationPayload } from "../services/expo-push.js";
import { reloadSchedule } from "../services/scheduler.js";
import type { AppEnv } from "../types.js";
import type { Hono } from "hono";

const DatabaseRecordSchema = z.record(z.string(), z.unknown());

const WebhookSchema = z.object({
    type: z.enum(["INSERT", "UPDATE", "DELETE"]),
    table: z.string().min(1),
    schema: z.string().optional(),
    record: DatabaseRecordSchema,
    old_record: DatabaseRecordSchema.nullable().optional(),
});

type DatabaseRecord = z.infer<typeof DatabaseRecordSchema>;
type WebhookPayload = z.infer<typeof WebhookSchema>;

const validateWebhookBody = zValidator("json", WebhookSchema, (result, c) => {
    if (!result.success) {
        return c.json({ success: false, error: "Invalid request body" }, 400);
    }
});

async function notifyUser(userId: unknown, notification: NotificationPayload) {
    if (typeof userId !== "string" || userId.length === 0) {
        console.warn("Notification skipped: missing user_id");
        return;
    }

    console.log("Notify user:", { userId, title: notification.title, type: notification.data?.type });
    const tokens = await fetchTokens([userId]);
    console.log("Notify tokens:", { userId, tokenCount: tokens.length });
    if (tokens.length > 0) await sendBatchNotifications(tokens, notification);
}

async function handlePerizinan(type: WebhookPayload["type"], record: DatabaseRecord, oldRecord?: DatabaseRecord | null) {
    if (type === "INSERT" && record.approval_status === "pending") {
        await notifyUser(record.user_id, {
            title: "📋 Perizinan Diterima",
            body: `Perizinan ${record.kategori_izin} Anda telah diterima dan sedang diproses`,
            data: { type: "perizinan", id: record.id },
        });
    }

    if (type !== "UPDATE") return;

    if (oldRecord?.approval_status !== "approved" && record.approval_status === "approved") {
        await notifyUser(record.user_id, {
            title: "✅ Perizinan Disetujui",
            body: `Perizinan ${record.kategori_izin} Anda telah disetujui`,
            data: { type: "perizinan_approved", id: record.id },
        });
    } else if (oldRecord?.approval_status !== "rejected" && record.approval_status === "rejected") {
        await notifyUser(record.user_id, {
            title: "❌ Perizinan Ditolak",
            body: `Perizinan ${record.kategori_izin} ditolak. Alasan: ${record.rejection_reason || "Tidak ada alasan"}`,
            data: { type: "perizinan_rejected", id: record.id },
        });
    }
}

async function handleAbsences(type: WebhookPayload["type"], record: DatabaseRecord) {
    if (type !== "INSERT") return;

    console.log("Absence insert:", {
        id: record?.id,
        userId: record?.user_id,
        status: record?.status,
    });

    let notification: NotificationPayload | undefined;
    if (record.status === "Hadir") {
        notification = {
            title: "🌅 Absen Masuk Berhasil",
            body: "Selamat pagi! Absen masuk Anda berhasil dicatat",
            data: { type: "absen_masuk", id: record.id },
        };
    } else if (record.status === "Terlambat") {
        notification = {
            title: "Absensi Masuk (Terlambat)",
            body: "Absensi masuk Anda tercatat terlambat. Terima kasih!",
            data: { type: "absence_checkin", id: record.id },
        };
    } else if (record.status === "Pulang") {
        notification = {
            title: "🌇 Absen Pulang Berhasil",
            body: "Absen pulang berhasil dicatat. Selamat beristirahat!",
            data: { type: "absen_pulang", id: record.id },
        };
    }

    if (!notification) {
        console.warn("Absence status not mapped to notification:", { status: record?.status });
        return;
    }

    await notifyUser(record.user_id, notification);
}

export function registerWebhookRoutes(app: Hono<AppEnv>): void {
    app.post("/webhook", validateWebhookBody, async (c) => {
        const body = c.req.valid("json");
        console.log("Webhook received:", {
            type: body.type,
            table: body.table,
            schema: body.schema,
        });
        try {
            switch (body.table) {
                case "perizinan":
                    console.log("Webhook dispatch: perizinan");
                    await handlePerizinan(body.type, body.record, body.old_record);
                    break;
                case "absences":
                    console.log("Webhook dispatch: absences");
                    await handleAbsences(body.type, body.record);
                    break;
                case "jadwal_absensi":
                    console.log("Webhook dispatch: jadwal_absensi");
                    await reloadSchedule(c.get("config"));
                    break;
                default:
                    console.warn("Webhook table not handled:", { table: body.table });
                    break;
            }
            return c.json({ success: true });
        } catch (error) {
            console.error("Webhook error:", error);
            return c.json({ success: false, error: "Internal server error" }, 500);
        }
    });
}
