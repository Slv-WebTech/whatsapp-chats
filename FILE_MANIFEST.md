# File Manifest

This manifest reflects the current documentation and architecture after the App refactor and group chat implementation.

## Documentation Files

- README.md — full feature list, architecture, env vars, scripts, and screenshot gallery
- QUICK_START_GUIDE.md — install, env setup (client + server), migrations, QA checklist
- GITHUB_DEPLOYMENT.md — branch flow and deployment checks
- AI_FEATURES_TESTING.md — AI feature test cases
- EDGE_CASE_IMPROVEMENTS.md — edge-case handling notes
- ROBUSTNESS_IMPLEMENTATION.md — resilience and reliability notes
- IMPLEMENTATION_COMPLETE.md — original implementation sign-off
- PROJECT_COMPLETION.md — project milestone record
- FILE_MANIFEST.md — this file

## Visual Assets

- `screenshots/*.png` — UI preview raster captures
- `screenshots/*.svg` — vector export variants for documentation and sharing

## Branding Source of Truth

- `src/config/branding.js` — canonical app name, tagline, and asset references.
- `src/config/brandTokens.js` — derived brand keys/tokens used across runtime.
- `index.html` — SEO metadata (title/description/OpenGraph/Twitter).
- `public/site.webmanifest` — PWA app name and icons.

## Key Application Files

### Entry & Routing

- `src/App.js` — Thin wrapper that delegates to runtime hook.
- `src/RootApp.js` — Router shell, auth gate, login-time membership sync (`syncMembershipOnLogin`), and route-level lazy loading.
- `src/pages/Chat.js` — Bridge between route context and legacy chat runtime.

### Chat Runtime

- `src/hooks/useLegacyChatRuntime.js` — Main chat runtime (state orchestration, effects, handlers, group settings, sync health).
- `src/features/chat/appRuntimeHelpers.js` — Pure helper functions/constants: timestamps, replay delay, background tokens, theme pickers, sync health label.

### Firebase Services

- `src/firebase/chatService.js` — Firestore message CRUD, reactions (array-based toggle), reply metadata persistence, unread counter increments, `user_chats` self-healing.
- `src/firebase/socialService.js` — Group management (create, join, approve, reject, leave, delete), member roles, login-time sync, join request queue, `updateChatReadState`.
- `src/firebase/userService.js` — User profiles, username search.
- `src/firebase/config.js` — Firebase app and Firestore initialization.

### Components

- `src/components/ChatBubble.js` — Message bubble: reply block, emoji reactions (👍 ❤️ 😂 🔥), action menu, delivery status. Mobile-first widths (`max-w-[100vw]`).
- `src/components/ChatHeader.js` — Sticky header: sync health chip (Offline/Syncing/Degraded/Live), clickable group title for settings.
- `src/components/GroupSettingsPanel.js` — Group settings modal: edit name/description/photo, member list (role-sorted), remove member, leave group, delete group.
- `src/components/ChatListItem.js` — Sidebar item with unread count from `memberMeta[uid].unreadCount`.
- `src/components/AISidePanel.js` — AI summary, assistant, search, reply suggestions panel.
- `src/components/ReactionBar.js` — Per-message reaction display.
- `src/components/AuthForms.js` — Sign-in / sign-up forms.
- `src/components/SearchBar.js` — In-chat message search.
- `src/components/SettingsPanel.js` — Appearance, background, and preferences.

### Pages

- `src/pages/Home.js` — Chat discovery: start direct chat, create group, join by group ID (with approval flow).
- `src/pages/Admin.js` — Admin dashboard: scrollable group table (single-row layout), user list.
- `src/pages/Profile.js` — User avatar, username, preferences.
- `src/pages/ImportedChat.js` — Imported chat archive viewer.

### State

- `src/store/store.js` — Redux store with encrypted persist.
- `src/store/authSlice.js` — Auth state.
- `src/store/appSessionSlice.js` — Session-level UI state.

### AI Gateway

- `api/ai.js` — Serverless AI handler: summarize, reply_suggestions, assistant, web_context, embeddings. Supports OpenAI → Gemini → Ollama → local fallback chain.
- `src/services/ai/index.js` — Client-side AI service: gateway calls, cosine similarity, local mood scoring.
- `src/utils/aiSummary.js` — AI summary orchestration with provider fallbacks.
- `src/utils/localSummary.js` — Offline local summary fallback.

### Utilities

- `src/utils/parser.js` — WhatsApp `.txt` chat file parser.
- `src/utils/encryption.js` — AES encrypt/decrypt; group key `grp:{chatId}`.
- `src/utils/groupMessages.js` — Message grouping by sender and date.
- `src/utils/messageTypes.js` — Message type constants and predicates.
- `src/utils/sanitization.js` — Input sanitization helpers.
- `src/utils/validators.js` — Form and data validators.
- `src/utils/errorHandling.js` — Centralized error classification.
- `src/utils/offlineMessageQueue.js` — Offline-first queue with reconnect sync.
- `src/utils/chatBackgrounds.js` — Preset background image list.
- `src/utils/highlight.js` — Search keyword highlighting.
- `src/utils/performance.js` — Render performance utilities.

### Config

- `src/config/branding.js` — Brand name and tagline (`BeyondStrings`).
- `src/config/brandTokens.js` — Design tokens.

### Security Rules

- `firestore.rules` — Firestore security rules. Legacy group support (no `joinPolicy`), rejoin flow, join request re-submit, system messages.

## Build and Bundling

- Vite manual chunking configured in `vite.config.js` for heavy vendor groups.
- Route-level lazy loading active for Home, Chat, Admin, Profile, and ImportedChat pages.
- GroupSettingsPanel and AISidePanel loaded lazily within the chat runtime.

## Oversized File Check

- Component files are below 1000 lines.
- `useLegacyChatRuntime.js` holds the largest code path by design (chat orchestration).
- `socialService.js` holds group management APIs and is the second-largest service file.
