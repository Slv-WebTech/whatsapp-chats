# Production Checklist

## Environment

- Set `DATABASE_URL` (Neon Postgres, `sslmode=require`)
- Set `UPSTASH_REDIS_REST_URL`
- Set `UPSTASH_REDIS_REST_TOKEN`
- Set `REDIS_URL` (`rediss://default:<password>@<host>:6380`)
- Set Firebase Admin env vars (`FIREBASE_PROJECT_ID`, `FIREBASE_CLIENT_EMAIL`, `FIREBASE_PRIVATE_KEY`)
- Set `HEALTHCHECK_TOKEN` for protected infra health endpoint

## Database

- Run `db/schema.sql` in Neon SQL Editor
- Verify tables: `messages`, `analytics_daily`, `ai_insights`, `job_audit`

## Deploy

- Deploy API app (Vercel)
- Deploy worker separately (`npm run worker`) on Railway/Render/VM
- Ensure worker runtime has `DATABASE_URL`, `REDIS_URL`, and AI provider keys (if AI jobs are used)

## Verification

- Run one-command local verification: `npm run verify:prod`
- Check infra health endpoint:
  - `GET /api/health/infra?token=<HEALTHCHECK_TOKEN>`
- Confirm job flow:
  - enqueue via `/api/jobs/enqueue`
  - verify worker logs completed jobs

## Ongoing Ops

- Monitor queue depth and failed jobs
- Rotate Redis and DB credentials periodically
- Keep `firestore.rules` and `firestore.indexes.json` in deploy pipeline
