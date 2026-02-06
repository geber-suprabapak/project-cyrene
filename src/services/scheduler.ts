import { getActiveSchedule, fetchTokens, type JadwalAbsensi } from "./supabase";
import { sendBatchNotifications } from "./expo-push";

const TIMEZONE = process.env.TZ || "Asia/Jakarta";
const DAY_NAMES = ["minggu", "senin", "selasa", "rabu", "kamis", "jumat", "sabtu"];

let activeSchedule: JadwalAbsensi | null = null;
const scheduledJobs = new Map<string, Timer>();
let dailyTimer: Timer | null = null;

function getNow(): Date {
    const parts = new Intl.DateTimeFormat("en-US", {
        timeZone: TIMEZONE,
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

function parseTimeToday(timeStr: string): Date {
    const [h, m, s] = timeStr.split(":").map(Number);
    const now = getNow();
    now.setHours(h, m, s || 0, 0);
    return now;
}

function msUntilMidnight(): number {
    const now = getNow();
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

function scheduleReminders() {
    if (!activeSchedule) return;
    const schedule = activeSchedule;

    for (const { id, timeKey, offsetMin, title, bodyFn } of REMINDERS) {
        const target = parseTimeToday(schedule[timeKey]);
        target.setMinutes(target.getMinutes() + offsetMin);

        const delay = target.getTime() - getNow().getTime();
        if (delay < 0) {
            console.log(`Reminder ${id} already passed`);
            continue;
        }

        console.log(`Scheduling ${id} in ${Math.round(delay / 60000)}min`);
        scheduledJobs.set(
            id,
            setTimeout(async () => {
                try {
                    const tokens = await fetchTokens();
                    if (tokens.length > 0) await sendBatchNotifications(tokens, { title, body: bodyFn(schedule) });
                } catch (error) {
                    console.error(`Reminder ${id} failed:`, error);
                }
                scheduledJobs.delete(id);
            }, delay)
        );
    }
}

function scheduleDailyReschedule() {
    if (dailyTimer) clearTimeout(dailyTimer);
    const ms = msUntilMidnight();
    console.log(`Next reschedule in ${Math.round(ms / 60000)}min`);
    dailyTimer = setTimeout(async () => {
        clearScheduledJobs();
        await loadActiveSchedule();
    }, ms);
}

function clearScheduledJobs() {
    for (const [, timer] of scheduledJobs) clearTimeout(timer);
    scheduledJobs.clear();
}

export async function loadActiveSchedule() {
    const today = DAY_NAMES[getNow().getDay()];
    console.log(`Loading schedule for ${today} (${TIMEZONE})`);

    activeSchedule = await getActiveSchedule(today);

    if (activeSchedule) {
        console.log("Schedule:", {
            hari: activeSchedule.hari,
            masuk: activeSchedule.mulai_masuk,
            batas: activeSchedule.selesai_masuk,
            pulang: activeSchedule.mulai_pulang,
        });
        scheduleReminders();
    } else {
        console.log(`No schedule for ${today}`);
    }

    scheduleDailyReschedule();
}

export async function reloadSchedule() {
    clearScheduledJobs();
    await loadActiveSchedule();
}
