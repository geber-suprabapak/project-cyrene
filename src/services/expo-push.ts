import { Expo, type ExpoPushMessage, type ExpoPushTicket } from "expo-server-sdk";
import { getConfig } from "../config.js";

let expo: Expo | null = null;

function getExpoClient(): Expo {
    if (!expo) {
        const config = getConfig();
        expo = new Expo({ accessToken: config.EXPO_ACCESS_TOKEN });
    }

    return expo;
}

export interface NotificationPayload {
    title: string;
    body: string;
    data?: Record<string, unknown>;
}

export function buildPushMessages(tokens: string[], payload: NotificationPayload): ExpoPushMessage[] {
    return tokens.filter(Expo.isExpoPushToken).map((to) => ({
        to,
        ...payload,
        sound: "default" as const,
        channelId: "skanida-default",
    }));
}

export async function sendBatchNotifications(
    tokens: string[],
    payload: NotificationPayload
): Promise<ExpoPushTicket[]> {
    const messages = buildPushMessages(tokens, payload);
    if (messages.length === 0) return [];

    const tickets: ExpoPushTicket[] = [];
    const expoClient = getExpoClient();

    for (const chunk of expoClient.chunkPushNotifications(messages)) {
        try {
            tickets.push(...(await expoClient.sendPushNotificationsAsync(chunk)));
        } catch (error) {
            console.error("Push notification error:", error);
        }
    }

    return tickets;
}
