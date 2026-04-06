import type { AppConfig } from "../../core/config.js";

export interface HealthSnapshot {
  status: "ok";
  appName: string;
  environment: AppConfig["NODE_ENV"];
  uptimeSeconds: number;
}

export interface ReadinessSnapshot {
  status: "ready" | "not_ready";
  checks: {
    database: "ok" | "error";
  };
}

export class HealthCheckService {
  constructor(
    private readonly config: Pick<AppConfig, "APP_NAME" | "NODE_ENV">,
    private readonly checkDatabase: () => Promise<void>
  ) {}

  getHealth(): HealthSnapshot {
    return {
      status: "ok",
      appName: this.config.APP_NAME,
      environment: this.config.NODE_ENV,
      uptimeSeconds: Math.floor(process.uptime())
    };
  }

  async getReadiness(): Promise<ReadinessSnapshot> {
    try {
      await this.checkDatabase();
      return {
        status: "ready",
        checks: {
          database: "ok"
        }
      };
    } catch {
      return {
        status: "not_ready",
        checks: {
          database: "error"
        }
      };
    }
  }
}
