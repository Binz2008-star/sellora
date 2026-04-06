import type { WorkflowKind } from "../../domain/autonomy/workflow.js";

export interface WorkflowBlueprint {
  kind: WorkflowKind;
  steps: string[];
}

export const workflowBlueprints: WorkflowBlueprint[] = [
  {
    kind: "discovery_loop",
    steps: ["discover", "normalize", "enrich", "score", "publish_or_hold"]
  },
  {
    kind: "listing_publish",
    steps: ["validate_listing", "set_price", "publish", "monitor_inventory"]
  },
  {
    kind: "sales_conversation",
    steps: ["qualify_lead", "answer_questions", "create_quote_or_order", "follow_up"]
  },
  {
    kind: "quote_to_order",
    steps: ["issue_quote", "track_response", "convert", "start_payment"]
  },
  {
    kind: "order_fulfillment",
    steps: ["confirm_payment", "prepare_dispatch", "book_shipment", "track_delivery"]
  },
  {
    kind: "delivery_follow_up",
    steps: ["check_status", "notify_customer", "resolve_exception", "close"]
  }
];
