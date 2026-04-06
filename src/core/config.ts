import { z } from "zod";

const envSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  DATABASE_URL: z.string().min(1, "DATABASE_URL is required"),
  APP_NAME: z.string().default("sellora"),
  DEFAULT_CURRENCY: z.string().default("AED"),
  KARRIO_BASE_URL: z.string().url().optional(),
  KARRIO_API_KEY: z.string().min(1).optional(),
  KARRIO_PROVIDER_NAME: z.string().default("karrio"),
  KARRIO_CARRIER_ID: z.string().optional(),
  KARRIO_SERVICE: z.string().optional(),
  KARRIO_SHIPPER_POSTAL_CODE: z.string().optional(),
  KARRIO_SHIPPER_COUNTRY_CODE: z.string().optional(),
  KARRIO_SHIPPER_CITY: z.string().optional(),
  KARRIO_SHIPPER_STATE_CODE: z.string().optional(),
  KARRIO_SHIPPER_ADDRESS_LINE1: z.string().optional(),
  KARRIO_SHIPPER_ADDRESS_LINE2: z.string().optional(),
  KARRIO_SHIPPER_COMPANY_NAME: z.string().optional(),
  KARRIO_SHIPPER_PERSON_NAME: z.string().optional(),
  KARRIO_SHIPPER_PHONE_NUMBER: z.string().optional(),
  KARRIO_SHIPPER_EMAIL: z.string().optional(),
  KARRIO_RECIPIENT_POSTAL_CODE: z.string().optional(),
  KARRIO_RECIPIENT_COUNTRY_CODE: z.string().optional(),
  KARRIO_RECIPIENT_CITY: z.string().optional(),
  KARRIO_RECIPIENT_STATE_CODE: z.string().optional(),
  KARRIO_RECIPIENT_ADDRESS_LINE1: z.string().optional(),
  KARRIO_RECIPIENT_ADDRESS_LINE2: z.string().optional(),
  KARRIO_RECIPIENT_COMPANY_NAME: z.string().optional(),
  KARRIO_RECIPIENT_PERSON_NAME: z.string().optional(),
  KARRIO_RECIPIENT_PHONE_NUMBER: z.string().optional(),
  KARRIO_RECIPIENT_EMAIL: z.string().optional(),
  KARRIO_PARCEL_WEIGHT: z.coerce.number().optional(),
  KARRIO_PARCEL_WEIGHT_UNIT: z.string().optional(),
  KARRIO_PARCEL_LENGTH: z.coerce.number().optional(),
  KARRIO_PARCEL_WIDTH: z.coerce.number().optional(),
  KARRIO_PARCEL_HEIGHT: z.coerce.number().optional(),
  KARRIO_PARCEL_DISTANCE_UNIT: z.string().optional(),
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
