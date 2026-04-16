import { describe, expect, it } from "vitest";
import { getReminderPlans } from "../src/services/scheduler.js";
import type { JadwalAbsensi } from "../src/services/supabase.js";

const schedule: JadwalAbsensi = {
    id: "schedule-1",
    hari: "senin",
    mulai_masuk: "06:30:00",
    selesai_masuk: "07:30:00",
    mulai_pulang: "15:00:00",
    is_active: true,
};

describe("scheduler reminder planning", () => {
    it("calculates reminder offsets from today's schedule", () => {
        const now = new Date(2026, 0, 1, 5, 50, 0);
        const plans = getReminderPlans(schedule, now);

        expect(plans.map((plan) => [plan.id, plan.delayMs])).toEqual([
            ["masuk_30min", 10 * 60_000],
            ["masuk_5min", 95 * 60_000],
            ["pulang_30min", 520 * 60_000],
        ]);
    });

    it("skips reminders that have already passed", () => {
        const now = new Date(2026, 0, 1, 7, 26, 0);
        const plans = getReminderPlans(schedule, now);

        expect(plans.map((plan) => plan.id)).toEqual(["pulang_30min"]);
    });
});
