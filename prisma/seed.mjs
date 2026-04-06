import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const categoryTemplates = [
  {
    key: "phone-resale",
    displayName: "Certified Phone Resale",
    productFieldsJson: [
      { key: "brand", label: "Brand", valueType: "string", required: true },
      { key: "modelFamily", label: "Model Family", valueType: "string", required: true },
      { key: "storageGb", label: "Storage (GB)", valueType: "number", required: true },
      { key: "color", label: "Color", valueType: "string", required: true },
      { key: "grade", label: "Grade", valueType: "string", required: true },
      { key: "batteryHealth", label: "Battery Health", valueType: "number", required: false }
    ],
    verificationJson: [
      { key: "imei", label: "IMEI Recorded", required: true },
      { key: "screen", label: "Screen Check", required: true },
      { key: "charging", label: "Charging Check", required: true },
      { key: "camera", label: "Camera Check", required: true },
      { key: "batteryVerified", label: "Battery Verified", required: false }
    ]
  },
  {
    key: "appliance-resale",
    displayName: "Refurbished Appliance",
    productFieldsJson: [
      { key: "brand", label: "Brand", valueType: "string", required: true },
      { key: "modelNumber", label: "Model Number", valueType: "string", required: true },
      { key: "condition", label: "Condition", valueType: "string", required: true },
      { key: "powerRating", label: "Power Rating", valueType: "string", required: false }
    ],
    verificationJson: [
      { key: "powerOn", label: "Power-On Test", required: true },
      { key: "physicalCondition", label: "Physical Condition", required: true },
      { key: "safetyCheck", label: "Safety Check", required: true }
    ]
  }
];

const seedUser = {
  email: "seed-owner@sellora.test",
  fullName: "Sellora Seed Owner",
  passwordHash: "seeded-password-hash"
};

const seedSeller = {
  slug: "seed-seller",
  displayName: "Sellora Seed Seller"
};

const seedCustomer = {
  name: "Seed Customer",
  phone: "+971500000001",
  city: "Dubai"
};

const seedProduct = {
  slug: "seed-phone-1",
  title: "Seed Phone Listing"
};

const seedOffering = {
  sku: "SEED-PHONE-1",
  currency: "AED",
  priceMinor: 250000,
  costPriceMinor: 180000
};

async function main() {
  for (const template of categoryTemplates) {
    await prisma.categoryTemplate.upsert({
      where: {
        key: template.key
      },
      update: {
        displayName: template.displayName,
        productFieldsJson: template.productFieldsJson,
        verificationJson: template.verificationJson
      },
      create: template
    });
  }

  const owner = await prisma.user.upsert({
    where: {
      email: seedUser.email
    },
    update: {
      fullName: seedUser.fullName,
      passwordHash: seedUser.passwordHash
    },
    create: seedUser
  });

  const seller = await prisma.seller.upsert({
    where: {
      slug: seedSeller.slug
    },
    update: {
      ownerUserId: owner.id,
      displayName: seedSeller.displayName
    },
    create: {
      ownerUserId: owner.id,
      ...seedSeller
    }
  });

  const existingCustomer = await prisma.customer.findFirst({
    where: {
      sellerId: seller.id,
      phone: seedCustomer.phone
    }
  });

  const customer = existingCustomer
    ? await prisma.customer.update({
        where: {
          id: existingCustomer.id
        },
        data: {
          name: seedCustomer.name,
          city: seedCustomer.city
        }
      })
    : await prisma.customer.create({
        data: {
          sellerId: seller.id,
          ...seedCustomer
        }
      });

  const phoneTemplate = await prisma.categoryTemplate.findUniqueOrThrow({
    where: {
      key: "phone-resale"
    }
  });

  const product = await prisma.product.upsert({
    where: {
      sellerId_slug: {
        sellerId: seller.id,
        slug: seedProduct.slug
      }
    },
    update: {
      categoryTemplateId: phoneTemplate.id,
      title: seedProduct.title,
      status: "ACTIVE",
      attributesJson: {
        brand: "Apple",
        modelFamily: "iPhone 14",
        storageGb: 128,
        color: "Black",
        grade: "A"
      }
    },
    create: {
      sellerId: seller.id,
      categoryTemplateId: phoneTemplate.id,
      slug: seedProduct.slug,
      title: seedProduct.title,
      status: "ACTIVE",
      attributesJson: {
        brand: "Apple",
        modelFamily: "iPhone 14",
        storageGb: 128,
        color: "Black",
        grade: "A"
      }
    }
  });

  const offering = await prisma.productOffering.upsert({
    where: {
      sellerId_sku: {
        sellerId: seller.id,
        sku: seedOffering.sku
      }
    },
    update: {
      productId: product.id,
      inventoryMode: "STOCKED",
      currency: seedOffering.currency,
      priceMinor: seedOffering.priceMinor,
      costPriceMinor: seedOffering.costPriceMinor,
      isActive: true,
      selectedAttributesJson: {}
    },
    create: {
      sellerId: seller.id,
      productId: product.id,
      sku: seedOffering.sku,
      inventoryMode: "STOCKED",
      currency: seedOffering.currency,
      priceMinor: seedOffering.priceMinor,
      costPriceMinor: seedOffering.costPriceMinor,
      isActive: true,
      selectedAttributesJson: {}
    }
  });

  const existingSeedReceive = await prisma.inventoryMovement.findFirst({
    where: {
      sellerId: seller.id,
      productOfferingId: offering.id,
      type: "RECEIVE",
      referenceType: "seed",
      referenceId: "initial_stock"
    }
  });

  if (!existingSeedReceive) {
    await prisma.inventoryMovement.create({
      data: {
        sellerId: seller.id,
        productOfferingId: offering.id,
        type: "RECEIVE",
        quantity: 5,
        referenceType: "seed",
        referenceId: "initial_stock",
        notes: "Seed stock for integration verification"
      }
    });
  }

  void customer;
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (error) => {
    console.error(error);
    await prisma.$disconnect();
    process.exit(1);
  });
