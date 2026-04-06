import { describe, expect, it } from "vitest";
import { MemoryNotificationGateway } from "../../src/adapters/memory/memory-notification-gateway.js";
import { ResendNotificationGateway } from "../../src/adapters/resend/resend-notification-gateway.js";
import { loadConfig } from "../../src/core/config.js";
import { createNotificationGateway } from "../../src/modules/platform/notification-gateway-factory.js";

describe("notification gateway factory", () => {
  it("creates the memory gateway when configured", () => {
    const config = loadConfig({
      DATABASE_URL: "postgresql://postgres:postgres@localhost:5432/sellora",
      NOTIFICATION_PROVIDER: "memory"
    });

    const gateway = createNotificationGateway(config);

    expect(gateway).toBeInstanceOf(MemoryNotificationGateway);
  });

  it("creates the Resend gateway when configured with required env", () => {
    const config = loadConfig({
      DATABASE_URL: "postgresql://postgres:postgres@localhost:5432/sellora",
      NOTIFICATION_PROVIDER: "resend",
      NOTIFICATION_FROM_EMAIL: "orders@sellora.test",
      RESEND_API_KEY: "resend_key"
    });

    const gateway = createNotificationGateway(config);

    expect(gateway).toBeInstanceOf(ResendNotificationGateway);
  });

  it("rejects resend configuration without required credentials", () => {
    expect(() =>
      loadConfig({
        DATABASE_URL: "postgresql://postgres:postgres@localhost:5432/sellora",
        NOTIFICATION_PROVIDER: "resend"
      })
    ).toThrow(/RESEND_API_KEY/);
  });

  it("rejects memory notification delivery in production", () => {
    expect(() =>
      loadConfig({
        NODE_ENV: "production",
        DATABASE_URL: "postgresql://postgres:postgres@localhost:5432/sellora",
        OPERATOR_API_TOKEN: "operator",
        PAYMENT_WEBHOOK_SECRET: "payment",
        KARRIO_WEBHOOK_SECRET: "shipping",
        KARRIO_BASE_URL: "https://api.karrio.io",
        KARRIO_API_KEY: "karrio_key",
        KARRIO_SHIPPER_POSTAL_CODE: "00000",
        KARRIO_SHIPPER_COUNTRY_CODE: "AE",
        KARRIO_RECIPIENT_POSTAL_CODE: "00000",
        KARRIO_RECIPIENT_COUNTRY_CODE: "AE",
        KARRIO_PARCEL_WEIGHT: "1",
        KARRIO_PARCEL_WEIGHT_UNIT: "KG"
      })
    ).toThrow(/NOTIFICATION_PROVIDER/);
  });
});
