# Quick Start Guide

## Branding Snapshot

- App Name: `BeyondStrings`
- Tagline: `See Conversations Smarter`
- Update once in: `src/config/branding.js`
- PWA/SEO metadata lives in: `index.html` and `public/site.webmanifest`

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
2. Open Home — pick a direct chat, create a group, or join by group ID
3. In a group chat: tap the group name in the header to open Group Settings
4. Use bubble long-press / action menu for reply, react (👍 ❤️ 😂 🔥), copy, delete
5. Group owners can manage members, rename, and delete from Group Settings
6. Non-owner members can leave from Group Settings
7. Admin dashboard is accessible via `/admin` for admin-role accounts

## 5) Refactor-Oriented Dev Notes

- Keep `src/App.js` lightweight.
- Add pure helpers to `src/features/chat/appRuntimeHelpers.js`.
- Keep route concerns and auth bootstrap in `src/RootApp.js`.
- Use lazy loading for heavy panels (GroupSettingsPanel, AISidePanel, etc.).
- Group management APIs live in `src/firebase/socialService.js`.
- Message CRUD and reactions live in `src/firebase/chatService.js`.

## 6) Quick QA Checklist

- Login; verify sidebar restores group chats without re-joining
- Open direct chat: send, reply (check reply block renders), react with emoji
- Open group chat: verify member count subtitle, sync health chip in header
- Group Settings: rename, change description, view member list
- Remove member (admin/owner); confirm system message appears
- Leave group as non-owner member; confirm removed from sidebar
- Delete group as owner; confirm chat disappears for all
- Join a group by ID (open join); join approval-required group (request flow)
- Rejoined after removal: verify join request submits automatically
- Delete-for-me and delete-for-everyone (own messages only)
- Verify presence and typing indicator updates in real time
- Open imported chat; verify it stays separate from live chats
- Run `npm run build` — must complete with 0 errors
