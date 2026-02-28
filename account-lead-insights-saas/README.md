# Account Lead Insights SaaS (Ship-Ready Baseline)

Production-grade multi-tenant SaaS for home service lead generation.

## Monorepo Structure

- `apps/web`: Next.js App Router frontend (owner + operator experiences)
- `apps/api`: Express TypeScript API + Prisma + OpenAPI
- `apps/worker`: BullMQ worker for notifications/automation jobs
- `packages/shared`: shared types, schemas, and utilities
- `prisma/schema.prisma`: source DB schema
- `.github/workflows/ci.yml`: lint/typecheck/test pipeline

## Tech Stack

- Web: Next.js + Tailwind + shadcn/ui-ready primitives
- API: Express + TypeScript + Zod + Swagger UI
- DB: Postgres + Prisma
- Jobs: BullMQ + Redis
- Auth: JWT access + refresh token rotation
- Billing: Stripe subscriptions + webhook endpoint
- Notifications: Resend + Twilio adapters
- Observability: Pino logs + Sentry hooks + health endpoints

## Quick Start (Local)

### 1) Start infra

```bash
cd account-lead-insights-saas
docker compose up -d
```

Starts:
- Postgres: `localhost:5432`
- Redis: `localhost:6379`

### 2) Install dependencies

```bash
npm install
```

### 3) Environment setup

```bash
cp .env.example .env
```

Fill required values.

### 4) DB setup

```bash
npm run setup:local
```

### 5) Run all services

```bash
npm run dev
```

Services:
- Web: `http://localhost:3001`
- API: `http://localhost:4000`
- Swagger: `http://localhost:4000/docs`
- Health: `http://localhost:4000/health`, `http://localhost:4000/ready`

### No-Docker fallback

If Docker is unavailable, start local services with Homebrew:

```bash
brew services start postgresql@16
brew services start redis
npm run setup:local
npm run dev
```

## Env Vars

See `.env.example`. Core values:
- `DATABASE_URL`
- `REDIS_URL`
- `JWT_ACCESS_SECRET`
- `JWT_REFRESH_SECRET`
- `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`
- `RESEND_API_KEY`, `TWILIO_*`
- `OPENAI_API_KEY` (optional)
- `SENTRY_DSN` (optional)

## Stripe Webhook Setup

1. Create product/price in Stripe (Starter plan)
2. Point webhook to `POST /api/v1/billing/webhook`
3. Enable events:
   - `checkout.session.completed`
   - `customer.subscription.updated`
   - `customer.subscription.deleted`
4. Set `STRIPE_WEBHOOK_SECRET`

## Render Deployment (3 Services)

### API service
- Root dir: `account-lead-insights-saas`
- Build: `npm install && npm run build -w @ali/api && npm run prisma:generate`
- Start: `npm run start -w @ali/api`
- Add env vars from `.env.example`
- Add Postgres + Redis attachments

### Web service
- Root dir: `account-lead-insights-saas`
- Build: `npm install && npm run build -w @ali/web`
- Start: `npm run start -w @ali/web`
- `NEXT_PUBLIC_API_URL` -> API URL

### Worker service
- Root dir: `account-lead-insights-saas`
- Build: `npm install && npm run build -w @ali/worker`
- Start: `npm run start -w @ali/worker`

## Security Baselines Included

- Org isolation by `orgId` in every domain model
- Role-based guard middleware (`OWNER`, `ADMIN`, `OPERATOR`)
- Rate limiting on public and org endpoints
- Zod validation on all write routes
- AuditLog creation on critical mutations
- PII field encryption helper (AES-GCM)
- GDPR-ish export/delete org endpoints

## Implemented Product Modules

- Multi-tenant auth + invites + password reset stub + optional MFA hooks
- 4-step onboarding workflow persisted in DB
- Asset Pack Builder with versioned prompts + strict JSON schema + no-AI fallback
- Lead ingestion (public form + webhook) with spam gate
- Owner dashboard KPIs, trends, channel/campaign tables, CSV export
- Operator console (org list, anomalies, notes/tasks, read-only owner view token)
- Billing and subscription gating middleware
- Background jobs for notifications and sync scheduling

## Tests Included

- onboarding persistence
- lead ingestion validation
- deterministic no-AI asset pack generation
- dashboard aggregation query logic

Run tests:

```bash
npm run test
```
