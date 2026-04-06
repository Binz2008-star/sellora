# Sellora AI Sourcing Strategy

## 0. Assumptions

- Supplier ingestion should not depend on brittle scraping when an official or permitted API path exists.
- AI should assist sourcing, normalization, translation, and enrichment.
- AI should operate autonomously within explicit policy limits.
- The target market is UAE sellers operating in Arabic and English.

## 1. Product Goal

Sellora should discover supplier products, convert them into clean catalog drafts, and publish them into storefronts when policy allows.

The target experience is:

1. Connect supplier source or paste product URL
2. Import product data
3. Normalize and enrich with AI
4. Translate and localize for UAE buyers
5. Score viability and suggest margins
6. Save as autonomous draft
7. Publish automatically if policy allows, otherwise hold for operator review

## 2. Allowed Ingestion Paths

Preferred order:

1. Official APIs
2. Supplier CSV or feed imports
3. Seller-uploaded product URLs with extract-and-validate flow

Do not design the product around fragile scraping as the primary integration path.

## 3. AI Responsibilities

AI can help with:

- title cleanup
- description rewriting
- attribute normalization
- Arabic translation
- benefit extraction
- category mapping
- margin suggestions
- trust and risk notes
- duplicate detection

AI should not be the final authority for:

- product legality
- warranty claims
- supplier trustworthiness
- stock truth
- compliance certainty

## 4. Initial Source Connectors

### Partner Feed

Use for:

- structured catalog import
- recurring source sync
- higher trust sourcing

### Supplier CSV

Use for:

- seller-provided inventory feeds
- price and stock refresh
- onboarding suppliers quickly

### Approved Web Sources

Use for:

- discovery and extraction through browser automation
- monitoring price and availability changes
- opportunistic sourcing beyond formal connectors

## 5. Sellora-Specific Differentiation

AI sourcing should produce UAE-ready drafts with:

- AED price suggestions
- Arabic and English listing text
- WhatsApp-friendly short descriptions
- deposit recommendations where needed
- resale or trust notes where relevant

## 6. Build Order

1. Supplier source model
2. Draft import job model
3. AI enrichment service
4. Policy gate
5. Publish-to-catalog flow

## 7. Rule

Never auto-publish imported supplier data unless it passes explicit autonomy policy checks.
