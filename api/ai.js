import { verifyFirebaseToken } from './_lib/firebaseAdmin.js';

const DEFAULT_TIMEOUT_MS = 18000;
const MAX_MESSAGES = Number(process.env.AI_GATEWAY_MAX_MESSAGES || 200);
const MAX_MESSAGE_CHARS = Number(process.env.AI_GATEWAY_MAX_MESSAGE_CHARS || 1000);
const MAX_QUERY_CHARS = Number(process.env.AI_GATEWAY_MAX_QUERY_CHARS || 800);
const MAX_TOTAL_CHARS = Number(process.env.AI_GATEWAY_MAX_TOTAL_CHARS || 32000);
const RATE_WINDOW_MS = Number(process.env.AI_GATEWAY_RATE_WINDOW_MS || 60000);
const RATE_LIMIT_PER_WINDOW = Number(process.env.AI_GATEWAY_RATE_LIMIT || 30);

const rateLimiter = new Map();

function json(res, status, payload) {
    res.status(status).setHeader('Content-Type', 'application/json').send(JSON.stringify(payload));
}

function sanitizeText(value, max = 2000) {
    return String(value || '').replace(/\s+/g, ' ').trim().slice(0, max);
}

function sanitizeMessage(entry, index) {
    if (!entry || typeof entry !== 'object') {
        return null;
    }

    const text = sanitizeText(entry.message || entry.text || '', MAX_MESSAGE_CHARS);
    if (!text) {
        return null;
    }

    return {
        id: sanitizeText(entry.id || `m-${index}`, 80),
        sender: sanitizeText(entry.sender || 'User', 40),
        text,
        date: sanitizeText(entry.date || '', 24),
        time: sanitizeText(entry.time || '', 24)
    };
}

function normalizeBody(body = {}) {
    const task = sanitizeText(body.task, 24).toLowerCase();

    let messages = Array.isArray(body.messages) ? body.messages : [];
    let query = sanitizeText(body.query || '', MAX_QUERY_CHARS);

    // Backward-compatible fallback for older clients still sending payload
    if (!messages.length && body.payload && typeof body.payload === 'object') {
        if (typeof body.payload.transcript === 'string') {
            messages = body.payload.transcript
                .split('\n')
                .slice(-MAX_MESSAGES)
                .map((line, index) => ({ id: `legacy-${index}`, sender: 'User', text: sanitizeText(line, MAX_MESSAGE_CHARS) }))
                .filter((entry) => entry.text);
        }

        if (!query) {
            query = sanitizeText(
                body.payload.query || body.payload.command || body.payload.currentUser || body.payload.mode || '',
                MAX_QUERY_CHARS
            );
        }
    }

    const sanitizedMessages = messages
        .slice(-MAX_MESSAGES)
        .map((entry, index) => sanitizeMessage(entry, index))
        .filter(Boolean);

    return { task, messages: sanitizedMessages, query };
}

function validateInput(task, messages, query) {
    const allowed = new Set(['summary', 'search', 'reply', 'insights']);
    if (!allowed.has(task)) {
        return 'Unsupported task.';
    }

    if (!Array.isArray(messages)) {
        return 'Messages must be an array.';
    }

    if (messages.length > MAX_MESSAGES) {
        return 'Too many messages.';
    }

    const totalChars = messages.reduce((acc, item) => acc + String(item?.text || '').length, 0) + String(query || '').length;
    if (totalChars > MAX_TOTAL_CHARS) {
        return 'Input too large.';
    }

    if (query && query.length > MAX_QUERY_CHARS) {
        return 'Query too long.';
    }

    return '';
}

function extractBearerToken(req) {
    const authHeader = String(req.headers?.authorization || req.headers?.Authorization || '').trim();
    if (!/^Bearer\s+/i.test(authHeader)) {
        return '';
    }

    return authHeader.replace(/^Bearer\s+/i, '').trim();
}

function getRequesterIp(req) {
    const forwarded = String(req.headers?.['x-forwarded-for'] || '').split(',')[0].trim();
    if (forwarded) {
        return forwarded;
    }

    return String(req.socket?.remoteAddress || 'unknown').trim() || 'unknown';
}

function checkRateLimit(identityKey) {
    const now = Date.now();
    const existing = rateLimiter.get(identityKey);

    if (!existing || existing.resetAt <= now) {
        rateLimiter.set(identityKey, { count: 1, resetAt: now + RATE_WINDOW_MS });
        return true;
    }

    if (existing.count >= RATE_LIMIT_PER_WINDOW) {
        return false;
    }

    existing.count += 1;
    return true;
}

function buildTranscript(messages, max = MAX_MESSAGES) {
    return (messages || [])
        .slice(-max)
        .map((entry) => `${entry.date} ${entry.time} ${entry.sender}: ${entry.text}`.trim())
        .filter(Boolean)
        .join('\n');
}

async function fetchWithTimeout(url, options = {}, timeoutMs = DEFAULT_TIMEOUT_MS) {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

    try {
        return await fetch(url, {
            ...options,
            signal: controller.signal
        });
    } finally {
        clearTimeout(timeoutId);
    }
}

function parseSuggestionLines(text) {
    return String(text || '')
        .split(/\n+/)
        .map((line) => line.replace(/^[-*\d.\s]+/, '').trim())
        .filter(Boolean)
        .slice(0, 3);
}

function tokenize(value) {
    return sanitizeText(value, 2400)
        .toLowerCase()
        .split(/[^a-z0-9]+/)
        .map((item) => item.trim())
        .filter((item) => item.length > 2);
}

function cosineSimilarity(left, right) {
    const leftMap = new Map();
    const rightMap = new Map();

    left.forEach((token) => leftMap.set(token, (leftMap.get(token) || 0) + 1));
    right.forEach((token) => rightMap.set(token, (rightMap.get(token) || 0) + 1));

    let dot = 0;
    let leftNorm = 0;
    let rightNorm = 0;

    leftMap.forEach((count, key) => {
        dot += count * (rightMap.get(key) || 0);
        leftNorm += count * count;
    });

    rightMap.forEach((count) => {
        rightNorm += count * count;
    });

    if (!leftNorm || !rightNorm) {
        return 0;
    }

    return dot / (Math.sqrt(leftNorm) * Math.sqrt(rightNorm));
}

function localSearch(messages, query, limit = 6) {
    const qTokens = tokenize(query);

    return messages
        .map((message) => ({
            message,
            score: cosineSimilarity(qTokens, tokenize(message.text))
        }))
        .sort((a, b) => b.score - a.score)
        .slice(0, limit)
        .map((entry) => entry.message);
}

function localSummary(messages) {
    const participants = Array.from(new Set(messages.map((entry) => entry.sender).filter(Boolean)));
    const highlights = messages.slice(-6).map((entry) => `- ${sanitizeText(entry.sender, 28)}: ${sanitizeText(entry.text, 160)}`);

    return [
        `Messages analyzed: ${messages.length}`,
        `Participants: ${participants.join(', ') || 'Unknown'}`,
        'Recent highlights:',
        ...(highlights.length ? highlights : ['- No recent highlights.'])
    ].join('\n');
}

async function generateWithOpenAI(prompt) {
    const apiKey = String(process.env.OPENAI_API_KEY || '').trim();
    if (!apiKey) {
        return '';
    }

    const response = await fetchWithTimeout(
        'https://api.openai.com/v1/chat/completions',
        {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${apiKey}`
            },
            body: JSON.stringify({
                model: process.env.OPENAI_MODEL || 'gpt-4o-mini',
                temperature: 0.2,
                messages: [
                    {
                        role: 'system',
                        content: 'You are Lensiq AI. Be concise, safe, and practical.'
                    },
                    {
                        role: 'user',
                        content: prompt
                    }
                ]
            })
        },
        22000
    );

    if (!response.ok) {
        return '';
    }

    const data = await response.json();
    return sanitizeText(data?.choices?.[0]?.message?.content || '', 12000);
}

async function generateWithGemini(prompt) {
    const apiKey = String(process.env.GEMINI_API_KEY || '').trim();
    if (!apiKey) {
        return '';
    }

    const model = process.env.GEMINI_MODEL || 'gemini-1.5-flash';
    const response = await fetchWithTimeout(
        `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`,
        {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                generationConfig: {
                    temperature: 0.2
                },
                contents: [
                    {
                        role: 'user',
                        parts: [{ text: prompt }]
                    }
                ]
            })
        },
        22000
    );

    if (!response.ok) {
        return '';
    }

    const data = await response.json();
    const parts = data?.candidates?.[0]?.content?.parts || [];
    return sanitizeText(parts.map((item) => item?.text || '').join('\n'), 12000);
}

async function generateWithOllama(prompt) {
    const baseUrl = String(process.env.OLLAMA_BASE_URL || '').trim();
    if (!baseUrl) {
        return '';
    }

    const response = await fetchWithTimeout(
        `${baseUrl.replace(/\/$/, '')}/api/chat`,
        {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                model: process.env.OLLAMA_MODEL || 'llama3.2:3b',
                stream: false,
                messages: [{ role: 'user', content: prompt }]
            })
        },
        15000
    );

    if (!response.ok) {
        return '';
    }

    const data = await response.json();
    return sanitizeText(data?.message?.content || '', 12000);
}

async function runProviderPipeline(prompt) {
    const openAi = await generateWithOpenAI(prompt);
    if (openAi) {
        return { provider: 'openai', text: openAi };
    }

    const gemini = await generateWithGemini(prompt);
    if (gemini) {
        return { provider: 'gemini', text: gemini };
    }

    const ollama = await generateWithOllama(prompt);
    if (ollama) {
        return { provider: 'ollama', text: ollama };
    }

    return { provider: 'local', text: '' };
}

function safeErrorMessage(status) {
    if (status === 400) {
        return 'Invalid request.';
    }

    if (status === 405) {
        return 'Method not allowed.';
    }

    if (status === 401) {
        return 'Unauthorized.';
    }

    if (status === 429) {
        return 'Too many requests.';
    }

    return 'Unable to process AI request right now.';
}

function sendSuccess(res, payload, provider) {
    const response = {
        success: true,
        data: {
            ...payload,
            provider
        },
        // legacy compatibility for existing frontend readers
        ok: true,
        provider,
        result: payload.result
    };

    json(res, 200, response);
}

function sendError(res, status) {
    json(res, status, {
        success: false,
        error: safeErrorMessage(status),
        ok: false
    });
}

async function handleSummary(messages) {
    const transcript = buildTranscript(messages, 180);
    if (!transcript) {
        return {
            provider: 'local',
            result: 'No messages available for summary.'
        };
    }

    const prompt = [
        'Summarize this chat in concise bullet points.',
        'Include key points, decisions, and action items where available.',
        'Transcript:',
        transcript
    ].join('\n\n');

    const pipeline = await runProviderPipeline(prompt);
    return {
        provider: pipeline.provider,
        result: pipeline.text || localSummary(messages)
    };
}

async function handleSearch(messages, query) {
    if (!query) {
        return {
            provider: 'local',
            result: {
                matches: []
            }
        };
    }

    const localMatches = localSearch(messages, query, 6);

    const transcript = buildTranscript(messages, 120);
    const prompt = [
        'Find the most relevant lines for this query in the transcript.',
        `Query: ${query}`,
        'Return a short relevance explanation only.',
        'Transcript:',
        transcript
    ].join('\n\n');

    const pipeline = await runProviderPipeline(prompt);

    return {
        provider: pipeline.provider,
        result: {
            matches: localMatches,
            explanation: pipeline.text || ''
        }
    };
}

async function handleReply(messages, query) {
    const transcript = buildTranscript(messages, 80);
    const prompt = [
        'Generate 3 short reply suggestions.',
        'Output one suggestion per line, max 90 characters each.',
        query ? `Context hint: ${query}` : '',
        'Transcript:',
        transcript
    ]
        .filter(Boolean)
        .join('\n\n');

    const pipeline = await runProviderPipeline(prompt);
    const suggestions = parseSuggestionLines(pipeline.text || '').slice(0, 3);

    return {
        provider: pipeline.provider,
        result: {
            suggestions: suggestions.length
                ? suggestions
                : ['Looks good.', 'Can you share a bit more detail?', 'Thanks, I am checking this now.']
        }
    };
}

async function handleInsights(messages, query) {
    const transcript = buildTranscript(messages, 120);
    const prompt = [
        'Provide practical insights from this conversation.',
        query ? `User query: ${query}` : 'Give general insights.',
        'Focus on risks, blockers, and recommended next actions.',
        'Transcript:',
        transcript
    ].join('\n\n');

    const pipeline = await runProviderPipeline(prompt);
    return {
        provider: pipeline.provider,
        result: pipeline.text || 'No additional insights available right now.'
    };
}

export default async function handler(req, res) {
    if (req.method === 'OPTIONS') {
        res.setHeader('Allow', 'POST, OPTIONS');
        res.status(204).end();
        return;
    }

    if (req.method !== 'POST') {
        res.setHeader('Allow', 'POST, OPTIONS');
        sendError(res, 405);
        return;
    }

    try {
        const body = req.body && typeof req.body === 'object' ? req.body : {};
        const { task, messages, query } = normalizeBody(body);

        const validationError = validateInput(task, messages, query);
        if (validationError) {
            sendError(res, 400);
            return;
        }

        const token = extractBearerToken(req);
        if (!token) {
            sendError(res, 401);
            return;
        }

        const decodedToken = await verifyFirebaseToken(token);
        const uid = String(decodedToken?.uid || '').trim();
        if (!uid) {
            sendError(res, 401);
            return;
        }

        const requestIdentity = `${uid}:${getRequesterIp(req)}`;
        if (!checkRateLimit(requestIdentity)) {
            sendError(res, 429);
            return;
        }

        let taskResult;
        if (task === 'summary') {
            taskResult = await handleSummary(messages);
        } else if (task === 'search') {
            taskResult = await handleSearch(messages, query);
        } else if (task === 'reply') {
            taskResult = await handleReply(messages, query);
        } else {
            taskResult = await handleInsights(messages, query);
        }

        sendSuccess(res, { result: taskResult.result }, taskResult.provider || 'local');
    } catch {
        sendError(res, 500);
    }
}
