import { Hono } from "hono";
import { bearerAuth } from "hono/bearer-auth";
import { bodyLimit } from "hono/body-limit";
import { HTTPException } from "hono/http-exception";
import { logger } from "hono/logger";
import { secureHeaders } from "hono/secure-headers";
import { getConfig, type AppConfig } from "./config.js";
import { registerBroadcastRoutes } from "./handlers/broadcast.js";
import { registerWebhookRoutes } from "./handlers/webhook.js";
import type { AppEnv } from "./types.js";

const MAX_JSON_BODY_SIZE = 1024 * 1024;

export function createApp(config: AppConfig = getConfig()): Hono<AppEnv> {
    const app = new Hono<AppEnv>();

    app.use("*", secureHeaders());

    if (config.NODE_ENV !== "test") {
        app.use("*", logger());
    }

    app.use(
        "*",
        bodyLimit({
            maxSize: MAX_JSON_BODY_SIZE,
            onError: (c) => c.json({ success: false, error: "Request body too large" }, 413),
        })
    );

    app.use("*", async (c, next) => {
        c.set("config", config);
        await next();
    });

    app.get("/health", (c) => c.json({ status: "ok", timestamp: new Date().toISOString() }));

    const auth = bearerAuth({ token: config.API_BEARER_TOKEN });
    app.use("/webhook", auth);
    app.use("/broadcast", auth);

    registerWebhookRoutes(app);
    registerBroadcastRoutes(app);

    app.notFound((c) => c.json({ success: false, error: "Not found" }, 404));

    app.onError((error, c) => {
        if (error instanceof HTTPException) {
            const message = error.status === 400 ? "Invalid request body" : error.message;
            return c.json({ success: false, error: message }, error.status);
        }

        console.error("Unhandled request error:", error);
        return c.json({ success: false, error: "Internal server error" }, 500);
    });

    return app;
}
