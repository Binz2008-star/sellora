export interface CategoryTemplateField {
  key: string;
  label: string;
  valueType: "string" | "number" | "boolean" | "date";
  required: boolean;
}

export interface VerificationCheckDefinition {
  key: string;
  label: string;
  required: boolean;
}

export interface CategoryTemplate {
  key: string;
  displayName: string;
  productFields: CategoryTemplateField[];
  verificationChecks: VerificationCheckDefinition[];
}

export const phoneResaleTemplate: CategoryTemplate = {
  key: "phone-resale",
  displayName: "Certified Phone Resale",
  productFields: [
    { key: "brand", label: "Brand", valueType: "string", required: true },
    { key: "modelFamily", label: "Model Family", valueType: "string", required: true },
    { key: "storageGb", label: "Storage (GB)", valueType: "number", required: true },
    { key: "color", label: "Color", valueType: "string", required: true },
    { key: "grade", label: "Grade", valueType: "string", required: true },
    { key: "batteryHealth", label: "Battery Health", valueType: "number", required: false }
  ],
  verificationChecks: [
    { key: "imei", label: "IMEI Recorded", required: true },
    { key: "screen", label: "Screen Check", required: true },
    { key: "charging", label: "Charging Check", required: true },
    { key: "camera", label: "Camera Check", required: true },
    { key: "batteryVerified", label: "Battery Verified", required: false }
  ]
};

export const applianceTemplate: CategoryTemplate = {
  key: "appliance-resale",
  displayName: "Refurbished Appliance",
  productFields: [
    { key: "brand", label: "Brand", valueType: "string", required: true },
    { key: "modelNumber", label: "Model Number", valueType: "string", required: true },
    { key: "condition", label: "Condition", valueType: "string", required: true },
    { key: "powerRating", label: "Power Rating", valueType: "string", required: false }
  ],
  verificationChecks: [
    { key: "powerOn", label: "Power-On Test", required: true },
    { key: "physicalCondition", label: "Physical Condition", required: true },
    { key: "safetyCheck", label: "Safety Check", required: true }
  ]
};
