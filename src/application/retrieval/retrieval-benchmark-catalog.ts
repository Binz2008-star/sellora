import type {
  RetrievalBenchmarkDataset,
  RetrievalBenchmarkDatasetSummary
} from "../../domain/retrieval/retrieval.js";

export const SELLORA_RETRIEVAL_SMOKE_DATASET: RetrievalBenchmarkDataset = {
  id: "sellora-retrieval-smoke-v1",
  name: "Sellora Retrieval Smoke v1",
  description:
    "Initial internal benchmark covering support lookup, help-center grounding, and catalog candidate retrieval across English, Arabic, and mixed-script seller text.",
  useCases: ["support_search", "help_center_grounding", "catalog_candidate_retrieval"],
  corpus: [
    {
      id: "support_refunds_en",
      language: "en",
      title: "Refunds for duplicate card charges",
      body:
        "Use this guide when a customer was charged twice or needs a refund after a failed payment authorization."
    },
    {
      id: "support_tracking_en",
      language: "en",
      title: "Track a shipped order",
      body:
        "Operators can inspect booking references, webhook receipts, and courier tracking numbers to answer shipment status questions."
    },
    {
      id: "help_cod_ar",
      language: "ar",
      title: "سياسة الدفع عند الاستلام",
      body:
        "يشرح هذا المستند متى يكون الدفع عند الاستلام متاحا ومتى يتم تعطيله للطلبات عالية المخاطر."
    },
    {
      id: "help_whatsapp_ar",
      language: "ar",
      title: "ربط واتساب الدعم بالواجهة",
      body:
        "يوضح هذا الدليل كيفية تحديث رقم واتساب الدعم من إعدادات المتجر ليظهر للعملاء في صفحة المتجر."
    },
    {
      id: "catalog_iphone_15_ar",
      language: "ar",
      title: "آيفون 15 برو 256 جيجا تيتانيوم طبيعي",
      body:
        "هاتف آيفون 15 برو بسعة 256 جيجابايت ولون تيتانيوم طبيعي مع شريحة eSIM ودعم شبكة الجيل الخامس.",
      metadata: {
        skuFamily: "iphone-15-pro",
        brand: "Apple"
      }
    },
    {
      id: "catalog_samsung_buds_en",
      language: "en",
      title: "Samsung Galaxy Buds3 Pro Silver",
      body:
        "Wireless earbuds with ANC, silver finish, and charging case for Galaxy ecosystem users.",
      metadata: {
        skuFamily: "galaxy-buds3-pro",
        brand: "Samsung"
      }
    }
  ],
  cases: [
    {
      id: "case_refund_duplicate_charge_en",
      query: "customer charged twice refund payment",
      language: "en",
      useCase: "support_search",
      relevantDocumentIds: ["support_refunds_en"],
      expectedPrimaryDocumentId: "support_refunds_en",
      tags: ["support", "payments", "refunds"]
    },
    {
      id: "case_tracking_status_en",
      query: "where is the shipped order tracking number",
      language: "en",
      useCase: "support_search",
      relevantDocumentIds: ["support_tracking_en"],
      expectedPrimaryDocumentId: "support_tracking_en",
      tags: ["support", "shipping"]
    },
    {
      id: "case_cod_policy_ar",
      query: "متى يتوقف الدفع عند الاستلام",
      language: "ar",
      useCase: "help_center_grounding",
      relevantDocumentIds: ["help_cod_ar"],
      expectedPrimaryDocumentId: "help_cod_ar",
      tags: ["help_center", "payments", "cod"]
    },
    {
      id: "case_whatsapp_setup_ar",
      query: "كيف أغير رقم واتساب الدعم في المتجر",
      language: "ar",
      useCase: "help_center_grounding",
      relevantDocumentIds: ["help_whatsapp_ar"],
      expectedPrimaryDocumentId: "help_whatsapp_ar",
      tags: ["help_center", "storefront"]
    },
    {
      id: "case_catalog_iphone_mixed",
      query: "iphone 15 pro 256 natural titanium",
      language: "en",
      useCase: "catalog_candidate_retrieval",
      relevantDocumentIds: ["catalog_iphone_15_ar"],
      expectedPrimaryDocumentId: "catalog_iphone_15_ar",
      tags: ["catalog", "matching", "mixed_script"]
    },
    {
      id: "case_catalog_buds_en",
      query: "samsung buds pro silver earbuds",
      language: "en",
      useCase: "catalog_candidate_retrieval",
      relevantDocumentIds: ["catalog_samsung_buds_en"],
      expectedPrimaryDocumentId: "catalog_samsung_buds_en",
      tags: ["catalog", "matching"]
    }
  ]
};

export const BUILT_IN_RETRIEVAL_BENCHMARK_DATASETS: RetrievalBenchmarkDataset[] = [
  SELLORA_RETRIEVAL_SMOKE_DATASET
];

export function summarizeRetrievalBenchmarkDataset(
  dataset: RetrievalBenchmarkDataset
): RetrievalBenchmarkDatasetSummary {
  return {
    id: dataset.id,
    name: dataset.name,
    description: dataset.description,
    useCases: dataset.useCases,
    caseCount: dataset.cases.length,
    corpusDocumentCount: dataset.corpus.length
  };
}
