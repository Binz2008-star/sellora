import { z } from "zod";

const envSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  DATABASE_URL: z.string().min(1, "DATABASE_URL is required"),
  APP_NAME: z.string().default("sellora"),
  DEFAULT_CURRENCY: z.string().default("AED"),
  GLOBAL_AUTONOMY_ENABLED: z
    .enum(["true", "false"])
    .default("false")
    .transform((value) => value === "true"),
  DEFAULT_MINIMUM_MARGIN_PCT: z.coerce.number().default(25),
  DEFAULT_MAXIMUM_RISK_SCORE: z.coerce.number().default(45),
  DEFAULT_MINIMUM_LOCALIZATION_SCORE: z.coerce.number().default(60)
});

export type AppConfig = z.infer<typeof envSchema>;

export function loadConfig(source: Record<string, string | undefined> = process.env): AppConfig {
  return envSchema.parse(source);
}
