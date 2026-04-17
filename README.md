# ConvoLens

> **See Conversations Differently.**

A premium real-time encrypted chat app with message replay, AI-powered chat insights, and a polished WhatsApp-style UI — built with React 18, Vite 5, Firebase, and Redux Toolkit.

---

## Live Demo

| Platform | URL                              |
| -------- | -------------------------------- |
| Vercel   | https://convolens-vs.vercel.app/ |

---

## Table of Contents

- [Features](#features)
- [Tech Stack](#tech-stack)
- [Project Structure](#project-structure)
- [Getting Started](#getting-started)
- [Environment Variables](#environment-variables)
- [Scripts](#scripts)
- [Architecture Overview](#architecture-overview)
- [Deployment](#deployment)
- [Firestore Security Rules](#firestore-security-rules)
- [Troubleshooting](#troubleshooting)
- [Author](#author)
- [License](#license)

---

## Features

### Messaging

- Shared-secret room login with Firebase anonymous auth
- AES-256 encrypted message content and display metadata
- Real-time message delivery and read receipts
- Online presence indicators, typing status, and heartbeat sync
- Emoji reactions on messages
- Virtualized message list for smooth performance at scale

### Modes & Themes

- **Formal** and **Romantic** chat modes with distinct visual styles
- **Light**, **Dark**, and **System** theme support
- Wallpaper presets plus custom wallpaper upload
- Dynamic composer background that blends with the active wallpaper

### Chat Replay

- Full replay timeline with playback speed control
- Jump to any point in the conversation history
- Smooth animated replay with per-message timing

### Chat Insights

- AI-powered conversation summary (OpenAI or local Ollama)
- Fallback to local rule-based analysis when AI is unavailable
- Charts and analytics via Recharts (lazy loaded)
- Sentiment, frequency, and activity breakdowns

### Import & Export

- Parse and import WhatsApp `.txt` export files
- Export current chat view as a PNG image
- Sample chat preloaded for instant demo

### Search

- Full message search with next/previous navigation
- Match highlighting with scroll-into-focus

### Reliability & UX Safeguards

- App-level React Error Boundary with one-click recovery UI
- Version-aware service worker for cache invalidation
- Automatic cache cleanup on every app version update
- Automatic purge of invalid or corrupted persisted Redux state
- In-app "App updated, reloading..." toast before automatic reload
- AES-encrypted Redux persist storage

---

## Tech Stack

| Layer                | Library / Tool                        |
| -------------------- | ------------------------------------- |
| UI Framework         | React 18                              |
| Build Tool           | Vite 5                                |
| Styling              | Tailwind CSS 3                        |
| Animations           | Framer Motion                         |
| Component Primitives | Radix UI (Dialog, Select)             |
| Icons                | Lucide React                          |
| Backend              | Firebase Auth (anonymous) + Firestore |
| State Management     | Redux Toolkit + redux-persist         |
| Encryption           | CryptoJS (AES-256)                    |
| Virtualisation       | react-virtuoso                        |
| Charts               | Recharts                              |
| Image Export         | html-to-image                         |
| AI Summary           | OpenAI API / Ollama (local)           |

---

## Project Structure

```
convolens/
├── public/
│   ├── sw.js                   # Versioned service worker
│   ├── site.webmanifest        # PWA manifest
│   └── icons/                  # App icons
├── src/
│   ├── components/
│   │   ├── AppErrorBoundary.js # Global React error boundary
│   │   ├── ChatBubble.js       # Individual message bubble
│   │   ├── ChatHeader.js       # Room header, search, actions
│   │   ├── ChatInsights.js     # Analytics panel (lazy loaded)
│   │   ├── LiveComposer.js     # Message input & send bar
│   │   ├── ReplayControls.js   # Replay timeline & speed
│   │   ├── SecretLogin.js      # Room join / create screen
│   │   ├── SettingsPanel.js    # Theme, wallpaper, mode (lazy loaded)
│   │   ├── FileUpload.js       # WhatsApp chat import
│   │   ├── ErrorBoundary.js    # Scoped error boundary
│   │   ├── Assets/             # Static assets & sample chat
│   │   └── ui/                 # Radix-based UI primitives
│   ├── firebase/
│   │   ├── config.js           # Firebase initialisation
│   │   └── chatService.js      # Firestore read/write operations
│   ├── hooks/
│   │   └── useChatAnalysis.js  # Analysis hook for insights
│   ├── store/
│   │   ├── store.js            # Redux store + persist config
│   │   └── appSessionSlice.js  # Session state slice
│   ├── utils/
│   │   ├── aiSummary.js        # OpenAI / Ollama summary logic
│   │   ├── encryption.js       # AES encrypt/decrypt helpers
│   │   ├── groupMessages.js    # Message grouping by date/sender
│   │   ├── highlight.js        # Search match highlighting
│   │   ├── localSummary.js     # Rule-based local summary fallback
│   │   ├── messageTypes.js     # Message type constants
│   │   ├── parser.js           # WhatsApp .txt export parser
│   │   ├── performance.js      # Perf utility helpers
│   │   ├── sanitization.js     # Input sanitisation
│   │   └── validators.js       # Form/data validators
│   ├── App.js                  # Main app orchestrator
│   ├── main.js                 # React root, SW registration, version check
│   └── index.css               # Global styles, CSS variables, wallpaper theming
├── vite.config.js              # Vite config (base, chunks, defines)
├── tailwind.config.js
├── postcss.config.js
└── package.json
```

---

## Getting Started

### Prerequisites

- Node.js 18+
- pnpm (recommended) or npm
- A Firebase project with **Anonymous Auth** and **Firestore** enabled

### 1. Clone and install

```bash
git clone https://github.com/Slv-WebTech/whatsapp-chats.git
cd whatsapp-chats
pnpm install
# or: npm install
```

### 2. Configure environment variables

Create a `.env.local` file in the project root (see [Environment Variables](#environment-variables)).

### 3. Run the dev server

```bash
pnpm run dev
# or: npm run dev
```

App starts at `http://localhost:5173`.

### 4. Build for production

```bash
pnpm run build
# or: npm run build
```

Output is written to `dist/`.

### 5. Preview the production build locally

```bash
pnpm run preview
```

---

## Environment Variables

Create `.env.local` in the project root:

```env
# ── Firebase (required) ──────────────────────────────────────
VITE_FIREBASE_API_KEY=your_api_key
VITE_FIREBASE_AUTH_DOMAIN=your_project.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=your_project_id
VITE_FIREBASE_STORAGE_BUCKET=your_project.appspot.com
VITE_FIREBASE_MESSAGING_SENDER_ID=your_sender_id
VITE_FIREBASE_APP_ID=your_app_id

# ── AI Summary (optional) ────────────────────────────────────
# OpenAI (cloud)
VITE_OPENAI_API_KEY=sk-...

# Ollama (local LLM — no API key needed)
VITE_OLLAMA_BASE_URL=http://127.0.0.1:11434
VITE_OLLAMA_MODEL=llama3.2:3b

# ── App Settings (optional) ──────────────────────────────────
# URL to an audio file played on message send
VITE_MESSAGE_TONE_URL=

# Secret used to AES-encrypt the Redux persist storage
VITE_REDUX_PERSIST_SECRET=change_me_to_a_strong_secret
```

> **Note:** Firebase environment variables must be present at **build time**. Do not add `.env.local` to version control.

---

## Scripts

| Command            | Description                        |
| ------------------ | ---------------------------------- |
| `pnpm run dev`     | Start Vite dev server on port 5173 |
| `pnpm run build`   | Production build to `dist/`        |
| `pnpm run preview` | Serve the production build locally |

---

## Architecture Overview

### Encryption

All messages are AES-encrypted client-side before being written to Firestore. The room secret entered at login is the encryption key — the server never sees plaintext content. Redux persist storage is also AES-encrypted using `VITE_REDUX_PERSIST_SECRET`.

### State Management

Redux Toolkit manages all session state (auth, theme, chat mode, wallpaper, avatars). `redux-persist` saves this to `localStorage` with AES encryption. On startup, a shape validator runs against the restored state and automatically calls `persistor.purge()` if the data is malformed or corrupted.

### Service Worker & Versioning

`public/sw.js` uses a versioned cache name (`convolens-cache-<version>`). On each app update, the old cache is deleted automatically. The app version is read from `package.json` at build time via Vite's `define` and stored in `localStorage`. A version mismatch on startup triggers cache cleanup and a reload toast.

### Code Splitting

Heavy components are deferred until first use:

- `ChatInsights` — lazy loaded on panel open
- `SettingsPanel` — lazy loaded on panel open
- `html-to-image` — dynamically imported only during export

Vendor chunks are split for optimal CDN caching:

- `vendor-firebase` — Firebase SDK
- `vendor-recharts` — Recharts charting library

### AI Chat Insights

`ChatInsights` tries providers in order:

1. OpenAI (`VITE_OPENAI_API_KEY` present) — cloud summarisation
2. Ollama (`VITE_OLLAMA_BASE_URL` present) — local LLM
3. Local rule-based analysis (`localSummary.js`) — always available, no API required

---

## Deployment

### Vercel (recommended)

1. Push the repo to GitHub.
2. Import the project in [Vercel](https://vercel.com/).
3. Set all `VITE_*` environment variables in **Project Settings → Environment Variables**.
4. Deploy. Vercel detects Vite automatically; no custom build commands are needed.
5. Bump `version` in `package.json` before each release to trigger the update flow.

No base path configuration is required — the build targets root (`/`) by default.

---

## Firestore Security Rules

```js
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /rooms/{roomId} {
      allow read, write: if request.auth != null;

      match /messages/{messageId} {
        allow read, write, delete: if request.auth != null;
      }

      match /typing/{typingId} {
        allow read, write, delete: if request.auth != null;
      }

      match /users/{userId} {
        allow read, write, delete: if request.auth != null;
      }
    }
  }
}
```

> All operations require Firebase anonymous auth. Unauthenticated reads and writes are denied.

---

## Troubleshooting

### Blank screen after deploy

- Confirm `VITE_FIREBASE_*` vars are set in your hosting provider's environment settings.
- Check that asset paths in `dist/index.html` start with `/assets/...`.
- Hard-refresh (`Ctrl+Shift+R`) to bypass the browser cache.

### App not updating after a new release

- Bump `version` in `package.json` before building and deploying.
- The version change triggers cache purge and reloads the app automatically.

### Firebase auth or Firestore errors

- Verify anonymous auth is enabled in the Firebase console under **Authentication → Sign-in method**.
- Ensure Firestore is created in a supported region and the security rules above are published.
- Check browser console for specific Firebase error codes.

### AI insights not working

- For OpenAI: confirm `VITE_OPENAI_API_KEY` is valid and has sufficient quota.
- For Ollama: ensure the local server is running (`ollama serve`) and the model is pulled (`ollama pull llama3.2:3b`).
- If neither is configured, the app falls back to local rule-based analysis automatically.

### Dev server port conflict

- The dev server defaults to port **5173**. If that port is taken, Vite will automatically pick the next available port.

---

## Author

**Vivek Sharma**

---

## License

MIT
