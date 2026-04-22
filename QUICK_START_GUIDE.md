# Quick Start Guide

## 1) Install and Run

```bash
npm install
npm run dev
```

Open http://localhost:5173.

## 2) Configure Firebase

Create .env.local with your Firebase project values:

```env
VITE_FIREBASE_API_KEY=
VITE_FIREBASE_AUTH_DOMAIN=
VITE_FIREBASE_PROJECT_ID=
VITE_FIREBASE_STORAGE_BUCKET=
VITE_FIREBASE_MESSAGING_SENDER_ID=
VITE_FIREBASE_APP_ID=
VITE_REDUX_PERSIST_SECRET=
```

## 3) Build for Production

```bash
npm run build
npm run preview
```

## 4) Main Product Flow

1. Sign in or create account
2. Open Home and pick/start a chat
3. Use chat actions from bubble action trigger
4. Open Settings from chat header for appearance and tools
5. Use Admin dashboard if account role is admin

## 5) Refactor-Oriented Dev Notes

- Keep src/App.js lightweight.
- Add pure logic to src/features/chat.
- Keep route concerns in src/RootApp.js.
- Use lazy loading for any heavy page/panel.

## 6) Quick QA Checklist

- Login and open direct/group chat
- Send, reply, delete-for-me, delete-for-everyone (own messages only)
- Verify presence and typing updates
- Validate imported chat opens correctly
- Check build completes without errors
