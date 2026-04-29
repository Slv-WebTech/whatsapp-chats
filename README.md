# BeyondStrings

<p align="center">
  <img src="public/favicon.svg" alt="BeyondStrings Logo" width="72" />
</p>

<p align="center">
  <b>See Conversations Smarter</b><br/>
  Premium encrypted chat workspace with AI insights, group collaboration, and real-time reliability.
</p>

<p align="center">
  <a href="https://beyondstrings.vercel.app/"><b>Live App</b></a> •
  <a href="#screenshots"><b>Screenshots</b></a> •
  <a href="#setup"><b>Setup</b></a> •
  <a href="#production-check"><b>Production Check</b></a>
</p>

<p align="center">
  <img src="https://img.shields.io/badge/Vite-5.x-646CFF?logo=vite&logoColor=white" alt="Vite" />
  <img src="https://img.shields.io/badge/React-18-149ECA?logo=react&logoColor=white" alt="React" />
  <img src="https://img.shields.io/badge/Firebase-Auth%20%2B%20Firestore-FFCA28?logo=firebase&logoColor=black" alt="Firebase" />
  <img src="https://img.shields.io/badge/Neon-Postgres-00E699?logo=postgresql&logoColor=white" alt="Neon" />
  <img src="https://img.shields.io/badge/Upstash-Redis-111827?logo=redis&logoColor=DC2626" alt="Upstash" />
</p>

## Live Link

- https://beyondstrings.vercel.app/

## Highlights

- 🔐 End-to-end encrypted messaging runtime with reply/reaction workflows
- 👥 Full group lifecycle: create, join, approval flow, role management, leave/delete
- ⚡ Real-time sync health + resilient unread and membership state recovery
- 🧠 AI summary, semantic assistant flow, and conversation insights
- 🗄️ Neon + Upstash + BullMQ integration for analytics and async job execution
- 📱 PWA-ready branding assets, responsive chat UX, and lazy-loaded heavy panels

## Product Modules

- 💬 Messaging: direct chat, replies, reactions, typing, delivery/read states
- 🧩 Groups: approvals, roles (`owner/admin/member`), settings, membership sync
- 📊 Insights: analytics summaries, top senders, activity trend snapshots
- 🤖 AI Layer: summarization + provider fallback chain
- 🛡️ Platform: rate limiting, queue-backed jobs, cache-assisted API responses

## Tech Stack

- Frontend: React 18, Vite 5, Tailwind CSS, Framer Motion
- State: Redux Toolkit + encrypted redux-persist
- Realtime: Firebase Auth + Firestore
- Backend: Vercel Serverless API routes
- Data/Queue: Neon Postgres, Upstash Redis, BullMQ worker
- Security: CryptoJS AES, Firestore security rules

## Architecture Snapshot

| Path | Responsibility |
| --- | --- |
| `src/RootApp.js` | Auth gate + route orchestration + lazy loading |
| `src/hooks/useLegacyChatRuntime.js` | Core chat runtime orchestration |
| `src/firebase/chatService.js` | Messages, reactions, replies, presence |
| `src/firebase/socialService.js` | Groups, membership, approvals, sync |
| `api/ai.js` | AI gateway with provider fallback |
| `api/jobs/enqueue.js` | Async job enqueue endpoint |
| `api/analytics/summary.js` | Cached room analytics API |
| `api/health/infra.js` | Infra health status (Neon/Redis checks) |
| `worker/index.js` | Background worker for queue processors |

## Setup

```bash
npm install
npm run dev
```

Open `http://localhost:5173`.

## Scripts

```bash
npm run dev
npm run build
npm run preview
npm run smoke:infra
npm run verify:prod
npm run worker
npm run worker:dev
npm run migrate:group-approval:dry
npm run migrate:group-approval
```

## Environment

Client (`.env.local`)

```env
PUBLIC_FIREBASE_API_KEY=
PUBLIC_FIREBASE_AUTH_DOMAIN=
PUBLIC_FIREBASE_PROJECT_ID=
PUBLIC_FIREBASE_STORAGE_BUCKET=
PUBLIC_FIREBASE_MESSAGING_SENDER_ID=
PUBLIC_FIREBASE_APP_ID=
PUBLIC_FIREBASE_VAPID_KEY=
PUBLIC_API_BASE_URL=/api
PUBLIC_AI_GATEWAY_ENABLED=true
PUBLIC_AI_PROVIDER_ORDER=openai,gemini,ollama,local
```

Server (`.env` / Vercel)

```env
FIREBASE_PROJECT_ID=
FIREBASE_CLIENT_EMAIL=
FIREBASE_PRIVATE_KEY=
FIREBASE_STORAGE_BUCKET=
DATABASE_URL=
UPSTASH_REDIS_REST_URL=
UPSTASH_REDIS_REST_TOKEN=
REDIS_URL=
OPENAI_API_KEY=
OPENAI_MODEL=gpt-4o-mini
GEMINI_API_KEY=
GEMINI_MODEL=gemini-1.5-flash
AI_GATEWAY_MAX_MESSAGES=200
AI_GATEWAY_MAX_MESSAGE_CHARS=1000
AI_GATEWAY_MAX_QUERY_CHARS=800
AI_GATEWAY_MAX_TOTAL_CHARS=32000
AI_GATEWAY_RATE_WINDOW_MS=60000
AI_GATEWAY_RATE_LIMIT=30
HEALTHCHECK_TOKEN=
```

## Production Check

```bash
npm run verify:prod
```

Health endpoint:

```txt
GET /api/health/infra?token=<HEALTHCHECK_TOKEN>
```

## Screenshots

<table>
  <tr>
    <td align="center" width="33%">
      <img src="screenshots/welcome-screen.png" alt="Welcome screen" width="220" />
      <br/>
      <sub><b>Welcome Screen</b></sub>
      <br/>
      <sub><a href="screenshots/welcome-screen.png">PNG</a> | <a href="screenshots/welcome-screen.svg">SVG</a></sub>
    </td>
    <td align="center" width="33%">
      <img src="screenshots/login-screen.png" alt="Login screen" width="220" />
      <br/>
      <sub><b>Login</b></sub>
      <br/>
      <sub><a href="screenshots/login-screen.png">PNG</a> | <a href="screenshots/login-screen.svg">SVG</a></sub>
    </td>
    <td align="center" width="33%">
      <img src="screenshots/private-chats.png" alt="Private chats" width="220" />
      <br/>
      <sub><b>Private Chats</b></sub>
      <br/>
      <sub><a href="screenshots/private-chats.png">PNG</a> | <a href="screenshots/private-chats.svg">SVG</a></sub>
    </td>
  </tr>
  <tr>
    <td align="center" width="33%">
      <img src="screenshots/group-chats.png" alt="Group chats" width="220" />
      <br/>
      <sub><b>Group Chats</b></sub>
      <br/>
      <sub><a href="screenshots/group-chats.png">PNG</a> | <a href="screenshots/group-chats.svg">SVG</a></sub>
    </td>
    <td align="center" width="33%">
      <img src="screenshots/group-settings.png" alt="Group settings" width="220" />
      <br/>
      <sub><b>Group Settings</b></sub>
      <br/>
      <sub><a href="screenshots/group-settings.png">PNG</a> | <a href="screenshots/group-settings.svg">SVG</a></sub>
    </td>
    <td align="center" width="33%">
      <img src="screenshots/admin-dashboard.png" alt="Admin dashboard" width="220" />
      <br/>
      <sub><b>Admin Dashboard</b></sub>
      <br/>
      <sub><a href="screenshots/admin-dashboard.png">PNG</a> | <a href="screenshots/admin-dashboard.svg">SVG</a></sub>
    </td>
  </tr>
</table>
