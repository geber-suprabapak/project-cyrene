import { describe, expect, it } from "vitest";
import { buildPushMessages, sendBatchNotifications } from "../src/services/expo-push.js";

describe("expo push service", () => {
    it("filters invalid Expo push tokens", () => {
        const messages = buildPushMessages(["bad-token", "ExponentPushToken[valid-token]"], {
            title: "Halo",
            body: "Test",
            data: { type: "test" },
        });

        expect(messages).toEqual([
            {
                to: "ExponentPushToken[valid-token]",
                title: "Halo",
                body: "Test",
                data: { type: "test" },
                sound: "default",
                channelId: "skanida-default",
            },
        ]);
    });

    it("does not create an Expo client when there are no valid tokens", async () => {
        await expect(sendBatchNotifications(["bad-token"], { title: "Halo", body: "Test" })).resolves.toEqual([]);
    });
});
