import { Elysia, t } from "elysia";
import { fetchTokens } from "../services/supabase";
import { sendBatchNotifications, type NotificationPayload } from "../services/expo-push";
import { reloadSchedule } from "../services/scheduler";

const WebhookSchema = t.Object({
    type: t.Union([t.Literal("INSERT"), t.Literal("UPDATE"), t.Literal("DELETE")]),
    table: t.String(),
    schema: t.Optional(t.String()),
    record: t.Any(),
    old_record: t.Optional(t.Any()),
});

async function notifyUser(userId: string, notification: NotificationPayload) {
    const tokens = await fetchTokens([userId]);
    if (tokens.length > 0) await sendBatchNotifications(tokens, notification);
}

async function handlePerizinan(type: string, record: any, oldRecord: any) {
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

async function handleAbsences(type: string, record: any) {
    if (type !== "INSERT") return;

    const notifications: Record<string, NotificationPayload> = {
        Hadir: {
            title: "🌅 Absen Masuk Berhasil",
            body: "Selamat pagi! Absen masuk Anda berhasil dicatat",
            data: { type: "absen_masuk", id: record.id },
        },
        Pulang: {
            title: "🌇 Absen Pulang Berhasil",
            body: "Absen pulang berhasil dicatat. Selamat beristirahat!",
            data: { type: "absen_pulang", id: record.id },
        },
    };

    const notification = notifications[record.status];
    if (notification) await notifyUser(record.user_id, notification);
}

export const webhookHandler = new Elysia({ name: "webhook" }).post(
    "/webhook",
    async ({ body, set }) => {
        console.log(`Webhook: ${body.type} on ${body.table}`);
        try {
            switch (body.table) {
                case "perizinan":
                    await handlePerizinan(body.type, body.record, body.old_record);
                    break;
                case "absences":
                    await handleAbsences(body.type, body.record);
                    break;
                case "jadwal_absensi":
                    await reloadSchedule();
                    break;
            }
            return { success: true };
        } catch (error) {
            console.error("Webhook error:", error);
            set.status = 500;
            return { success: false, error: String(error) };
        }
    },
    { body: WebhookSchema }
);
