/**
 * worker/processors/aiSummary.js — AI summary job processor
 * ----------------------------------------------------------
 * Triggered by: POST /api/jobs/enqueue  { job: 'ai-summary', payload: { roomId } }
 *
 * Steps:
 *   1. Fetch the 200 most recent non-deleted messages from PostgreSQL
 *   2. Build a transcript and call the AI provider chain (OpenAI → Gemini)
 *   3. Upsert the summary into ai_insights with a 24-hour expiry
 *
 * The processor is intentionally stateless — safe to retry on failure.
 */

import { neon } from '@neondatabase/serverless';

const DEFAULT_TIMEOUT_MS = 25_000;
const MAX_MESSAGES       = 200;

function getSql() {
    const url = process.env.DATABASE_URL;
    if (!url) throw new Error('DATABASE_URL is not set.');
    return neon(url);
}

async function fetchWithTimeout(url, options = {}, ms = DEFAULT_TIMEOUT_MS) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), ms);
    try {
        return await fetch(url, { ...options, signal: controller.signal });
    } finally {
        clearTimeout(timer);
    }
}

async function callOpenAI(prompt) {
    const key = process.env.OPENAI_API_KEY;
    if (!key) return null;

    const res = await fetchWithTimeout('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${key}` },
        body: JSON.stringify({
            model:       process.env.OPENAI_MODEL || 'gpt-4o-mini',
            temperature: 0.3,
            messages: [
                { role: 'system', content: 'You are BeyondStrings AI. Summarize conversations concisely and accurately.' },
                { role: 'user',   content: prompt },
            ],
        }),
    });

    if (!res.ok) return null;
    const data = await res.json();
    return data?.choices?.[0]?.message?.content?.trim() || null;
}

async function callGemini(prompt) {
    const key   = process.env.GEMINI_API_KEY;
    const model = process.env.GEMINI_MODEL || 'gemini-1.5-flash';
    if (!key) return null;

    const res = await fetchWithTimeout(
        `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${key}`,
        {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                generationConfig: { temperature: 0.3 },
                contents: [{ role: 'user', parts: [{ text: prompt }] }],
            }),
        }
    );

    if (!res.ok) return null;
    const data = await res.json();
    return data?.candidates?.[0]?.content?.parts?.map((p) => p.text).join('\n').trim() || null;
}

/**
 * BullMQ job processor.
 * @param {import('bullmq').Job} job
 */
export async function aiSummaryProcessor(job) {
    const { roomId } = job.data;
    if (!roomId) throw new Error('roomId is required in job payload.');

    const sql = getSql();

    const messages = await sql`
        SELECT sender_name, content, sent_at
        FROM   messages
        WHERE  room_id = ${roomId}
          AND  deleted  = false
          AND  content  IS NOT NULL
        ORDER  BY sent_at DESC
        LIMIT  ${MAX_MESSAGES}
    `;

    if (!messages.length) {
        return { skipped: true, reason: 'no messages found' };
    }

    // Reverse to chronological order for the transcript
    const transcript = messages
        .reverse()
        .map((m) => `${m.sender_name}: ${m.content}`)
        .join('\n');

    const prompt =
        `Summarize the following chat conversation in 3–5 bullet points.\n` +
        `Focus on key topics, decisions, and action items. Be concise.\n\n` +
        `--- TRANSCRIPT ---\n${transcript}\n--- END ---`;

    const summary = (await callOpenAI(prompt)) ?? (await callGemini(prompt));
    if (!summary) {
        throw new Error('All AI providers returned empty responses.');
    }

    await sql`
        INSERT INTO ai_insights (room_id, type, content, provider, generated_at, expires_at)
        VALUES (
            ${roomId},
            'summary',
            ${summary},
            'openai',
            NOW(),
            NOW() + INTERVAL '24 hours'
        )
    `;

    return { roomId, summaryLength: summary.length };
}
