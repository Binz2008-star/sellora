import { describe, expect, it } from "vitest";
import { KarrioShippingGateway } from "../../src/adapters/karrio/karrio-shipping-gateway.js";
import { loadConfig } from "../../src/core/config.js";
import { createShippingGateway } from "../../src/modules/platform/shipping-gateway-factory.js";

describe("shipping gateway factory", () => {
  it("creates a karrio gateway when the required config is present", () => {
    const config = loadConfig({
      DATABASE_URL: "postgresql://postgres:postgres@localhost:5432/sellora",
      KARRIO_BASE_URL: "https://api.karrio.io",
      KARRIO_API_KEY: "karrio_key",
      KARRIO_SHIPPER_POSTAL_CODE: "00000",
      KARRIO_SHIPPER_COUNTRY_CODE: "AE",
      KARRIO_RECIPIENT_POSTAL_CODE: "00000",
      KARRIO_RECIPIENT_COUNTRY_CODE: "AE",
      KARRIO_PARCEL_WEIGHT: "1",
      KARRIO_PARCEL_WEIGHT_UNIT: "KG"
    });

    const gateway = createShippingGateway(config);

    expect(gateway).toBeInstanceOf(KarrioShippingGateway);
  });

  it("rejects incomplete production shipping configuration", () => {
    expect(() =>
      loadConfig({
        NODE_ENV: "production",
        DATABASE_URL: "postgresql://postgres:postgres@localhost:5432/sellora",
        OPERATOR_API_TOKEN: "operator",
        PAYMENT_WEBHOOK_SECRET: "payment",
        KARRIO_WEBHOOK_SECRET: "shipping",
        NOTIFICATION_PROVIDER: "resend",
        NOTIFICATION_FROM_EMAIL: "orders@sellora.test",
        RESEND_API_KEY: "resend_key"
      })
    ).toThrow(/KARRIO_BASE_URL/);
  });
});
