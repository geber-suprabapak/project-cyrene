import { z } from "zod";

const optionalSecret = z.preprocess(
    (value) => (value === "" ? undefined : value),
    z.string().min(1).optional()
);

const ConfigSchema = z.object({
    NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
    PORT: z.coerce.number().int().min(1).max(65535).default(3000),
    TZ: z.string().min(1).default("Asia/Jakarta"),
    SUPABASE_URL: z.string().url(),
    SUPABASE_SERVICE_KEY: z.string().min(1),
    API_BEARER_TOKEN: z.string().min(1),
    EXPO_ACCESS_TOKEN: optionalSecret,
});

export type AppConfig = z.infer<typeof ConfigSchema>;

let cachedConfig: AppConfig | null = null;

function formatConfigError(error: z.ZodError): string {
    return error.issues
        .map((issue) => `${issue.path.join(".") || "env"}: ${issue.message}`)
        .join("; ");
}

export function loadConfig(env: NodeJS.ProcessEnv = process.env): AppConfig {
    const parsed = ConfigSchema.safeParse(env);

    if (!parsed.success) {
        throw new Error(`Invalid environment configuration: ${formatConfigError(parsed.error)}`);
    }

    return parsed.data;
}

export function getConfig(): AppConfig {
    cachedConfig ??= loadConfig();
    return cachedConfig;
}

export function resetConfigForTests(): void {
    cachedConfig = null;
}
