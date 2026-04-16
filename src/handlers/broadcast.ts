import { zValidator } from "@hono/zod-validator";
import { z } from "zod";
import { fetchTokens } from "../services/supabase.js";
import { sendBatchNotifications } from "../services/expo-push.js";
import type { AppEnv } from "../types.js";
import type { Hono } from "hono";

const BroadcastSchema = z.object({
    title: z.string().min(1),
    body: z.string().min(1),
    data: z.record(z.string(), z.unknown()).optional(),
    target_user_ids: z.array(z.string().min(1)).optional(),
});

const validateBroadcastBody = zValidator("json", BroadcastSchema, (result, c) => {
    if (!result.success) {
        return c.json({ success: false, error: "Invalid request body" }, 400);
    }
});

export function registerBroadcastRoutes(app: Hono<AppEnv>): void {
    app.post("/broadcast", validateBroadcastBody, async (c) => {
        const body = c.req.valid("json");
        const { title, body: messageBody, data, target_user_ids } = body;
        console.log("Broadcast received:", {
            title,
            targetCount: target_user_ids?.length ?? 0,
        });

        try {
            const tokens = await fetchTokens(target_user_ids?.length ? target_user_ids : undefined);
            console.log("Broadcast tokens:", { tokenCount: tokens.length });
            if (tokens.length === 0) return c.json({ success: false, error: "No tokens found", sent: 0 });

            const tickets = await sendBatchNotifications(tokens, { title, body: messageBody, data });
            const sent = tickets.filter((ticket) => ticket.status === "ok").length;

            console.log("Broadcast sent:", {
                sent,
                failed: tickets.length - sent,
            });

            return c.json({ success: true, sent, failed: tickets.length - sent, total_tokens: tokens.length });
        } catch (error) {
            console.error("Broadcast error:", error);
            return c.json({ success: false, error: String(error), sent: 0 }, 500);
        }
    });
}
