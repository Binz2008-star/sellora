#!/usr/bin/env node

const BASE_URL = process.env.SMOKE_BASE_URL || process.argv[2];
const OPERATOR_TOKEN = process.env.SELLORA_OPERATOR_TOKEN || process.argv[3];
const RECONCILE_ORDER_ID = process.env.SMOKE_ORDER_ID || process.argv[4];

if (!BASE_URL) {
  console.error(
    "Usage: node scripts/deploy-smoke.mjs <BASE_URL> [OPERATOR_TOKEN] [ORDER_ID]\n" +
      "  or set SMOKE_BASE_URL, SELLORA_OPERATOR_TOKEN, SMOKE_ORDER_ID env vars"
  );
  process.exit(1);
}

const results = [];
let exitCode = 0;

async function gate(name, fn) {
  try {
    const result = await fn();
    results.push({ name, ...result });
    if (!result.pass) exitCode = 1;
  } catch (err) {
    results.push({ name, pass: false, status: "error", detail: err.message });
    exitCode = 1;
  }
}

async function run() {
  console.log(`\n🔍 Deploy smoke — ${BASE_URL}\n`);

  // Gate 1: /health
  await gate("/health", async () => {
    const res = await fetch(`${BASE_URL}/health`);
    const body = await res.json();
    return {
      pass: res.ok && body.status === "ok",
      status: res.status,
      detail: body
    };
  });

  // Gate 2: /ready
  await gate("/ready", async () => {
    const res = await fetch(`${BASE_URL}/ready`);
    const body = await res.json();
    return {
      pass: res.ok && body.status === "ready",
      status: res.status,
      detail: body
    };
  });

  // Gate 3: reconcile smoke (optional — needs token + orderId)
  if (OPERATOR_TOKEN && RECONCILE_ORDER_ID) {
    await gate("reconcile smoke", async () => {
      const res = await fetch(`${BASE_URL}/api/fulfillment/shipments/reconcile`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${OPERATOR_TOKEN}`
        },
        body: JSON.stringify({ orderId: RECONCILE_ORDER_ID })
      });
      const body = await res.json();
      return {
        pass: res.ok,
        status: res.status,
        detail: body
      };
    });
  } else {
    results.push({
      name: "reconcile smoke",
      pass: true,
      status: "skipped",
      detail: "Set SELLORA_OPERATOR_TOKEN + SMOKE_ORDER_ID to enable"
    });
  }

  // Report
  console.log("─".repeat(60));
  for (const r of results) {
    const icon = r.pass ? "✅" : "❌";
    const status = typeof r.status === "number" ? `HTTP ${r.status}` : r.status;
    console.log(`${icon}  ${r.name.padEnd(20)} ${status}`);
    if (!r.pass && r.detail) {
      console.log(`   detail: ${JSON.stringify(r.detail)}`);
    }
  }
  console.log("─".repeat(60));

  if (exitCode === 0) {
    console.log("\n✅ All deploy smoke gates passed\n");
  } else {
    console.log("\n❌ Deploy smoke FAILED — see above\n");
  }

  // Reminder for manual gate
  console.log("⚠️  Manual gate: verify clean startup logs in Render dashboard\n");

  process.exit(exitCode);
}

run();
