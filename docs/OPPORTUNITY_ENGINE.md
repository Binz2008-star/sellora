# Sellora Opportunity Engine

## 0. Assumptions

- Sellora should help sellers find profitable products, not just manage products they already know.
- The system should support multiple source types, not depend on a single marketplace.
- AI can propose and publish opportunities when autonomy policy allows.
- Profitability must include margin, risk, and operational fit, not just cheap source price.

## 1. Product Goal

Build an AI-assisted opportunity engine that:

1. discovers supplier listings or product candidates
2. normalizes messy source data
3. enriches listings for UAE selling
4. scores profit potential
5. flags risk and quality concerns
6. creates policy-checked draft listings
7. publishes automatically when policy allows

## 2. Source Types

The engine should work with:

- supplier CSV files
- partner catalog feeds
- manual product URLs
- seller-uploaded product sheets
- approved public sources with extract-and-review workflows

Do not hard-code the product around one external marketplace.

## 3. Scoring Dimensions

Each candidate should receive a score based on:

- estimated gross margin
- estimated landing cost
- shipping burden
- category fit
- trust risk
- source quality
- duplicate likelihood
- seller-specific fit
- localization readiness

## 4. AI Responsibilities

AI should:

- rewrite titles and descriptions
- identify key selling points
- translate and localize copy
- estimate category placement
- infer missing attributes where reasonable
- suggest pricing bands
- produce risk notes

AI should not:

- guarantee profitability
- claim legal compliance
- invent supplier truth

## 5. Workflow

1. Discover candidate
2. Extract and normalize source data
3. Run enrichment and localization
4. Estimate economics
5. Score opportunity
6. Evaluate policy gate
7. Publish automatically or hold for exception review
8. Sync listing and inventory state continuously

## 6. Core Rule

The opportunity engine creates drafts, scores them, and may publish autonomously when policy allows.
Autonomy must still fail closed when risk or uncertainty is too high.
