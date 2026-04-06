import { PrismaClient } from "@prisma/client";

declare global {
  var __selloraPrisma: PrismaClient | undefined;
}

export const prisma =
  globalThis.__selloraPrisma ??
  new PrismaClient({
    log: process.env.NODE_ENV === "development" ? ["warn", "error"] : ["error"]
  });

if (process.env.NODE_ENV !== "production") {
  globalThis.__selloraPrisma = prisma;
}
