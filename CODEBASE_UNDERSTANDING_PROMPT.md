# BeyondStrings Codebase Understanding + Token-Efficient Prompt Seed

## 1) Project Identity

- Product: BeyondStrings (encrypted chat workspace).
- Stack: React 18 + Vite 5 + Tailwind + Redux Toolkit + redux-persist + Firebase Auth/Firestore.
- Runtime style: mobile-first, single-page app, custom lightweight router.
- Primary modes:
  - Live chat (Firestore-backed, real-time).
  - Imported chat (IndexedDB-backed, isolated from live chats).

## 2) High-Level Architecture

- Entry/bootstrap:
  - src/main.js: mounts app, redux provider, persist gate, theme+favicon sync, service worker registration/update handling.
- Root shell + routing:
  - src/RootApp.js: auth bootstrap, route guards, lazy route loading, theme preference binding.
  - src/hooks/useSimpleRouter.js: tiny history-based router.
- Chat runtime engine:
  - src/App.js: thin wrapper.
  - src/hooks/useLegacyChatRuntime.js: core chat orchestration (state/effects/send/replay/presence/typing/AI/offline).
  - src/features/chat/appRuntimeHelpers.js: pure helper logic and mappers.
- Pages:
  - src/pages/Home.js: chat discovery, direct chat creation, group join, import flow trigger.
  - src/pages/Chat.js: active live chat container and auth-session secret setup.
  - src/pages/ImportedChat.js: imported transcript viewer.
  - src/pages/Profile.js: theme/mode/background/avatar/account preferences.
  - src/pages/Admin.js: real-time admin dashboard.

## 3) State Model

- Redux slices:
  - auth: user/profile/auth status (src/store/authSlice.js).
  - session: UI/account preferences (src/store/appSessionSlice.js).
- Persistence:
  - redux-persist over IndexedDB (src/store/indexedDbStorage.js).
  - persisted state encrypted with AES using VITE_REDUX_PERSIST_SECRET fallback (src/store/store.js).
  - persisted session shape validated on hydrate; invalid payloads are purged.

## 4) Data Flows

### 4.1 Auth and Profile

- Email/password auth via Firebase Auth.
- Profile records in users collection are created/merged on login/register.
- Username normalization rule: first character uppercase + alnum underscore.
- Admin role derived by allowlist logic in social service + Firestore rules.

### 4.2 Live Chat

- Chat subscription:
  - Firestore messages via subscribeToRoomMessages.
  - Typing via subscribeTypingStatus.
  - Presence via subscribeRoomUsers.
- Message mapping:
  - Firestore docs -> UI models using mapLiveMessageToUiMessage.
  - encrypted payload decrypted client-side with room secret.
- Send:
  - encrypt text before send, include senderEnc/clientId/tags/moderation.
  - write message + chat metadata update in batch.
- Read/delivery:
  - markMessageDelivered + markMessageRead (throttled/guarded by refs).
- Delete/reply/reaction:
  - delete for me = deletedFor[userId].
  - delete for everyone = message rewritten to system tombstone.
  - reactions stored per emoji (user arrays or increment fallback).

### 4.3 Offline Queue

- Queue storage: IndexedDB store beyondstrings-offline-queue (src/utils/offlineMessageQueue.js).
- Behavior:
  - optimistic queued messages are merged into UI.
  - automatic flush on reconnect / when online.
  - dedupe by clientId when live docs arrive.

### 4.4 Imported Chats

- Parser:
  - WhatsApp export parser with chunked processing and defensive validation (src/utils/parser.js).
- Storage:
  - imported chats encrypted and stored in IndexedDB (src/utils/importedChatStore.js).
- Isolation:
  - imported chats shown in separate route and do not mix with Firestore live room messages.

### 4.5 AI Pipeline

- Client AI service: src/services/ai/index.js.
- Gateway endpoint: api/ai.js.
- Tasks: summarize, assistant command, reply suggestions, embeddings, web context.
- Fallback strategy:
  - gateway/model provider chain (OpenAI -> Gemini -> Ollama -> local).
  - local deterministic fallbacks for summary/search/suggestions when remote unavailable.
- Security:
  - gateway requires bearer JWT for high-value tasks.

## 5) Security + Privacy Controls

- Firestore security rules enforce:
  - authenticated access,
  - membership checks,
  - admin-only paths,
  - message create constraints.
- Encryption:
  - message content encrypted client-side (CryptoJS AES).
  - sender display names optionally encrypted in presence/typing/message payloads.
  - persisted Redux + imported chats encrypted.
- Sanitization/validation:
  - parser validators, safe mappers, guarded async operations.

## 6) Performance Patterns

- Route lazy loading in RootApp for major pages.
- Manual vendor chunking in vite.config.js.
- Large chat virtualization with react-virtuoso in runtime.
- Chunked file parsing for large imports.
- Background/theme optimizations with reduced-motion and reduced-data handling.

## 7) Operational Assumptions

- Firebase env vars must be present at build time for live mode.
- In missing Firebase config, sample/import fallback paths still keep app functional.
- Service worker enabled in production only; auto-update with reload toast.

## 8) Known Fragility / Implementation Risk Areas

- useLegacyChatRuntime.js is intentionally large and behavior-dense; regressions likely if touching multiple effects simultaneously.
- chatService.js has mixed concerns (send/read/delete/presence cleanup), so changes should be scoped carefully and tested against rules.
- userService.js and socialService.js overlap legacy/new responsibilities; future refactors should avoid introducing duplicate source-of-truth paths.
- parser.js must keep chunking + validation guarantees; avoid naive regex-only rewrites for big files.

## 9) Stable Implementation Constraints (Do Not Break)

- Keep imported chats isolated from live chat datastore.
- Preserve client-side encryption contract for live messages.
- Keep offline queue semantics: enqueue, optimistic render, reconnect flush, clientId dedupe.
- Preserve sender-only delete-for-everyone behavior.
- Preserve route guards for unauthenticated and non-admin users.
- Keep mobile-first interaction quality (long-press/context menu, compact layout, safe-area handling).

## 10) Token-Efficient Prompt Seed (Reusable)

Use this block as a seed for future implementation prompts.

```text
ROLE
You are implementing features in BeyondStrings (React+Vite+Firebase encrypted chat app). Keep changes minimal, safe, and mobile-first.

CODEBASE FACTS
- Routing/auth shell: src/RootApp.js + src/hooks/useSimpleRouter.js
- Chat runtime engine: src/hooks/useLegacyChatRuntime.js
- Runtime helpers/mappers: src/features/chat/appRuntimeHelpers.js
- Live firestore operations: src/firebase/chatService.js
- Auth/social/chat list operations: src/firebase/socialService.js
- Persisted app state: src/store/store.js, src/store/authSlice.js, src/store/appSessionSlice.js
- Offline queue: src/utils/offlineMessageQueue.js
- Imported chats: src/utils/parser.js + src/utils/importedChatStore.js + src/pages/ImportedChat.js
- AI layer: src/services/ai/index.js + api/ai.js

NON-NEGOTIABLES
- Do not break encryption flow for live messages.
- Do not merge imported chat data into live Firestore flow.
- Preserve offline queue + clientId dedupe behavior.
- Preserve sender-only delete-for-everyone authorization.
- Keep lazy-loading and virtualization behavior intact.

TASK
<replace with exact feature request>

DELIVERABLE FORMAT
1) Implementation summary (what changed + why)
2) File-level change list
3) Risk checks against NON-NEGOTIABLES
4) Validation steps run (build/tests/manual)
5) Follow-up TODOs (if any)
```

## 11) Fast File Map for Future Work

- Core runtime behavior: src/hooks/useLegacyChatRuntime.js
- Message shape mapping: src/features/chat/appRuntimeHelpers.js
- Message CRUD/presence/typing: src/firebase/chatService.js
- User/chat discovery/admin stats: src/firebase/socialService.js
- AI orchestration: src/services/ai/index.js
- AI backend fallback chain: api/ai.js
- Import parser robustness: src/utils/parser.js
- Imported storage encryption: src/utils/importedChatStore.js
- Persist encryption/rehydration: src/store/store.js

## 12) Clarification Questions to Keep Future Changes Correct

- Should userService.js remain as legacy support, or should socialService.js become the only supported data-service layer?
- For group chats, should secret-to-chatId mapping stay deterministic SHA-256 forever (compatibility contract), or can this evolve with versioning?
- Is anonymous auth in chat runtime a hard requirement for all environments, or only a fallback for specific deployments?

## 13) Confirmed Group Product Decisions (Apr 22, 2026)

- Group creation: allowed for any authenticated user.
- Join method (v1): group id only (no invite-link requirement).
- Soft-delete retention: 7 days.
- Join approvals: only group owner/admin can approve (no moderator approvals).
- Global roles baseline:
  - admin: top-level platform role with complete application access.
  - user: regular authenticated user; if they create a group, they are that group owner.
