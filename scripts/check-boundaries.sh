#!/usr/bin/env bash
set -euo pipefail

echo "Checking forbidden runtime logic in sellora..."

forbidden_patterns=(
  "applyOrderTransition"
  "orderEvent"
  "paymentAttempt"
  "generateToken"
  "verifyToken"
  "reserveInventory"
  "releaseInventory"
  "createOrder"
  "processPayment"
  "authenticateUser"
  "auditEvent"
)

for pattern in "${forbidden_patterns[@]}"; do
  if grep -R -n "$pattern" src docs --exclude-dir=node_modules --exclude="*.md" --exclude="*.sh" --exclude="*.yml"; then
    echo "Forbidden runtime-domain pattern found in sellora: $pattern"
    exit 1
  fi
done

echo "Boundary check passed."
