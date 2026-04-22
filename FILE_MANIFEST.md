# File Manifest

This manifest reflects the current documentation and architecture after the App refactor.

## Documentation Files

- README.md
- QUICK_START_GUIDE.md
- GITHUB_DEPLOYMENT.md
- AI_FEATURES_TESTING.md
- EDGE_CASE_IMPROVEMENTS.md
- ROBUSTNESS_IMPLEMENTATION.md
- IMPLEMENTATION_COMPLETE.md
- PROJECT_COMPLETION.md
- FILE_MANIFEST.md

## Key Application Files

- src/App.js
  - Thin wrapper that delegates to runtime hook.
- src/hooks/useLegacyChatRuntime.js
  - Main chat runtime (state orchestration, effects, handlers).
- src/features/chat/appRuntimeHelpers.js
  - Pure helper functions/constants extracted from App runtime.
- src/RootApp.js
  - Router shell, auth gate, and route-level lazy loading.
- src/pages/Chat.js
  - Bridge between route context and legacy chat runtime.
- src/components/*
  - UI components and reusable interaction primitives.

## Build and Bundling

- Vite manual chunking is configured in vite.config.js for heavy vendor groups.
- Route-level lazy loading is active for Home, Chat, Admin, Profile, and ImportedChat pages.

## Oversized File Check

- Component files are below 1000 lines.
- Runtime hook currently holds the largest code path by design.
