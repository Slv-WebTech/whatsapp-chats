const DEFAULT_TIMEOUT_MS = 20000;

function sanitizeText(value, max = 4000) {
    return String(value || "").replace(/\s+/g, " ").trim().slice(0, max);
}

function decodeJwtPayload(token) {
    try {
        const parts = String(token || '').split('.');
        if (parts.length < 2) {
            return null;
        }

        const normalized = parts[1].replace(/-/g, '+').replace(/_/g, '/');
        const padded = normalized.padEnd(normalized.length + ((4 - (normalized.length % 4)) % 4), '=');
        const payload = Buffer.from(padded, 'base64').toString('utf8');
        return JSON.parse(payload);
    } catch {
        return null;
    }
}

function extractBearerToken(req) {
    const header = String(req.headers?.authorization || req.headers?.Authorization || '').trim();
    if (!/^Bearer\s+/i.test(header)) {
        return '';
    }

    return header.replace(/^Bearer\s+/i, '').trim();
}

function validateJwtClaims(payload) {
    if (!payload || typeof payload !== 'object') {
        return false;
    }

    const now = Math.floor(Date.now() / 1000);
    const expiry = Number(payload.exp || 0);
    if (!expiry || expiry <= now) {
        return false;
    }

    return Boolean(payload.sub || payload.user_id || payload.uid);
}

function json(res, status, payload) {
    res.status(status).setHeader("Content-Type", "application/json").send(JSON.stringify(payload));
}

async function readBody(req) {
    if (req.body && typeof req.body === "object") {
        return req.body;
    }

    let raw = "";
    for await (const chunk of req) {
        raw += chunk;
    }

    if (!raw) {
        return {};
    }

    try {
        return JSON.parse(raw);
    } catch {
        return {};
    }
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

function localSummary(transcript, keyPoints = [], decisions = []) {
    const compact = sanitizeText(transcript, 2200);
    const lines = compact.split("\n").slice(-8).filter(Boolean);

    return [
        "Conversation summary:",
        ...(keyPoints.length ? keyPoints.slice(0, 5).map((item) => `- ${sanitizeText(item, 150)}`) : ["- Key points are still forming."]),
        "Decisions:",
        ...(decisions.length ? decisions.slice(0, 4).map((item) => `- ${sanitizeText(item, 150)}`) : ["- No explicit decisions detected."]),
        "Recent context:",
        ...(lines.length ? lines.map((line) => `- ${line}`) : ["- No recent context available."])
    ].join("\n");
}

async function generateWithOpenAI(prompt) {
    const key = process.env.OPENAI_API_KEY || process.env.VITE_OPENAI_API_KEY;
    if (!key) {
        return "";
    }

    const response = await fetchWithTimeout(
        "https://api.openai.com/v1/chat/completions",
        {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${key}`
            },
            body: JSON.stringify({
                model: process.env.OPENAI_MODEL || "gpt-4o-mini",
                temperature: 0.2,
                messages: [
                    {
                        role: "system",
                        content: "You are ConvoLens AI. Keep answers concise, accurate, and safe."
                    },
                    {
                        role: "user",
                        content: prompt
                    }
                ]
            })
        },
        22000
    );

    if (!response.ok) {
        return "";
    }

    const data = await response.json();
    return sanitizeText(data?.choices?.[0]?.message?.content || "", 12000);
}

async function generateWithGemini(prompt) {
    const key = process.env.GEMINI_API_KEY || process.env.VITE_GEMINI_API_KEY;
    if (!key) {
        return "";
    }

    const model = process.env.GEMINI_MODEL || "gemini-1.5-flash";
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${key}`;

    const response = await fetchWithTimeout(
        url,
        {
            method: "POST",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify({
                generationConfig: {
                    temperature: 0.2
                },
                contents: [
                    {
                        role: "user",
                        parts: [{ text: prompt }]
                    }
                ]
            })
        },
        22000
    );

    if (!response.ok) {
        return "";
    }

    const data = await response.json();
    const parts = data?.candidates?.[0]?.content?.parts || [];
    return sanitizeText(parts.map((item) => item?.text || "").join("\n"), 12000);
}

async function generateWithOllama(prompt) {
    const base = (process.env.OLLAMA_BASE_URL || "http://127.0.0.1:11434").replace(/\/$/, "");
    const model = process.env.OLLAMA_MODEL || "llama3.2:3b";

    const response = await fetchWithTimeout(
        `${base}/api/chat`,
        {
            method: "POST",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify({
                model,
                stream: false,
                messages: [
                    {
                        role: "user",
                        content: prompt
                    }
                ]
            })
        },
        14000
    );

    if (!response.ok) {
        return "";
    }

    const data = await response.json();
    return sanitizeText(data?.message?.content || "", 12000);
}

async function runPipeline(prompt) {
    const openAi = await generateWithOpenAI(prompt);
    if (openAi) {
        return { provider: "openai", text: openAi };
    }

    const gemini = await generateWithGemini(prompt);
    if (gemini) {
        return { provider: "gemini", text: gemini };
    }

    const ollama = await generateWithOllama(prompt);
    if (ollama) {
        return { provider: "ollama", text: ollama };
    }

    return { provider: "local", text: "" };
}

async function createEmbeddings(texts) {
    const key = process.env.HUGGINGFACE_API_KEY || process.env.VITE_HUGGINGFACE_API_KEY;
    if (!key || !Array.isArray(texts) || !texts.length) {
        return [];
    }

    const model = process.env.HUGGINGFACE_EMBEDDING_MODEL || "sentence-transformers/all-MiniLM-L6-v2";
    const response = await fetchWithTimeout(
        `https://api-inference.huggingface.co/pipeline/feature-extraction/${model}`,
        {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${key}`
            },
            body: JSON.stringify({
                inputs: texts
            })
        },
        26000
    );

    if (!response.ok) {
        return [];
    }

    const payload = await response.json();
    if (!Array.isArray(payload)) {
        return [];
    }

    return payload.map((vector) => {
        if (!Array.isArray(vector)) {
            return [];
        }

        if (Array.isArray(vector[0])) {
            return vector[0].map((item) => Number(item) || 0);
        }

        return vector.map((item) => Number(item) || 0);
    });
}

function localEmbedding(text) {
    const vector = new Array(64).fill(0);
    const safe = sanitizeText(text, 800);

    for (let index = 0; index < safe.length; index += 1) {
        const code = safe.charCodeAt(index);
        vector[index % 64] += (code % 29) / 29;
    }

    return vector;
}

async function getWebContext(query) {
    const key = process.env.TAVILY_API_KEY || process.env.VITE_TAVILY_API_KEY;
    if (!key) {
        return "";
    }

    const safeQuery = sanitizeText(query, 600);
    const hasUrl = /https?:\/\//i.test(safeQuery);
    const endpoint = hasUrl ? "https://api.tavily.com/extract" : "https://api.tavily.com/search";

    const body = hasUrl
        ? { api_key: key, urls: [safeQuery], include_images: false }
        : {
            api_key: key,
            query: safeQuery,
            max_results: 3,
            include_answer: true,
            search_depth: "advanced"
        };

    const response = await fetchWithTimeout(
        endpoint,
        {
            method: "POST",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify(body)
        },
        22000
    );

    if (!response.ok) {
        return "";
    }

    const data = await response.json();
    if (hasUrl) {
        const content = data?.results?.[0]?.raw_content || data?.results?.[0]?.content || "";
        return sanitizeText(content, 1200);
    }

    const answer = sanitizeText(data?.answer || "", 900);
    if (answer) {
        return answer;
    }

    const lines = (data?.results || []).slice(0, 3).map((item) => `${sanitizeText(item?.title || "", 120)}: ${sanitizeText(item?.content || "", 220)}`);
    return lines.join(" | ");
}

function deriveTaskPrompt(intent, transcript, command) {
    if (intent === "extract_tasks") {
        return `Extract concrete action items from this chat transcript. Return bullet points with owner and due date if available.\n\n${transcript}`;
    }

    if (intent === "summarize") {
        return `Summarize the transcript in concise bullets with key points and decisions.\n\n${transcript}`;
    }

    return `Explain the latest conversation context for a teammate joining late.\n\nCommand: ${command}\n\nTranscript:\n${transcript}`;
}

export default async function handler(req, res) {
    if (req.method === "OPTIONS") {
        res.status(204).end();
        return;
    }

    if (req.method !== "POST") {
        json(res, 405, { ok: false, error: "Method not allowed" });
        return;
    }

    const body = await readBody(req);
    const task = sanitizeText(body?.task || "", 64).toLowerCase();
    const payload = body?.payload || {};
    const requiresJwt = ['assistant', 'web_context', 'embeddings', 'reply_suggestions', 'summarize'].includes(task);

    if (requiresJwt) {
        const token = extractBearerToken(req);
        const claims = decodeJwtPayload(token);
        if (!token || !validateJwtClaims(claims)) {
            json(res, 401, { ok: false, error: 'Unauthorized: valid JWT bearer token is required.' });
            return;
        }
    }

    try {
        if (task === "summarize") {
            const transcript = sanitizeText(payload?.transcript || "", 12000);
            const mode = sanitizeText(payload?.mode || "all", 20);
            const keyPoints = Array.isArray(payload?.keyPoints) ? payload.keyPoints : [];
            const decisions = Array.isArray(payload?.decisions) ? payload.decisions : [];

            const prompt = [
                "You are ConvoLens summarizer.",
                `Mode: ${mode}.`,
                "Return concise markdown bullets with key points and decisions.",
                "Conversation:",
                transcript
            ].join("\n\n");

            const pipeline = await runPipeline(prompt);
            const summary = pipeline.text || localSummary(transcript, keyPoints, decisions);

            json(res, 200, {
                ok: true,
                provider: pipeline.provider || "local",
                result: {
                    summary
                }
            });
            return;
        }

        if (task === "reply_suggestions") {
            const transcript = sanitizeText(payload?.transcript || "", 7000);
            const currentUser = sanitizeText(payload?.currentUser || "", 30);
            const prompt = [
                "Generate 3 short context-aware replies for chat.",
                "Rules: return one reply per line, max 90 chars, friendly and useful.",
                `Current user: ${currentUser || "unknown"}`,
                "Chat:",
                transcript
            ].join("\n\n");

            const pipeline = await runPipeline(prompt);
            const raw = pipeline.text || "Looks good\nCan you share more details?\nThanks, checking this now.";
            const suggestions = raw
                .split(/\n+/)
                .map((item) => item.replace(/^[-*\d.\s]+/, "").trim())
                .filter(Boolean)
                .slice(0, 3);

            json(res, 200, {
                ok: true,
                provider: pipeline.provider || "local",
                result: {
                    suggestions
                }
            });
            return;
        }

        if (task === "assistant") {
            const transcript = sanitizeText(payload?.transcript || "", 9000);
            const command = sanitizeText(payload?.command || "", 220);
            const intent = sanitizeText(payload?.intent || "explain", 30);
            const prompt = deriveTaskPrompt(intent, transcript, command);
            const pipeline = await runPipeline(prompt);

            json(res, 200, {
                ok: true,
                provider: pipeline.provider || "local",
                result: {
                    reply: pipeline.text || "No assistant output available."
                }
            });
            return;
        }

        if (task === "web_context") {
            const query = sanitizeText(payload?.query || "", 600);
            const summary = await getWebContext(query);
            json(res, 200, {
                ok: true,
                provider: summary ? "tavily" : "local",
                result: {
                    summary: summary || ""
                }
            });
            return;
        }

        if (task === "embeddings") {
            const query = sanitizeText(payload?.query || "", 500);
            const texts = Array.isArray(payload?.texts) ? payload.texts.map((item) => sanitizeText(item, 700)) : [];

            if (!texts.length || !query) {
                json(res, 200, {
                    ok: true,
                    provider: "local",
                    result: {
                        queryEmbedding: localEmbedding(query),
                        messageEmbeddings: texts.map((item) => localEmbedding(item))
                    }
                });
                return;
            }

            const allVectors = await createEmbeddings([query, ...texts]);
            if (allVectors.length === texts.length + 1) {
                json(res, 200, {
                    ok: true,
                    provider: "huggingface",
                    result: {
                        queryEmbedding: allVectors[0],
                        messageEmbeddings: allVectors.slice(1)
                    }
                });
                return;
            }

            json(res, 200, {
                ok: true,
                provider: "local",
                result: {
                    queryEmbedding: localEmbedding(query),
                    messageEmbeddings: texts.map((item) => localEmbedding(item))
                }
            });
            return;
        }

        json(res, 400, { ok: false, error: "Unknown task" });
    } catch {
        json(res, 500, { ok: false, error: "AI gateway failed" });
    }
}
