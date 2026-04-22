# Edge Case Improvements

This document tracks practical edge-case hardening currently in the project.

## Parsing and Input Safety

- Validation guards for malformed chat lines
- Defensive date/time parsing fallbacks
- Safe handling for empty/invalid imported content

## Chat Runtime Safety

- Resilient message mapping for partial Firestore docs
- Defensive handling for deleted/hidden messages
- Safe reply/delete flows with sender checks

## Presence and Typing

- Stale typing windows are ignored
- Presence timestamps are normalized defensively

## UI Interaction Safety

- Message action handling supports click/long-press/context menu
- Scroll/virtualization behavior tuned for large message sets
- Admin list rendering stabilized with resilient keys and counts

## Offline and Recovery

- Offline queue persists and retries
- Recoverable send errors fall back cleanly

## Recommended Ongoing Work

- Add focused unit tests for mapper helpers
- Add automated regression suite for delete/reply workflows
- Add CI smoke tests for chat route and imported route
