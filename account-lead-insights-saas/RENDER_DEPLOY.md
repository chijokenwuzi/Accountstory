# Render Deployment Guide

Create three services from this repo:

1) `ali-api` (Web Service)
- Root Directory: `account-lead-insights-saas`
- Build Command: `npm install && npm run build -w @ali/api && npm run prisma:generate`
- Start Command: `npm run start -w @ali/api`

2) `ali-web` (Web Service)
- Root Directory: `account-lead-insights-saas`
- Build Command: `npm install && npm run build -w @ali/web`
- Start Command: `npm run start -w @ali/web`

3) `ali-worker` (Background Worker)
- Root Directory: `account-lead-insights-saas`
- Build Command: `npm install && npm run build -w @ali/worker`
- Start Command: `npm run start -w @ali/worker`

## Managed Resources
- Attach Postgres to API service (`DATABASE_URL`)
- Attach Redis to API + Worker (`REDIS_URL`)

## Required Env Vars
- `DATABASE_URL`
- `REDIS_URL`
- `JWT_ACCESS_SECRET`
- `JWT_REFRESH_SECRET`
- `ENCRYPTION_KEY_HEX`
- `NEXT_PUBLIC_API_URL` (for web)
- Stripe keys if billing enabled
- OpenAI key if AI mode enabled

## Migrations on deploy
- Add deploy hook step in API startup process:
  - `npm run prisma:migrate`
