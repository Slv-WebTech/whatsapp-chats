# Firestore Schema Migration — Rollback Plan

## Overview

The migration uses dual-write throughout the entire migration window.  
The `chats/` collection is **never modified or deleted** until Phase 6 (`--cleanup`) is manually triggered after full validation.  
This means a rollback at any phase is a zero-risk, zero-downtime operation.

---

## Rollback by Phase

### Phase 1 — Skeleton created, no data moved yet

**Action:** Delete the empty `rooms/`, `insights/`, `analytics/` collections.

```bash
# Delete all migrated rooms/ docs (only those with _migratedFromChats: true)
node scripts/migrate-to-rooms.js --rollback
```

**Risk:** None. No user data affected.

---

### Phase 2 — Dual-write active

**Action:** Revert the chatService.js change to stop dual-writing.

```bash
git revert HEAD   # or restore the previous sendRoomMessage implementation
```

Then delete the rooms/ data written so far:

```bash
node scripts/migrate-to-rooms.js --rollback
```

**Risk:** None. The `chats/` collection has all canonical data.  
Messages written only to `rooms/` during the dual-write window (before rollback) are orphaned — but since `chats/` was always written first in the same batch, the user-visible chat history is intact.

---

### Phase 3 — Backfill running or complete

**Action:** Stop the backfill process (Ctrl+C), then roll back rooms/:

```bash
node scripts/migrate-to-rooms.js --rollback
```

Re-run the backfill after fixing any issues:

```bash
node scripts/migrate-to-rooms.js
```

The backfill is **idempotent** — rooms with `_migratedFromChats: true` that already have messages are skipped automatically.

**Risk:** None. `chats/` is untouched.

---

### Phase 4 — Validation running

No data changes occur during validation. No rollback needed.

---

### Phase 5 — Read path switched to rooms/

**Action:** Set `READ_FROM_ROOMS = false` in `src/services/firebase/migrationFlags.js` and deploy.

```js
// src/services/firebase/migrationFlags.js
export const READ_FROM_ROOMS = false; // ← flip back to false
```

Deploy immediately. Dual-write is still active so `chats/` remains current.

**Risk:** Low. The app falls back to the fully intact `chats/` collection.  
Any reactions, read-receipts, or deliveredTo updates written to `rooms/` only during Phase 5 will be out of sync — but these are non-critical fields.

---

### Phase 6 — Cleanup (chats/ being deleted)

⚠️ **This is the only phase where rollback requires a Firestore backup restore.**

**If cleanup has NOT finished:**  
Stop the script immediately. Both schemas have data.

```bash
# Verify what's left in chats/
node scripts/validate-migration.js

# If chats/ is still intact, simply set READ_FROM_ROOMS = false and deploy
```

**If cleanup HAS finished (chats/ is gone):**  
Restore from Firestore Managed Export backup.

```bash
# 1. Identify the export taken before Phase 6
gcloud firestore export gs://YOUR_BUCKET/backups/pre-cleanup-YYYY-MM-DD

# 2. Import only the chats/ collection
gcloud firestore import gs://YOUR_BUCKET/backups/pre-cleanup-YYYY-MM-DD \
  --collection-ids=chats,user_chats

# 3. Set READ_FROM_ROOMS = false and deploy
```

**MANDATORY prerequisite:** Always run `gcloud firestore export` before executing `--cleanup`.

---

## Pre-Migration Checklist (run before starting)

- [ ] Firestore Managed Export taken and verified restorable
- [ ] `validate-migration.js` dry-run passes on a test project
- [ ] Dual-write deployed and confirmed in production logs
- [ ] Monitoring/alerting set on `chats/` and `rooms/` write counts

## Rollback Decision Tree

```
Symptom: Users report missing messages
       ↓
Is READ_FROM_ROOMS = true?
  YES → Set false, deploy → verify chats/ still intact
  NO  → Dual-write is in sync; check chatService logs
       ↓
Is chats/ collection empty? (Phase 6 ran)
  YES → Restore from Firestore export backup
  NO  → chats/ is safe; flip flag and deploy
```

## Key Safety Properties

| Property                                   | Guarantee                                                  |
| ------------------------------------------ | ---------------------------------------------------------- |
| `chats/` never written to during migration | ✅ Dual-write appends to rooms/ only                       |
| Batch writes atomic                        | ✅ Both old + new writes are in the same `writeBatch`      |
| Backfill is idempotent                     | ✅ Existing `_migratedFromChats` rooms are skipped         |
| clientId preserved                         | ✅ Same doc ID used in both collections                    |
| Encrypted text never touched               | ✅ `text` field copied verbatim                            |
| Cleanup gated behind validation            | ✅ `--cleanup` runs validation first and aborts on failure |
| Rollback script targets only migrated docs | ✅ Checks `_migratedFromChats: true` before deleting       |
