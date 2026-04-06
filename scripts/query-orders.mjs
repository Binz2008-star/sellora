import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

try {
  const rows = await prisma.$queryRawUnsafe(`
    SELECT
      o.id,
      o.status,
      o."sellerId",
      o."orderNumber",
      f.id AS fulfillment_id,
      f.status AS fulfillment_status,
      f."providerStatus",
      f."bookingReference",
      f."trackingNumber"
    FROM "Order" o
    JOIN "FulfillmentRecord" f ON f."orderId" = o.id
    ORDER BY o."updatedAt" DESC
    LIMIT 10
  `);

  if (rows.length === 0) {
    console.log("No orders with fulfillment records found.");
  } else {
    console.table(rows);
  }
} finally {
  await prisma.$disconnect();
}
