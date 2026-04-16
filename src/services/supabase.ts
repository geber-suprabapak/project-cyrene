import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { getConfig } from "../config.js";

export interface JadwalAbsensi {
    id: string;
    hari: string;
    mulai_masuk: string;
    selesai_masuk: string;
    mulai_pulang: string;
    is_active: boolean;
}

interface Database {
    public: {
        Tables: {
            user_profiles: {
                Row: {
                    user_id: string;
                    notification_token: string | null;
                };
                Insert: never;
                Update: never;
                Relationships: [];
            };
            jadwal_absensi: {
                Row: JadwalAbsensi;
                Insert: never;
                Update: never;
                Relationships: [];
            };
        };
        Views: Record<string, never>;
        Functions: Record<string, never>;
        Enums: Record<string, never>;
        CompositeTypes: Record<string, never>;
    };
}

let supabase: SupabaseClient<Database> | null = null;

function getSupabaseClient(): SupabaseClient<Database> {
    if (!supabase) {
        const config = getConfig();
        supabase = createClient<Database>(config.SUPABASE_URL, config.SUPABASE_SERVICE_KEY);
    }

    return supabase;
}

export async function fetchTokens(userIds?: string[]): Promise<string[]> {
    let query = getSupabaseClient()
        .from("user_profiles")
        .select("notification_token")
        .not("notification_token", "is", null);

    if (userIds) query = query.in("user_id", userIds);

    const { data, error } = await query;
    if (error) {
        console.error("Failed to fetch tokens:", error);
        return [];
    }

    const rows = (data ?? []) as Array<{ notification_token: string | null }>;

    return rows
        .map((u) => u.notification_token)
        .filter((t): t is string => t !== null && t.length > 0);
}

export async function getActiveSchedule(dayName: string): Promise<JadwalAbsensi | null> {
    const { data, error } = await getSupabaseClient()
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
