import { serve } from "@hono/node-server";
import { createApp } from "./app.js";
import { getConfig } from "./config.js";
import { loadActiveSchedule, stopScheduler } from "./services/scheduler.js";

const config = getConfig();
const app = createApp(config);

const server = serve({
    fetch: app.fetch,
    port: config.PORT,
});

console.log(`Cyrene API running on :${config.PORT}`);

loadActiveSchedule(config).catch((error) => {
    console.error("Failed to load initial schedule:", error);
});

function shutdown(signal: NodeJS.Signals): void {
    console.log(`Received ${signal}, shutting down...`);
    stopScheduler();

    const forceExitTimer = setTimeout(() => {
        console.error("Graceful shutdown timed out");
        process.exit(1);
    }, 10_000);
    forceExitTimer.unref();

    server.close((error) => {
        clearTimeout(forceExitTimer);
        if (error) {
            console.error("Failed to close HTTP server:", error);
            process.exit(1);
        }
        process.exit(0);
    });
}

process.on("SIGINT", () => shutdown("SIGINT"));
process.on("SIGTERM", () => shutdown("SIGTERM"));
