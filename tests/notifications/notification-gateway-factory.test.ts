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
});
