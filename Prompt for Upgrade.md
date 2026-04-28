ROLE
You are a principal-level frontend architect, product manager, and AI systems designer.

Your task is to transform my existing application “BeyondStrings” from a feature-rich chat project into a production-grade, market-ready product.

---

## CURRENT SYSTEM CONTEXT (IMPORTANT)

BeyondStrings is a React + Vite + Firebase app with:

- Real-time chat (Firestore)
- Client-side encrypted messaging
- Offline message queue with sync
- Imported chat analysis system (IndexedDB)
- AI pipeline (OpenAI + Gemini + Ollama fallback)
- Virtualized message rendering
- Mobile-first UI

The system is technically strong but lacks product clarity and real-world positioning.

---

## CORE PROBLEM TO SOLVE

The app currently behaves like:
→ “A chat app with AI features”

But it must become:
→ “An AI-powered Conversation Intelligence Platform”

---

## TARGET PRODUCT VISION

BeyondStrings should help users:

- Understand conversations
- Extract meaningful insights
- Track decisions and tasks
- Analyze communication patterns
- Replay and review discussions

---

## TARGET USERS

- Professionals (meetings, decisions)
- Teams (collaboration tracking)
- Individuals (relationship insights)
- Creators (story/chat analysis)

---

## PRIMARY UX SHIFT (CRITICAL)

Shift from:
Chat → AI

To:
AI → Chat

AI should be the entry point, not an add-on.

---

## PHASE 1 — PRODUCT FOUNDATION

1. LANDING EXPERIENCE

Create a structured entry screen with clear actions:

- Start Live Chat
- Import Chat
- Analyze Conversation

Add onboarding hints and guidance.

---

2. AI-FIRST DASHBOARD (CORE FEATURE)

Build a central “Conversation Intelligence Dashboard”:

Include:

- AI Summary
- Key Insights
- Extracted Tasks
- Important Messages
- Sentiment Overview

UI:

- Card-based layout
- Collapsible sections
- Smooth loading states

---

3. SMART SEARCH (SEMANTIC)

Implement semantic search using embeddings:

- “Find salary discussion”
- “Show arguments”
- “Show decisions”

Highlight results inside chat.

---

4. MESSAGE PRIORITIZATION

Add:

- Pin messages
- Bookmark important messages
- Tag messages (AI-assisted)

---

## PHASE 2 — INTELLIGENCE FEATURES

5. AI ASSISTANT MODE

Enable commands inside chat:

- @AI summarize last messages
- @AI extract tasks
- @AI explain conversation

UI:

- Inline responses
- Highlighted AI blocks

---

6. CHAT ANALYTICS

Build analytics:

- Most active users
- Message frequency graph
- Topic clustering
- Conversation sentiment timeline

---

7. TIMELINE + REPLAY SYSTEM

Implement:

- Timeline view of conversation
- Replay messages with animation
- Highlight key events

---

8. SMART NOTIFICATIONS

Only notify:

- Important messages
- Mentions
- AI-flagged items

---

## PHASE 3 — USER VALUE FEATURES

9. EXPORT SYSTEM

- Export chat as:
  - PDF
  - Image
  - Summary report

---

10. MEDIA + FILE SUPPORT

- Secure file sharing
- Media preview
- Download controls

---

11. USER PROFILES

- Avatar
- Name
- Activity status

---

## PHASE 4 — UX & DESIGN SYSTEM

12. PREMIUM UI SYSTEM

Implement:

- Glassmorphism
- Gradient-based design
- Soft glow effects
- Depth and layering

---

13. MOBILE-FIRST UX

- Swipe gestures:
  - reply
  - react
- Bottom sheets
- Sticky input

---

14. WEB EXPERIENCE

- Sidebar navigation
- Optional AI panel
- Smooth transitions

---

15. MICRO-INTERACTIONS

Use Framer Motion:

- Message animations
- Button feedback
- Hover states

---

## PHASE 5 — SECURITY & ARCHITECTURE

16. ENCRYPTION UPGRADE

Replace CryptoJS with:

- Web Crypto API
- AES-GCM + PBKDF2

---

17. API SECURITY

- Move AI API calls to serverless (Vercel)
- Never expose API keys

---

18. FIRESTORE RULES

- Room-based access
- Role-based permissions
- Message validation

---

## PHASE 6 — PERFORMANCE

19. OPTIMIZATION

- Virtualized message rendering
- Lazy load AI modules
- Cache AI responses
- Debounce search

---

## PHASE 7 — PRODUCTIZATION

20. ONBOARDING

- First-time user flow
- Guided usage

---

21. EMPTY STATES

- Meaningful UI
- Call-to-action
- AI suggestions

---

22. METRICS & TRACKING

Track:

- Active users
- AI usage
- Session time

---

23. ERROR HANDLING

- Graceful failures
- Retry mechanisms
- User feedback

---

## FINAL GOAL

Transform BeyondStrings into:

- A real-world product (not just a demo)
- AI-first communication platform
- Scalable and secure system
- Visually premium application
- Highly useful for real users

---

## IMPORTANT RULES

- Do not break existing architecture
- Preserve encryption and offline queue behavior
- Keep imported chats isolated
- Maintain mobile-first design
- Avoid overengineering

---

## DELIVERABLE

Implement this transformation in structured phases:

1. Product UX (foundation)
2. AI features (core value)
3. UI/UX polish
4. Performance + security
5. Final production readiness

---

Think like:

- Product manager (user value)
- Architect (scalability)
- Designer (experience)
- Engineer (clean code)

ROLE
You are a senior full-stack engineer and product-focused developer.

Your task is to implement a production-grade upgrade of the BeyondStrings application by breaking work into structured GitHub tasks and executing them safely within the existing architecture.

---

## PROJECT CONTEXT

BeyondStrings is a React + Vite + Firebase AI-powered chat application with:

- Real-time chat (Firestore)
- Client-side encryption
- Offline message queue (IndexedDB)
- Imported chat system (isolated)
- AI pipeline (OpenAI + Gemini + Ollama fallback)
- Mobile-first UI
- Virtualized message rendering

---

## PRODUCT GOAL

Transform BeyondStrings from:
→ “Chat app with AI features”

Into:
→ “AI-powered Conversation Intelligence Platform”

---

## NON-NEGOTIABLES (DO NOT BREAK)

- Do NOT break encryption flow
- Do NOT merge imported chat with live chat
- Preserve offline queue + clientId dedupe
- Preserve Firestore structure and rules
- Keep mobile-first UX intact
- Maintain performance (virtualization)

---

## IMPLEMENTATION STRATEGY

Execute tasks in phases.

For each task:

- Make minimal, safe changes
- Avoid large refactors unless required
- Maintain backward compatibility

---

PHASE 1 — PRODUCT FOUNDATION

TASK 1: Landing Page

- Create src/pages/LandingPage.jsx
- Add 3 options:
  - Start Chat
  - Import Chat
  - Analyze Chat
- Add modern UI with CTA cards

TASK 2: Onboarding

- Detect first visit (localStorage)
- Show modal with feature overview

TASK 3: Routing Update

- Update RootApp.js
- Set LandingPage as default route

---

PHASE 2 — AI CORE

TASK 4: AI Dashboard

- Create src/components/ai/AIDashboard.jsx
- Sections:
  - Summary
  - Insights
  - Tasks
  - Sentiment

TASK 5: AI Integration

- Use existing AI service
- Add generateSummary(messages)
- Cache responses

TASK 6: Dashboard UI Integration

- Add toggle button in Chat page
- Desktop: right panel
- Mobile: bottom sheet

---

PHASE 3 — SMART SEARCH

TASK 7: Search UI

- Add search bar in chat header
- Add filters (user, media, date)

TASK 8: Semantic Search

- Use AI embeddings or fallback
- Highlight results

---

PHASE 4 — AI ASSISTANT

TASK 9: @AI Commands

- Detect @AI in input
- Call AI service
- Render AI message block

---

PHASE 5 — ANALYTICS

TASK 10: Analytics Engine

- Compute:
  - messages per user
  - activity timeline

TASK 11: Analytics UI

- Charts (bar + line)
- Use lightweight chart library

---

PHASE 6 — TIMELINE + REPLAY

TASK 12: Timeline View

- Group messages by time
- Highlight peaks

TASK 13: Replay Mode

- Play messages sequentially
- Add controls (play/pause/speed)

---

PHASE 7 — MESSAGE VALUE FEATURES

TASK 14: Pin/Bookmark

- Add pinned field
- Create pinned view

TASK 15: Tagging

- Add tags (important, meeting)
- AI-assisted tagging

---

PHASE 8 — MEDIA

TASK 16: File Upload

- Use Firebase Storage
- Store metadata

TASK 17: Media Preview

- Image/video preview
- Download button

---

PHASE 9 — UX POLISH

TASK 18: Empty States

- Add illustration + CTA

TASK 19: Micro Interactions

- Add animations (Framer Motion)

TASK 20: Mobile UX

- Swipe gestures
- Bottom sheets
- Sticky input

---

PHASE 10 — SECURITY

TASK 21: Encryption Upgrade

- Replace CryptoJS with Web Crypto API

TASK 22: API Security

- Move AI calls to serverless endpoint

TASK 23: Firestore Rules

- Add role + room validation

---

PHASE 11 — PERFORMANCE

TASK 24: Optimize Rendering

- Memoize components
- Reduce re-renders

TASK 25: Lazy Loading

- AI panel
- analytics

---

PHASE 12 — PRODUCTIZATION

TASK 26: Export

- Export chat (PDF/image)

TASK 27: Notifications

- Browser notifications
- Toast UI

TASK 28: Metrics

- Track usage + sessions

---

## DELIVERABLE FORMAT (FOR EACH TASK)

1. Implementation summary
2. Files modified/created
3. Code snippets (only changed parts)
4. Risk checks (against non-negotiables)
5. Validation steps

---

## FINAL GOAL

Build a product that is:

- Useful in real-world scenarios
- AI-first experience
- Scalable and secure
- Premium UI/UX
- Market-ready

---

Work step-by-step, not all at once.
Keep code clean, modular, and production-ready.
