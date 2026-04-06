import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  const owner = await prisma.user.upsert({
    where: { email: "smoke-owner@sellora.test" },
    update: {},
    create: {
      email: "smoke-owner@sellora.test",
      fullName: "Smoke Test Owner",
      passwordHash: "smoke-hash"
    }
  });

  const seller = await prisma.seller.upsert({
    where: { slug: "smoke-seller" },
    update: {},
    create: {
      ownerUserId: owner.id,
      slug: "smoke-seller",
      displayName: "Smoke Test Seller"
    }
  });

  const customer = await prisma.customer.create({
    data: {
      sellerId: seller.id,
      name: "Smoke Customer",
      phone: `+971${Date.now()}`,
      city: "Dubai"
    }
  });

  const template = await prisma.categoryTemplate.upsert({
    where: { key: "phone-resale" },
    update: {},
    create: {
      key: "phone-resale",
      displayName: "Phone Resale",
      productFieldsJson: [],
      verificationJson: []
    }
  });

  const product = await prisma.product.upsert({
    where: { sellerId_slug: { sellerId: seller.id, slug: "smoke-phone" } },
    update: {},
    create: {
      sellerId: seller.id,
      categoryTemplateId: template.id,
      slug: "smoke-phone",
      title: "Smoke Test Phone",
      status: "ACTIVE",
      attributesJson: {}
    }
  });

  const offering = await prisma.productOffering.upsert({
    where: { sellerId_sku: { sellerId: seller.id, sku: "SMOKE-1" } },
    update: {},
    create: {
      sellerId: seller.id,
      productId: product.id,
      sku: "SMOKE-1",
      inventoryMode: "STOCKED",
      currency: "AED",
      priceMinor: 10000,
      costPriceMinor: 7000,
      isActive: true,
      selectedAttributesJson: {}
    }
  });

  const order = await prisma.order.create({
    data: {
      sellerId: seller.id,
      customerId: customer.id,
      orderNumber: `SMOKE-${Date.now()}`,
      mode: "STANDARD",
      status: "SHIPPED",
      paymentPolicy: "FULL_UPFRONT",
      paymentStatus: "PAID",
      subtotalMinor: 10000,
      totalMinor: 10000,
      currency: "AED",
      lines: {
        create: {
          productId: product.id,
          productOfferingId: offering.id,
          titleSnapshot: "Smoke Test Phone",
          quantity: 1,
          unitPriceMinor: 10000,
          costPriceMinor: 7000,
          currencySnapshot: "AED",
          selectedAttributesSnapshot: {},
          lineTotalMinor: 10000
        }
      }
    }
  });

  await prisma.fulfillmentRecord.create({
    data: {
      sellerId: seller.id,
      orderId: order.id,
      status: "SHIPPED",
      bookingReference: "smoke_ref_1",
      courierName: "karrio",
      trackingNumber: "TRK-SMOKE-1"
    }
  });

  console.log("Smoke fixture seeded:");
  console.log(`  SELLER_ID:  ${seller.id}`);
  console.log(`  ORDER_ID:   ${order.id}`);
  console.log(`  Order:      ${order.orderNumber} (SHIPPED)`);
  console.log(`  Fulfillment: TRK-SMOKE-1`);
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (err) => {
    console.error(err);
    await prisma.$disconnect();
    process.exit(1);
  });
