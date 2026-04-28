-- =============================================================================
-- BeyondStrings — PostgreSQL Schema
-- Compatible with: Neon (serverless), Supabase
-- =============================================================================
-- Run once against an empty database.
-- Safe to re-run: all statements use IF NOT EXISTS / ON CONFLICT.
-- =============================================================================

-- Required extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";  -- uuid_generate_v4()
CREATE EXTENSION IF NOT EXISTS "pg_trgm";   -- trigram indexes for fuzzy search
-- Uncomment for vector/semantic search (available on Neon & Supabase):
-- CREATE EXTENSION IF NOT EXISTS "vector";

-- =============================================================================
-- USERS
-- Mirrors Firebase Auth. Populated on first login via /api/auth/session.
-- =============================================================================
CREATE TABLE IF NOT EXISTS users (
    id           UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
    firebase_uid TEXT        UNIQUE NOT NULL,
    email        TEXT        NOT NULL,
    username     TEXT,
    role         TEXT        NOT NULL DEFAULT 'user'
                                 CHECK (role IN ('admin', 'moderator', 'premium', 'user')),
    plan         TEXT        NOT NULL DEFAULT 'free'
                                 CHECK (plan IN ('free', 'pro', 'enterprise')),
    created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS users_firebase_uid_idx ON users (firebase_uid);
CREATE INDEX IF NOT EXISTS users_email_idx        ON users (email);

-- Auto-update updated_at
CREATE OR REPLACE FUNCTION touch_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = NOW(); RETURN NEW; END;
$$;

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'users_updated_at') THEN
        CREATE TRIGGER users_updated_at
        BEFORE UPDATE ON users
        FOR EACH ROW EXECUTE FUNCTION touch_updated_at();
    END IF;
END $$;

-- =============================================================================
-- ROOMS
-- Denormalized chat room record. Primary source of truth is Firestore;
-- this table powers analytics, search, and exports.
-- =============================================================================
CREATE TABLE IF NOT EXISTS rooms (
    id             TEXT        PRIMARY KEY,  -- matches Firestore document ID
    name           TEXT        NOT NULL,
    type           TEXT        NOT NULL DEFAULT 'direct'
                                   CHECK (type IN ('direct', 'group', 'imported')),
    owner_uid      TEXT        NOT NULL,
    created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    last_activity  TIMESTAMPTZ,
    message_count  INT         NOT NULL DEFAULT 0,
    archived       BOOLEAN     NOT NULL DEFAULT FALSE
);

CREATE INDEX IF NOT EXISTS rooms_owner_uid_idx    ON rooms (owner_uid);
CREATE INDEX IF NOT EXISTS rooms_last_activity_idx ON rooms (last_activity DESC NULLS LAST);

-- =============================================================================
-- ROOM MEMBERS
-- =============================================================================
CREATE TABLE IF NOT EXISTS room_members (
    room_id   TEXT        NOT NULL REFERENCES rooms(id) ON DELETE CASCADE,
    user_uid  TEXT        NOT NULL,
    role      TEXT        NOT NULL DEFAULT 'member'
                              CHECK (role IN ('owner', 'admin', 'member')),
    joined_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (room_id, user_uid)
);

CREATE INDEX IF NOT EXISTS room_members_user_uid_idx ON room_members (user_uid);

-- =============================================================================
-- MESSAGES
-- Written by the dual-write path (Firestore → PostgreSQL via worker).
-- content is stored decrypted for indexing; encryption happens at Firestore.
-- message_length is a generated column to avoid recomputing in queries.
-- search_vector is automatically maintained for full-text search.
-- =============================================================================
CREATE TABLE IF NOT EXISTS messages (
    id             TEXT        PRIMARY KEY,  -- matches Firestore document ID
    room_id        TEXT        NOT NULL REFERENCES rooms(id) ON DELETE CASCADE,
    sender_uid     TEXT        NOT NULL,
    sender_name    TEXT        NOT NULL,
    content        TEXT,
    type           TEXT        NOT NULL DEFAULT 'text'
                                   CHECK (type IN ('text', 'image', 'file', 'audio', 'system')),
    message_length INT         GENERATED ALWAYS AS (CHAR_LENGTH(COALESCE(content, ''))) STORED,
    sent_at        TIMESTAMPTZ NOT NULL,
    deleted        BOOLEAN     NOT NULL DEFAULT FALSE,
    -- Full-text index maintained automatically
    search_vector  TSVECTOR    GENERATED ALWAYS AS (
                                   to_tsvector('english', COALESCE(content, ''))
                               ) STORED,
    created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Full-text search (GIN on tsvector)
CREATE INDEX IF NOT EXISTS messages_search_vector_idx    ON messages USING GIN (search_vector);
-- Time-range / pagination queries
CREATE INDEX IF NOT EXISTS messages_room_sent_at_idx     ON messages (room_id, sent_at DESC);
-- Sender-scoped queries
CREATE INDEX IF NOT EXISTS messages_sender_uid_idx       ON messages (sender_uid);
-- Trigram fuzzy search for short queries
CREATE INDEX IF NOT EXISTS messages_content_trgm_idx     ON messages USING GIN (content gin_trgm_ops);
-- Soft-delete filter
CREATE INDEX IF NOT EXISTS messages_room_deleted_idx     ON messages (room_id, deleted, sent_at DESC);

-- =============================================================================
-- MESSAGE EMBEDDINGS  (vector semantic search — optional)
-- Requires pgvector extension. Uncomment when ready to enable.
-- =============================================================================
-- CREATE TABLE IF NOT EXISTS message_embeddings (
--     message_id TEXT        PRIMARY KEY REFERENCES messages(id) ON DELETE CASCADE,
--     embedding  VECTOR(1536),      -- OpenAI text-embedding-3-small dimension
--     model      TEXT        NOT NULL DEFAULT 'text-embedding-3-small',
--     created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
-- );
--
-- -- IVFFlat approximate nearest-neighbour index (tune `lists` for dataset size)
-- CREATE INDEX IF NOT EXISTS message_embeddings_ivfflat_idx
--     ON message_embeddings USING ivfflat (embedding vector_cosine_ops)
--     WITH (lists = 100);

-- =============================================================================
-- ANALYTICS DAILY ROLLUP
-- Pre-aggregated by the `analytics-rollup` worker job. Powers dashboards
-- without re-scanning the messages table on every page load.
-- =============================================================================
CREATE TABLE IF NOT EXISTS analytics_daily (
    id                UUID  PRIMARY KEY DEFAULT uuid_generate_v4(),
    room_id           TEXT  NOT NULL,
    date              DATE  NOT NULL,
    message_count     INT   NOT NULL DEFAULT 0,
    participant_count INT   NOT NULL DEFAULT 0,
    avg_length        FLOAT,
    top_sender_uid    TEXT,
    created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (room_id, date)
);

CREATE INDEX IF NOT EXISTS analytics_daily_room_date_idx ON analytics_daily (room_id, date DESC);

-- =============================================================================
-- AI INSIGHTS
-- Stores generated summaries, sentiment analysis, topic extraction, etc.
-- expires_at allows stale insights to be garbage-collected by the cleanup job.
-- =============================================================================
CREATE TABLE IF NOT EXISTS ai_insights (
    id           UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
    room_id      TEXT        NOT NULL,
    type         TEXT        NOT NULL
                                 CHECK (type IN ('summary', 'sentiment', 'topics', 'activity')),
    content      TEXT        NOT NULL,
    provider     TEXT        NOT NULL DEFAULT 'openai',
    version      INT         NOT NULL DEFAULT 1,
    generated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    expires_at   TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS ai_insights_room_type_idx ON ai_insights (room_id, type, generated_at DESC);
CREATE INDEX IF NOT EXISTS ai_insights_expires_idx   ON ai_insights (expires_at) WHERE expires_at IS NOT NULL;

-- =============================================================================
-- JOB AUDIT LOG
-- Immutable append-only log of every job triggered via /api/jobs/enqueue.
-- Cleaned up by the `cleanup` worker job after AUDIT_LOG_RETENTION_DAYS.
-- =============================================================================
CREATE TABLE IF NOT EXISTS job_audit (
    id           UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
    job          TEXT        NOT NULL,
    payload      JSONB,
    triggered_by TEXT,
    status       TEXT        NOT NULL DEFAULT 'pending'
                                 CHECK (status IN ('pending', 'running', 'done', 'failed')),
    started_at   TIMESTAMPTZ,
    finished_at  TIMESTAMPTZ,
    error        TEXT,
    created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS job_audit_job_status_idx   ON job_audit (job, status, created_at DESC);
CREATE INDEX IF NOT EXISTS job_audit_triggered_by_idx ON job_audit (triggered_by, created_at DESC);

-- =============================================================================
-- NOTIFICATIONS
-- Device token registry + user preferences for push/foreground notifications.
-- =============================================================================
CREATE TABLE IF NOT EXISTS notification_preferences (
    firebase_uid   TEXT        PRIMARY KEY REFERENCES users(firebase_uid) ON DELETE CASCADE,
    message_alerts BOOLEAN     NOT NULL DEFAULT TRUE,
    mention_alerts BOOLEAN     NOT NULL DEFAULT TRUE,
    insight_alerts BOOLEAN     NOT NULL DEFAULT TRUE,
    push_enabled   BOOLEAN     NOT NULL DEFAULT TRUE,
    created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'notification_preferences_updated_at') THEN
        CREATE TRIGGER notification_preferences_updated_at
        BEFORE UPDATE ON notification_preferences
        FOR EACH ROW EXECUTE FUNCTION touch_updated_at();
    END IF;
END $$;

CREATE TABLE IF NOT EXISTS notification_devices (
    id           UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
    firebase_uid TEXT        NOT NULL REFERENCES users(firebase_uid) ON DELETE CASCADE,
    device_token TEXT        NOT NULL UNIQUE,
    platform     TEXT        NOT NULL DEFAULT 'web',
    user_agent   TEXT,
    is_active    BOOLEAN     NOT NULL DEFAULT TRUE,
    last_seen_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'notification_devices_updated_at') THEN
        CREATE TRIGGER notification_devices_updated_at
        BEFORE UPDATE ON notification_devices
        FOR EACH ROW EXECUTE FUNCTION touch_updated_at();
    END IF;
END $$;

CREATE INDEX IF NOT EXISTS notification_devices_user_idx   ON notification_devices (firebase_uid, is_active, last_seen_at DESC);
CREATE INDEX IF NOT EXISTS notification_devices_token_idx  ON notification_devices (device_token);
