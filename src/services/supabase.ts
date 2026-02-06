import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
    process.env.SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_KEY!
);

export interface JadwalAbsensi {
    id: string;
    hari: string;
    mulai_masuk: string;
    selesai_masuk: string;
    mulai_pulang: string;
    is_active: boolean;
}

export async function fetchTokens(userIds?: string[]): Promise<string[]> {
    let query = supabase
        .from("user_profiles")
        .select("notification_token")
        .not("notification_token", "is", null);

    if (userIds) query = query.in("user_id", userIds);

    const { data, error } = await query;
    if (error) {
        console.error("Failed to fetch tokens:", error);
        return [];
    }

    return data
        .map((u) => u.notification_token)
        .filter((t): t is string => t !== null && t.length > 0);
}

export async function getActiveSchedule(dayName: string): Promise<JadwalAbsensi | null> {
    const { data, error } = await supabase
        .from("jadwal_absensi")
        .select("*")
        .eq("is_active", true)
        .eq("hari", dayName.toLowerCase())
        .limit(1)
        .maybeSingle();

    if (error) {
        console.error("Failed to fetch schedule:", error);
        return null;
    }

    return data;
}
