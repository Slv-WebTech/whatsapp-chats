# BeyondStrings

BeyondStrings is a premium encrypted chat workspace built with React, Vite, Firebase, and Redux.

## Branding

- App Name: `BeyondStrings`
- Tagline: `See Conversations Smarter`
- Primary branding config: `src/config/branding.js`
- Package name: `beyondstrings`
- PWA manifest name: `BeyondStrings` (`public/site.webmanifest`)

### Brand Assets (public)

- `favicon.ico`
- `favicon.svg`
- `favicon-96x96.png`
- `apple-touch-icon.png`
- `web-app-manifest-192x192.png`
- `web-app-manifest-512x512.png`

## Current Status

- Production build passing (3000+ modules, Vite 5).
- App runtime split for maintainability; route-level lazy loading active.
- Group chat system fully implemented with management lifecycle.
- Reply persistence, reaction rendering, and unread counters active.
- Sync health indicator live in chat header.

## Core Features

### Messaging

- Firebase Auth and Firestore real-time chat
- Encrypted message payload (AES, CryptoJS)
- Presence, typing indicators, delivery and read states
- Offline queue with automatic reconnect sync
- Reply-to messages with persisted metadata in Firestore
- Emoji reactions (👍 ❤️ 😂 🔥) with per-message counts
- Message actions: reply, copy, forward, delete-for-me, delete-for-all

### Group Chat

- Create group chats with name, photo, and description
- Join by group ID (open join or approval-required flow)
- Join request queue with approve/reject for admins
- Member roles: owner, admin, member
- Group Settings panel: rename, photo, description, member list
- Remove member (admin/owner only)
- Leave group (non-owner members)
- Delete group for all (owner only)
- Rejoin after removal: re-submits join request automatically
- Login-time membership sync restores sidebar after relogin
- System messages for join, leave, remove events

### Presence & Reliability

- Real-time sync health indicator (Offline / Syncing / Degraded / Live)
- Richer unread counters stored per-member in Firestore
- Per-doc resilience: chat list continues loading on transient errors
- Self-healing `user_chats` materialization on send and read

### AI & Insights

- AI summary, assistant commands, semantic search, and reply suggestions
- Replay timeline with virtualization for large histories
- Chat insights panel with mood scoring and key-point extraction

### Other

- Imported chat archives (kept separate from live chat)
- Admin dashboard with user and group visibility (single-row responsive table)
- Profile page with avatar, username, and appearance settings

## Navigation

- `/home` — chat discovery, group creation, join by ID
- `/chat/:chatId` — live chat thread (direct or group)
- `/imported/:importedId` — imported chat archive thread
- `/profile` — user profile and appearance
- `/admin` — admin dashboard (role-gated)

## Architecture Snapshot

| File                                     | Role                                                   |
| ---------------------------------------- | ------------------------------------------------------ |
| `src/App.js`                             | Lightweight wrapper                                    |
| `src/RootApp.js`                         | Auth gate, route-level lazy loading, login-time sync   |
| `src/hooks/useLegacyChatRuntime.js`      | Main chat runtime: state, effects, handlers            |
| `src/features/chat/appRuntimeHelpers.js` | Pure helpers: timestamps, backgrounds, theme tokens    |
| `src/firebase/chatService.js`            | Firestore messages, presence, typing, reactions, reply |
| `src/firebase/socialService.js`          | Group management, membership, sync, join requests      |
| `src/firebase/userService.js`            | User profiles, search                                  |
| `src/components/ChatBubble.js`           | Message bubble with reply, reactions, action menu      |
| `src/components/ChatHeader.js`           | Sticky header with sync health, group title click      |
| `src/components/GroupSettingsPanel.js`   | Group settings modal: edit, member list, leave/delete  |
| `src/pages/Admin.js`                     | Admin dashboard with scrollable group table            |

## Tech Stack

- React 18 + Vite 5
- Redux Toolkit + redux-persist (encrypted)
- Firebase Auth + Firestore
- Tailwind CSS + Framer Motion
- react-virtuoso for long-list rendering
- CryptoJS AES for client-side message encryption

## Setup

```bash
npm install
npm run dev
```

## Build

```bash
npm run build
npm run preview
```

## Environment Variables

Client (`.env.local`):

```env
VITE_FIREBASE_API_KEY=
VITE_FIREBASE_AUTH_DOMAIN=
VITE_FIREBASE_PROJECT_ID=
VITE_FIREBASE_STORAGE_BUCKET=
VITE_FIREBASE_MESSAGING_SENDER_ID=
VITE_FIREBASE_APP_ID=
VITE_REDUX_PERSIST_SECRET=
VITE_IMPORTED_CHAT_SECRET=
VITE_MESSAGE_TONE_URL=
VITE_AI_GATEWAY_ENABLED=true
VITE_AI_PROVIDER_ORDER=openai,gemini,ollama,local
```

Server (Vercel / `.env`):

```env
OPENAI_API_KEY=
OPENAI_MODEL=gpt-4o-mini
GEMINI_API_KEY=
GEMINI_MODEL=gemini-1.5-flash
HUGGINGFACE_API_KEY=
HUGGINGFACE_EMBEDDING_MODEL=sentence-transformers/all-MiniLM-L6-v2
OLLAMA_BASE_URL=http://127.0.0.1:11434
OLLAMA_MODEL=llama3.2:3b
TAVILY_API_KEY=
```

## Firestore Rules

Deploy with:

```bash
firebase deploy --only firestore:rules
```

Key rules:

- Members can read/write messages in chats they belong to
- Group owners can manage member roles and settings
- Join requests: users can create and re-submit (rejoin flow)
- Legacy groups (no `joinPolicy` field) treated as open-join

## Notes

- Imported chats and live chats are intentionally separated in state and routing.
- Group secret for encryption is derived as `grp:{chatId}`.
- Group owner cannot leave — must use delete group instead.
- Settings and insights panels are loaded lazily.
