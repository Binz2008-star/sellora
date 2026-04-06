import { describe, expect, it, vi } from "vitest";
import { HealthCheckService } from "../../src/application/operations/health-check.service.js";

describe("HealthCheckService", () => {
  it("returns live status without external dependencies", () => {
    const service = new HealthCheckService(
      {
        APP_NAME: "sellora",
        NODE_ENV: "test"
      },
      vi.fn(async () => undefined)
    );

    expect(service.getHealth()).toMatchObject({
      status: "ok",
      appName: "sellora",
      environment: "test"
    });
  });

  it("reports ready when the database check succeeds", async () => {
    const service = new HealthCheckService(
      {
        APP_NAME: "sellora",
        NODE_ENV: "test"
      },
      vi.fn(async () => undefined)
    );

    await expect(service.getReadiness()).resolves.toEqual({
      status: "ready",
      checks: {
        database: "ok"
      }
    });
  });

  it("reports not ready when the database check fails", async () => {
    const service = new HealthCheckService(
      {
        APP_NAME: "sellora",
        NODE_ENV: "test"
      },
      vi.fn(async () => {
        throw new Error("db down");
      })
    );

    await expect(service.getReadiness()).resolves.toEqual({
      status: "not_ready",
      checks: {
        database: "error"
      }
    });
  });
});
