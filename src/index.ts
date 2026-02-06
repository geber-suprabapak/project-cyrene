import { Elysia } from "elysia";
import { webhookHandler } from "./handlers/webhook";
import { broadcastHandler } from "./handlers/broadcast";
import { loadActiveSchedule } from "./services/scheduler";

const PORT = process.env.PORT || 3000;

new Elysia()
    .get("/health", () => ({ status: "ok", timestamp: new Date().toISOString() }))
    .use(webhookHandler)
    .use(broadcastHandler)
    .onStart(async () => {
        console.log(`Cyrene API running on :${PORT}`);
        await loadActiveSchedule();
    })
    .listen(PORT);
