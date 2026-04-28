# Firestore Field Mapping: current chats schema -> new rooms schema

## Scope

This table maps the current live Firestore model used in the app (chats + user_chats + nested messages/typing/presence/join_requests) to the proposed production model (rooms + members + messages + receipts + reactions + userRooms + insights + analytics + dedupe).

## Current -> Target collection mapping

| Current collection/path             | Target collection/path                                                         | Notes                                                     |
| ----------------------------------- | ------------------------------------------------------------------------------ | --------------------------------------------------------- |
| chats/{chatId}                      | rooms/{roomId}                                                                 | chatId becomes roomId                                     |
| chats/{chatId}/messages/{messageId} | rooms/{roomId}/messages/{messageId}                                            | preserve messageId                                        |
| chats/{chatId}/typing/{uid}         | rooms/{roomId}/typing/{uid}                                                    | same semantic                                             |
| chats/{chatId}/presence/{uid}       | presence/{uid} and/or rooms/{roomId}/members/{uid}                             | room presence becomes global presence + member read state |
| chats/{chatId}/join_requests/{uid}  | rooms/{roomId}/events/{eventId} or dedicated joinRequests if retained          | optional in new design                                    |
| user_chats/{uid}                    | userRooms/{uid_roomId}                                                         | materialized per-room sidebar row                         |
| users/{uid}                         | users/{uid}                                                                    | mostly retained                                           |
| admin_stats/global                  | rooms/{roomId}/analyticsDaily + analyticsHourly + platform analytics namespace | denormalize by room/time                                  |

## Chat room document field-by-field

| Current path + field                           | Target path + field                                           | Transform                                                                    |
| ---------------------------------------------- | ------------------------------------------------------------- | ---------------------------------------------------------------------------- |
| chats/{chatId}.type (values: 1:1/group/shared) | rooms/{roomId}.type (direct/group)                            | map 1:1 -> direct, group -> group, shared -> group or separate shared policy |
| chats/{chatId}.name                            | rooms/{roomId}.name                                           | copy                                                                         |
| chats/{chatId}.createdBy                       | rooms/{roomId}.createdBy                                      | copy                                                                         |
| chats/{chatId}.ownerId                         | rooms/{roomId}.createdBy and members/{owner}.role=owner       | normalize ownership into members role                                        |
| chats/{chatId}.createdAt                       | rooms/{roomId}.createdAt                                      | copy                                                                         |
| chats/{chatId}.updatedAt                       | rooms/{roomId}.updatedAt                                      | copy                                                                         |
| chats/{chatId}.members (array)                 | rooms/{roomId}/members/{uid} docs                             | split array into member documents                                            |
| chats/{chatId}.memberUsernames map             | users/{uid}.username and/or cached userRooms.roomName context | source of truth should be users; optional cache                              |
| chats/{chatId}.memberRoles map                 | rooms/{roomId}/members/{uid}.role                             | split map                                                                    |
| chats/{chatId}.memberMeta.{uid}.lastReadAt     | rooms/{roomId}/members/{uid}.lastReadAt                       | split map                                                                    |
| chats/{chatId}.lastMessageText                 | rooms/{roomId}.lastMessage.textPreviewCipher                  | copy encrypted preview                                                       |
| chats/{chatId}.lastMessageAt                   | rooms/{roomId}.lastMessage.timestamp                          | copy                                                                         |
| chats/{chatId}.lastSenderId                    | rooms/{roomId}.lastMessage.senderId                           | copy                                                                         |
| chats/{chatId}.lastSenderName                  | userRooms cache only (optional)                               | avoid canonical sender name duplication                                      |
| chats/{chatId}.description                     | rooms/{roomId}.metadata.description                           | move under metadata                                                          |
| chats/{chatId}.photoUrl                        | rooms/{roomId}.metadata.avatar                                | move under metadata                                                          |
| chats/{chatId}.joinPolicy                      | rooms/{roomId}.metadata.joinPolicy (optional)                 | optional policy metadata                                                     |
| chats/{chatId}.approvalRequired                | rooms/{roomId}.metadata.approvalRequired (optional)           | optional policy metadata                                                     |
| chats/{chatId}.status                          | rooms/{roomId}.metadata.status                                | optional room lifecycle state                                                |

## Message document field-by-field

| Current path + field                            | Target path + field                                     | Transform                                                      |
| ----------------------------------------------- | ------------------------------------------------------- | -------------------------------------------------------------- |
| chats/{chatId}/messages/{id}.text               | rooms/{roomId}/messages/{id}.text                       | copy encrypted text                                            |
| chats/{chatId}/messages/{id}.uid                | rooms/{roomId}/messages/{id}.senderId                   | rename                                                         |
| chats/{chatId}/messages/{id}.sender             | users/{uid}.username or derived at read time            | drop plaintext sender cache where possible                     |
| chats/{chatId}/messages/{id}.senderEnc          | rooms/{roomId}/messages/{id}.senderEnc (optional)       | keep if still needed client-side                               |
| chats/{chatId}/messages/{id}.type               | rooms/{roomId}/messages/{id}.type                       | copy                                                           |
| chats/{chatId}/messages/{id}.clientId           | rooms/{roomId}/messages/{id}.clientId                   | preserve for offline dedupe                                    |
| chats/{chatId}/messages/{id}.createdAt          | rooms/{roomId}/messages/{id}.createdAt                  | copy                                                           |
| chats/{chatId}/messages/{id}.tags               | rooms/{roomId}/messages/{id}.ai.tags or metadata.tags   | optional relocation                                            |
| chats/{chatId}/messages/{id}.moderation         | rooms/{roomId}/messages/{id}.ai.moderation              | move under ai                                                  |
| chats/{chatId}/messages/{id}.encrypted          | rooms/{roomId}/messages/{id}.deleted + room.isEncrypted | room-level encryption canonical; keep boolean during migration |
| chats/{chatId}/messages/{id}.cipherVersion      | rooms/{roomId}/messages/{id}.metadata.cipherVersion     | move under metadata                                            |
| chats/{chatId}/messages/{id}.replyTo.\*         | rooms/{roomId}/messages/{id}.replyTo                    | collapse to messageId if possible                              |
| chats/{chatId}/messages/{id}.deletedForEveryone | rooms/{roomId}/messages/{id}.deleted                    | map boolean                                                    |
| chats/{chatId}/messages/{id}.deletedAt          | rooms/{roomId}/messages/{id}.deletedAt                  | copy                                                           |
| chats/{chatId}/messages/{id}.deletedFor.{uid}   | rooms/{roomId}/messages/{id}.deletedFor map/list        | preserve semantics                                             |

## Delivery/read and reactions normalization

| Current path + field                                | Target path + field                                            | Transform                                  |
| --------------------------------------------------- | -------------------------------------------------------------- | ------------------------------------------ |
| messages/{id}.deliveredTo map                       | messages/{id}/receipts/{uid}.deliveredAt                       | split map into per-user docs               |
| messages/{id}.readBy map                            | messages/{id}/receipts/{uid}.seenAt                            | split map into per-user docs               |
| messages/{id}.deliveredAt/readAt                    | receipts timestamps                                            | per-user authoritative timestamps          |
| messages/{id}.reactions.{emoji}=arrayUnion(uid)     | messages/{id}/reactions/{emoji}.users map or subcollection     | avoid unbounded arrays in root message doc |
| messages/{id}.reactions.{emoji}=increment(1) legacy | messages/{id}/reactions/{emoji}.count                          | keep count alongside users                 |
| messages/{id}.pinned / pinnedAt                     | optional messages/{id}.ai.important or room-level pinned index | choose one product behavior                |
| messages/{id}.bookmarkedBy                          | userRooms + per-user bookmark collection (optional)            | avoid large growing arrays                 |

## Typing and presence

| Current path + field                               | Target path + field                   | Transform                                 |
| -------------------------------------------------- | ------------------------------------- | ----------------------------------------- |
| chats/{chatId}/typing/{uid}.isTyping               | rooms/{roomId}/typing/{uid}.isTyping  | copy                                      |
| chats/{chatId}/typing/{uid}.updatedAt              | rooms/{roomId}/typing/{uid}.updatedAt | copy                                      |
| chats/{chatId}/presence/{uid}.online               | presence/{uid}.status                 | map boolean -> enum                       |
| chats/{chatId}/presence/{uid}.lastSeen             | presence/{uid}.lastSeen               | copy                                      |
| chats/{chatId}/presence/{uid}.encryptedDisplayName | users/{uid}.username (canonical)      | avoid room-level display name duplication |

## User and membership side projections

| Current path + field       | Target path + field                            | Transform                         |
| -------------------------- | ---------------------------------------------- | --------------------------------- |
| user_chats/{uid}.chatIds[] | userRooms/{uid_roomId} docs                    | explode array to one doc per room |
| users/{uid}.username       | users/{uid}.username                           | copy                              |
| users/{uid}.usernameKey    | users/{uid}.usernameKey                        | copy                              |
| users/{uid}.role           | users/{uid}.role                               | copy                              |
| users/{uid}.lastSeenAt     | users/{uid}.lastSeen + presence/{uid}.lastSeen | maintain both if needed           |

## New target-only fields introduced

| Target field                         | Why                                              |
| ------------------------------------ | ------------------------------------------------ |
| rooms/{roomId}.memberCount           | fast room-card rendering without member scan     |
| rooms/{roomId}.lastMessage.messageId | stable anchor for UI and pagination              |
| rooms/{roomId}/messages/{id}.roomId  | enables collectionGroup queries with room filter |
| rooms/{roomId}/dedupe/{clientId}     | idempotent writes compatible with offline queue  |
| rooms/{roomId}/insights/\*           | AI outputs separated from message stream         |
| rooms/{roomId}/analyticsDaily/\*     | scalable time-bucketed analytics                 |
| userRooms/\*                         | efficient inbox/sidebar queries                  |

## Migration sequence recommendations

1. Dual-write new messages to old and new paths, preserving messageId and clientId.
2. Backfill rooms and members from chats + member maps.
3. Backfill messages then transform receipts/reactions into subcollections.
4. Build userRooms from room membership and last activity.
5. Switch reads behind feature flag to new rooms model.
6. Keep legacy collections read-only during burn-in, then archive.

## Non-negotiable compatibility checks

- Encryption remains ciphertext end-to-end; no plaintext server transforms.
- Imported chats remain outside live Firestore room/message namespace.
- Offline queue continues to rely on clientId and dedupe protection.
- Existing messageId/clientId dedupe behavior remains intact.
