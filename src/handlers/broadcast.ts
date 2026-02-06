import { Elysia, t } from "elysia";
import { fetchTokens } from "../services/supabase";
import { sendBatchNotifications } from "../services/expo-push";

export const broadcastHandler = new Elysia({ name: "broadcast" }).post(
    "/broadcast",
    async ({ body }) => {
        const { title, body: messageBody, data, target_user_ids } = body;

        try {
            const tokens = await fetchTokens(target_user_ids?.length ? target_user_ids : undefined);
            if (tokens.length === 0) return { success: false, error: "No tokens found", sent: 0 };

            const tickets = await sendBatchNotifications(tokens, { title, body: messageBody, data });
            const sent = tickets.filter((ticket) => ticket.status === "ok").length;

            return { success: true, sent, failed: tickets.length - sent, total_tokens: tokens.length };
        } catch (error) {
            console.error("Broadcast error:", error);
            return { success: false, error: String(error), sent: 0 };
        }
    },
    {
        body: t.Object({
            title: t.String({ minLength: 1 }),
            body: t.String({ minLength: 1 }),
            data: t.Optional(t.Any()),
            target_user_ids: t.Optional(t.Array(t.String())),
        }),
    }
);
