import { z } from "zod";

const optionalNonEmptyString = () =>
  z.preprocess(
    (value) =>
      typeof value === "string" && value.trim().length === 0 ? undefined : value,
    z.string().min(1).optional()
  );

const optionalEmailString = () =>
  z.preprocess(
    (value) =>
      typeof value === "string" && value.trim().length === 0 ? undefined : value,
    z.string().email().optional()
  );

const envSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  DATABASE_URL: z.string().min(1, "DATABASE_URL is required"),
  APP_NAME: z.string().default("sellora"),
  APP_HOST: z.string().default("0.0.0.0"),
  APP_PORT: z.coerce.number().int().positive().default(3000),
  DEFAULT_CURRENCY: z.string().default("AED"),
  OPERATOR_API_TOKEN: z.string().min(1).optional(),
  PAYMENT_WEBHOOK_SECRET: z.string().min(1).optional(),
  KARRIO_WEBHOOK_SECRET: z.string().min(1).optional(),
  NOTIFICATION_PROVIDER: z.enum(["memory", "resend"]).default("memory"),
  NOTIFICATION_FROM_EMAIL: optionalEmailString(),
  NOTIFICATION_REPLY_TO_EMAIL: optionalEmailString(),
  RESEND_API_KEY: optionalNonEmptyString(),
  RESEND_BASE_URL: z.string().url().default("https://api.resend.com"),
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
}).superRefine((value, context) => {
  if (value.NODE_ENV === "production") {
    if (value.NOTIFICATION_PROVIDER === "memory") {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["NOTIFICATION_PROVIDER"],
        message: "NOTIFICATION_PROVIDER must use a real delivery channel in production"
      });
    }

    const requiredProductionFields = [
      "OPERATOR_API_TOKEN",
      "PAYMENT_WEBHOOK_SECRET",
      "KARRIO_WEBHOOK_SECRET",
      "KARRIO_BASE_URL",
      "KARRIO_API_KEY",
      "KARRIO_SHIPPER_POSTAL_CODE",
      "KARRIO_SHIPPER_COUNTRY_CODE",
      "KARRIO_RECIPIENT_POSTAL_CODE",
      "KARRIO_RECIPIENT_COUNTRY_CODE",
      "KARRIO_PARCEL_WEIGHT_UNIT"
    ] as const;

    for (const field of requiredProductionFields) {
      if (!value[field]) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          path: [field],
          message: `${field} is required in production`
        });
      }
    }

    if (value.KARRIO_PARCEL_WEIGHT === undefined) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["KARRIO_PARCEL_WEIGHT"],
        message: "KARRIO_PARCEL_WEIGHT is required in production"
      });
    }
  }

  if (value.NOTIFICATION_PROVIDER === "resend") {
    if (!value.RESEND_API_KEY) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["RESEND_API_KEY"],
        message: "RESEND_API_KEY is required when NOTIFICATION_PROVIDER is resend"
      });
    }

    if (!value.NOTIFICATION_FROM_EMAIL) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["NOTIFICATION_FROM_EMAIL"],
        message: "NOTIFICATION_FROM_EMAIL is required when NOTIFICATION_PROVIDER is resend"
      });
    }
  }
});

export type AppConfig = z.infer<typeof envSchema>;

export function loadConfig(source: Record<string, string | undefined> = process.env): AppConfig {
  return envSchema.parse(source);
}
