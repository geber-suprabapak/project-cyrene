import Expo, { type ExpoPushTicket } from "expo-server-sdk";

const expo = new Expo({ accessToken: process.env.EXPO_ACCESS_TOKEN });

export interface NotificationPayload {
    title: string;
    body: string;
    data?: Record<string, unknown>;
}

export async function sendBatchNotifications(
    tokens: string[],
    payload: NotificationPayload
): Promise<ExpoPushTicket[]> {
    const validTokens = tokens.filter(Expo.isExpoPushToken);
    if (validTokens.length === 0) return [];

    const messages = validTokens.map((to) => ({
        to,
        ...payload,
        sound: "default" as const,
        channelId: "skanida-default",
    }));

    const tickets: ExpoPushTicket[] = [];

    for (const chunk of expo.chunkPushNotifications(messages)) {
        try {
            tickets.push(...(await expo.sendPushNotificationsAsync(chunk)));
        } catch (error) {
            console.error("Push notification error:", error);
        }
    }

    return tickets;
}
