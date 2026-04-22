# Lensiq

Lensiq is a premium encrypted chat workspace built with React, Vite, Firebase, and Redux.

## Current Status

- Production build is passing.
- App runtime was split for maintainability.
- Route-level lazy loading is enabled for major pages.
- Message actions, reply/delete flows, and admin UX improvements are active.

## Core Features

- Firebase auth and Firestore real-time chat
- Encrypted message payload handling
- Presence, typing, delivery, and read states
- Offline queue with reconnect sync
- AI summary, assistant commands, semantic search, and suggestions
- Replay timeline with virtualization for large histories
- Imported chat archives (kept separate from live chat)
- Admin dashboard with user and group visibility

## Navigation

- /home: chat entry and discovery
- /chat/:chatId: live chat thread
- /imported/:importedId: imported chat thread
- /profile: user profile and appearance
- /admin: admin-only dashboard

## Architecture Snapshot

- src/App.js: lightweight wrapper
- src/hooks/useLegacyChatRuntime.js: main chat runtime logic
- src/features/chat/appRuntimeHelpers.js: pure helper functions and mappers
- src/RootApp.js: route-level lazy loading and auth gate

## Tech Stack

- React 18 + Vite 5
- Redux Toolkit + redux-persist
- Firebase Auth + Firestore
- Tailwind CSS + Framer Motion
- react-virtuoso for long-list rendering

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

Client (.env.local):

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
```

## Notes

- Imported chats and live chats remain intentionally separated.
- Settings and insights are loaded lazily where applicable.
- Additional docs in this repo were refreshed to match current behavior.
