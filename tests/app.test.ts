import { beforeEach, describe, expect, it, vi } from "vitest";
import { createApp } from "../src/app.js";
import type { AppConfig } from "../src/config.js";

const mocks = vi.hoisted(() => ({
    fetchTokens: vi.fn(),
    sendBatchNotifications: vi.fn(),
    reloadSchedule: vi.fn(),
}));

vi.mock("../src/services/supabase.js", () => ({
    fetchTokens: mocks.fetchTokens,
    getActiveSchedule: vi.fn(),
}));

vi.mock("../src/services/expo-push.js", () => ({
    sendBatchNotifications: mocks.sendBatchNotifications,
}));

vi.mock("../src/services/scheduler.js", () => ({
    reloadSchedule: mocks.reloadSchedule,
    loadActiveSchedule: vi.fn(),
    stopScheduler: vi.fn(),
}));

const config: AppConfig = {
    NODE_ENV: "test",
    PORT: 3000,
    TZ: "Asia/Jakarta",
    SUPABASE_URL: "https://example.supabase.co",
    SUPABASE_SERVICE_KEY: "service-key",
    API_BEARER_TOKEN: "test-token",
};

const authHeaders = {
    Authorization: `Bearer ${config.API_BEARER_TOKEN}`,
    "Content-Type": "application/json",
};

function requestJson(path: string, body: unknown) {
    return createApp(config).request(path, {
        method: "POST",
        headers: authHeaders,
        body: JSON.stringify(body),
    });
}

describe("Hono app", () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it("serves health without authentication", async () => {
        const response = await createApp(config).request("/health");
        const body = await response.json();

        expect(response.status).toBe(200);
        expect(body).toMatchObject({ status: "ok" });
        expect(typeof body.timestamp).toBe("string");
    });

    it("requires bearer auth for webhook and broadcast", async () => {
        const app = createApp(config);

        const webhookResponse = await app.request("/webhook", { method: "POST" });
        const broadcastResponse = await app.request("/broadcast", { method: "POST" });
        const invalidTokenResponse = await app.request("/broadcast", {
            method: "POST",
            headers: { Authorization: "Bearer wrong-token" },
        });

        expect(webhookResponse.status).toBe(401);
        expect(broadcastResponse.status).toBe(401);
        expect(invalidTokenResponse.status).toBe(401);
    });

    it("returns 400 for invalid request bodies", async () => {
        const invalidShape = await requestJson("/broadcast", {});
        const invalidJson = await createApp(config).request("/broadcast", {
            method: "POST",
            headers: authHeaders,
            body: "{",
        });

        expect(invalidShape.status).toBe(400);
        expect(invalidJson.status).toBe(400);
    });

    it("dispatches perizinan webhook notifications", async () => {
        mocks.fetchTokens.mockResolvedValue(["ExponentPushToken[valid-token]"]);
        mocks.sendBatchNotifications.mockResolvedValue([{ status: "ok" }]);

        const response = await requestJson("/webhook", {
            type: "INSERT",
            table: "perizinan",
            record: {
                id: "permission-1",
                user_id: "user-1",
                approval_status: "pending",
                kategori_izin: "sakit",
            },
        });

        expect(response.status).toBe(200);
        expect(await response.json()).toEqual({ success: true });
        expect(mocks.fetchTokens).toHaveBeenCalledWith(["user-1"]);
        expect(mocks.sendBatchNotifications).toHaveBeenCalledWith(
            ["ExponentPushToken[valid-token]"],
            expect.objectContaining({
                data: { type: "perizinan", id: "permission-1" },
            })
        );
    });

    it("reloads scheduler for jadwal_absensi webhooks", async () => {
        const response = await requestJson("/webhook", {
            type: "UPDATE",
            table: "jadwal_absensi",
            record: { id: "schedule-1" },
        });

        expect(response.status).toBe(200);
        expect(mocks.reloadSchedule).toHaveBeenCalledWith(config);
    });

    it("returns broadcast send counts", async () => {
        mocks.fetchTokens.mockResolvedValue(["ExponentPushToken[one]", "ExponentPushToken[two]"]);
        mocks.sendBatchNotifications.mockResolvedValue([{ status: "ok" }, { status: "error" }]);

        const response = await requestJson("/broadcast", {
            title: "Pengumuman",
            body: "Halo",
            data: { type: "broadcast" },
            target_user_ids: ["user-1", "user-2"],
        });

        expect(response.status).toBe(200);
        expect(await response.json()).toEqual({
            success: true,
            sent: 1,
            failed: 1,
            total_tokens: 2,
        });
        expect(mocks.fetchTokens).toHaveBeenCalledWith(["user-1", "user-2"]);
    });
});
