# Monitoring & Alerting

## Metrics (الحد الأدنى)

- request latency
- error rate
- reconcile failures
- DB errors

---

## Alerts (حرجة)

### 🔴 Critical
- /health != 200
- /ready != 200
- reconcile failures > 1

### 🟠 Warning
- slow requests > 1s
- provider failures

---

## Tools

- Render logs (current)
- Upgrade لاحقًا:
  - Sentry (errors)
  - Prometheus / Grafana
