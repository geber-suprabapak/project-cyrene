import { getConfig, type AppConfig } from "../config.js";
import { sendBatchNotifications } from "./expo-push.js";
import { getActiveSchedule, fetchTokens, type JadwalAbsensi } from "./supabase.js";

const DAY_NAMES = ["minggu", "senin", "selasa", "rabu", "kamis", "jumat", "sabtu"];
const MS_PER_MINUTE = 60_000;

let activeSchedule: JadwalAbsensi | null = null;
const scheduledJobs = new Map<string, ReturnType<typeof setTimeout>>();
let dailyTimer: ReturnType<typeof setTimeout> | null = null;

export interface ReminderPlan {
    id: string;
    delayMs: number;
    title: string;
    body: string;
}

export function getNow(timeZone: string): Date {
    const parts = new Intl.DateTimeFormat("en-US", {
        timeZone,
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
        hour12: false,
    }).formatToParts(new Date());

    const get = (type: string) => parts.find((p) => p.type === type)!.value;
    return new Date(+get("year"), +get("month") - 1, +get("day"), +get("hour"), +get("minute"), +get("second"));
}

function parseTimeToday(timeStr: string, now: Date): Date {
    const [h, m, s] = timeStr.split(":").map(Number);
    const target = new Date(now);
    target.setHours(h, m, s || 0, 0);
    return target;
}

function msUntilMidnight(now: Date): number {
    const midnight = new Date(now);
    midnight.setDate(midnight.getDate() + 1);
    midnight.setHours(0, 0, 0, 0);
    return midnight.getTime() - now.getTime();
}

const REMINDERS: {
    id: string;
    timeKey: keyof Pick<JadwalAbsensi, "mulai_masuk" | "selesai_masuk" | "mulai_pulang">;
    offsetMin: number;
    title: string;
    bodyFn: (s: JadwalAbsensi) => string;
}[] = [
    {
        id: "masuk_30min",
        timeKey: "mulai_masuk",
        offsetMin: -30,
        title: "⏰ Reminder Absen Masuk",
        bodyFn: (s) => `Waktu absen masuk dimulai pukul ${s.mulai_masuk.slice(0, 5)}`,
    },
    {
        id: "masuk_5min",
        timeKey: "selesai_masuk",
        offsetMin: -5,
        title: "⚠️ Segera Absen Masuk!",
        bodyFn: () => "Window absen masuk tutup dalam 5 menit",
    },
    {
        id: "pulang_30min",
        timeKey: "mulai_pulang",
        offsetMin: -30,
        title: "⏰ Reminder Absen Pulang",
        bodyFn: (s) => `Jangan lupa absen pulang, window pulang pukul ${s.mulai_pulang.slice(0, 5)}`,
    },
];

export function getReminderPlans(schedule: JadwalAbsensi, now: Date): ReminderPlan[] {
    return REMINDERS.flatMap(({ id, timeKey, offsetMin, title, bodyFn }) => {
        const target = parseTimeToday(schedule[timeKey], now);
        target.setMinutes(target.getMinutes() + offsetMin);

        const delayMs = target.getTime() - now.getTime();
        if (delayMs < 0) return [];

        return [{ id, delayMs, title, body: bodyFn(schedule) }];
    });
}

function scheduleReminders(config: AppConfig) {
    if (!activeSchedule) return;
    const schedule = activeSchedule;
    const plans = getReminderPlans(schedule, getNow(config.TZ));

    for (const { id, delayMs, title, body } of plans) {
        if (delayMs < 0) {
            console.log(`Reminder ${id} already passed`);
            continue;
        }

        console.log(`Scheduling ${id} in ${Math.round(delayMs / MS_PER_MINUTE)}min`);
        scheduledJobs.set(
            id,
            setTimeout(async () => {
                try {
                    const tokens = await fetchTokens();
                    if (tokens.length > 0) await sendBatchNotifications(tokens, { title, body });
                } catch (error) {
                    console.error(`Reminder ${id} failed:`, error);
                }
                scheduledJobs.delete(id);
            }, delayMs)
        );
    }
}

function scheduleDailyReschedule(config: AppConfig) {
    if (dailyTimer) clearTimeout(dailyTimer);
    const ms = msUntilMidnight(getNow(config.TZ));
    console.log(`Next reschedule in ${Math.round(ms / MS_PER_MINUTE)}min`);
    dailyTimer = setTimeout(async () => {
        clearScheduledJobs();
        await loadActiveSchedule(config);
    }, ms);
}

function clearScheduledJobs() {
    for (const [, timer] of scheduledJobs) clearTimeout(timer);
    scheduledJobs.clear();
}

export async function loadActiveSchedule(config: AppConfig = getConfig()) {
    const today = DAY_NAMES[getNow(config.TZ).getDay()];
    console.log(`Loading schedule for ${today} (${config.TZ})`);

    activeSchedule = await getActiveSchedule(today);

    if (activeSchedule) {
        console.log("Schedule:", {
            hari: activeSchedule.hari,
            masuk: activeSchedule.mulai_masuk,
            batas: activeSchedule.selesai_masuk,
            pulang: activeSchedule.mulai_pulang,
        });
        scheduleReminders(config);
    } else {
        console.log(`No schedule for ${today}`);
    }

    scheduleDailyReschedule(config);
}

export async function reloadSchedule(config: AppConfig = getConfig()) {
    clearScheduledJobs();
    await loadActiveSchedule(config);
}

export function stopScheduler() {
    clearScheduledJobs();
    if (dailyTimer) {
        clearTimeout(dailyTimer);
        dailyTimer = null;
    }
}
