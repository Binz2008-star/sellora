# Sellora – Production Runbook (AR)

## 🎯 الهدف
تشغيل ومراقبة خدمة Sellora في الإنتاج بشكل موثوق، مع القدرة على التشخيص السريع.

---

## 🟢 Health Gate

```bash
curl https://sellora-h1tl.onrender.com/health
curl https://sellora-h1tl.onrender.com/ready
```

### المتوقع

* /health → 200 دائمًا
* /ready → 200 إذا DB + config سليمة

---

## 🔵 Reconcile Gate (الأهم)

```bash
npm run smoke <BASE_URL> <OPERATOR_TOKEN> <SELLER_ID> <ORDER_ID>
```

### النجاح

* health = 200
* ready = 200
* reconcile = 200

> إذا هذا فشل → النظام غير صالح تشغيليًا

---

## 🟡 Logs (Render)

Render → Service → Logs

### ابحث عن:

* Prisma errors
* Missing env vars
* Auth failures
* Provider crashes

---

## 🔴 Troubleshooting

### ❌ /health ≠ 200

→ السيرفر لا يعمل

### ❌ /ready ≠ 200

→ مشكلة DB أو config

### ❌ reconcile fails

→ مشكلة business logic أو integration

### ❌ 404 routes

→ routing issue

---

## 🧪 Test Fixture

```bash
node scripts/seed-smoke-fixture.mjs
```

---

## 🔐 Secret Rotation

قم بتدوير:

* DATABASE_URL
* JWT_SECRET
* OPERATOR_API_TOKEN
* KARRIO_API_KEY
* RESEND_API_KEY

---

## ⚠️ حدود النظام

* single-instance
* لا يوجد queue
* يعتمد على providers خارجية

---

## 🎯 القاعدة الذهبية

> إذا health + ready + reconcile = 200 → النظام سليم
