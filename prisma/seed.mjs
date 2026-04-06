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
