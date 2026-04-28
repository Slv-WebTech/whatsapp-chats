import { auth } from '../../services/firebase/config';

const API_TIMEOUT_MS = 18000;
const memoryCache = new Map();
const inFlightRequests = new Map();
const debounceTimers = new Map();

async function getJwtAuthorizationHeader() {
    try {
        const token = await auth?.currentUser?.getIdToken?.();
        if (!token) {
            return '';
        }

        return `Bearer ${token}`;
    } catch {
        return '';
    }
}

function sanitizeText(value, max = 2400) {
    return String(value || "").replace(/\s+/g, " ").trim().slice(0, max);
}

function toRecentTranscript(messages, max = 90) {
    return (messages || [])
        .slice(-max)
        .map((item) => {
            const sender = sanitizeText(item?.sender || "User", 32);
            const text = sanitizeText(item?.message || item?.text || "", 700);
            const date = sanitizeText(item?.date || "", 24);
            const time = sanitizeText(item?.time || "", 24);
            return `${date} ${time} ${sender}: ${text}`.trim();
        })
        .filter(Boolean)
        .join("\n");
}

function getCached(cacheKey) {
    if (!cacheKey) {
        return null;
    }

    const entry = memoryCache.get(cacheKey);
    if (!entry) {
        return null;
    }

    if (Date.now() > entry.expireAt) {
        memoryCache.delete(cacheKey);
        return null;
    }

    return entry.value;
}

function setCached(cacheKey, value, ttlMs = 120000) {
    if (!cacheKey) {
        return;
    }

    memoryCache.set(cacheKey, {
        value,
        expireAt: Date.now() + ttlMs
    });
}

function normalizeGatewayResponse(data) {
    if (!data || typeof data !== 'object') {
        return null;
    }

    const success = Boolean(data.success || data.ok);
    if (!success) {
        return null;
    }

    const provider = String(data?.data?.provider || data?.provider || 'local').trim().toLowerCase();
    const result = data?.data?.result ?? data?.result;

    return {
        success: true,
        provider,
        result
    };
}

async function requestAiGateway(task, request = {}, options = {}) {
    const gatewayEnabled = String(
        import.meta.env.VITE_AI_GATEWAY_ENABLED || (import.meta.env.DEV ? 'false' : 'true')
    ).toLowerCase() !== 'false';

    if (!gatewayEnabled) {
        return null;
    }

    const { timeoutMs = API_TIMEOUT_MS, cacheKey = "", ttlMs = 120000, debounceMs = 0 } = options;
    const messages = Array.isArray(request?.messages) ? request.messages : [];
    const query = sanitizeText(request?.query || '', 700);
    const requestKey = `${task}:${cacheKey || query.slice(0, 120)}:${messages.length}`;

    const cached = getCached(cacheKey);
    if (cached) {
        return cached;
    }

    const executeRequest = async () => {
        if (inFlightRequests.has(requestKey)) {
            return inFlightRequests.get(requestKey);
        }

        const controller = new AbortController();
        const timeoutId = window.setTimeout(() => controller.abort(), timeoutMs);
        const authorization = await getJwtAuthorizationHeader();

        const promise = (async () => {
            try {
                const response = await fetch("/api/ai", {
                    method: "POST",
                    headers: {
                        "Content-Type": "application/json",
                        ...(authorization ? { Authorization: authorization } : {})
                    },
                    signal: controller.signal,
                    body: JSON.stringify({
                        task,
                        messages,
                        query
                    })
                });

                if (!response.ok) {
                    return null;
                }

                const payload = await response.json();
                const normalized = normalizeGatewayResponse(payload);
                if (!normalized) {
                    return null;
                }

                setCached(cacheKey, normalized, ttlMs);
                return normalized;
            } catch {
                return null;
            } finally {
                window.clearTimeout(timeoutId);
                inFlightRequests.delete(requestKey);
            }
        })();

        inFlightRequests.set(requestKey, promise);
        return promise;
    };

    if (debounceMs > 0) {
        const timerKey = `debounce:${requestKey}`;
        const priorTimer = debounceTimers.get(timerKey);
        if (priorTimer) {
            window.clearTimeout(priorTimer.id);
            priorTimer.resolve(null);
        }

        return new Promise((resolve) => {
            const id = window.setTimeout(async () => {
                debounceTimers.delete(timerKey);
                resolve(await executeRequest());
            }, debounceMs);

            debounceTimers.set(timerKey, { id, resolve });
        });
    }

    return executeRequest();
}

function tokenize(value) {
    return sanitizeText(value, 4000)
        .toLowerCase()
        .split(/[^a-z0-9]+/)
        .map((item) => item.trim())
        .filter((item) => item.length > 2);
}

function cosineSimilarity(left, right) {
    const leftCount = new Map();
    const rightCount = new Map();

    left.forEach((token) => {
        leftCount.set(token, (leftCount.get(token) || 0) + 1);
    });

    right.forEach((token) => {
        rightCount.set(token, (rightCount.get(token) || 0) + 1);
    });

    let dot = 0;
    let leftNorm = 0;
    let rightNorm = 0;

    leftCount.forEach((count, key) => {
        const rightValue = rightCount.get(key) || 0;
        dot += count * rightValue;
        leftNorm += count * count;
    });

    rightCount.forEach((count) => {
        rightNorm += count * count;
    });

    if (!leftNorm || !rightNorm) {
        return 0;
    }

    return dot / (Math.sqrt(leftNorm) * Math.sqrt(rightNorm));
}

function localMoodScore(text) {
    const safeText = sanitizeText(text, 1200).toLowerCase();
    if (!safeText) {
        return 0;
    }

    const positive = ["great", "awesome", "nice", "good", "happy", "thanks", "done", "perfect", "love"];
    const negative = ["bad", "delay", "problem", "hate", "angry", "broken", "issue", "urgent", "blocked"];

    const positiveHits = positive.reduce((acc, token) => acc + (safeText.includes(token) ? 1 : 0), 0);
    const negativeHits = negative.reduce((acc, token) => acc + (safeText.includes(token) ? 1 : 0), 0);

    return positiveHits - negativeHits;
}

function getDateKey(message) {
    const raw = sanitizeText(message?.date || "", 24);
    if (raw) {
        return raw;
    }

    return "Unknown";
}

function extractBreakdown(messages) {
    const byUser = new Map();
    const byDate = new Map();
    const decisionSignals = [];
    const keyPoints = [];

    for (const entry of messages || []) {
        const text = sanitizeText(entry?.message || "", 400);
        if (!text || entry?.isSystem) {
            continue;
        }

        const sender = sanitizeText(entry?.sender || "Unknown", 32);
        const date = getDateKey(entry);

        if (!byUser.has(sender)) {
            byUser.set(sender, []);
        }
        byUser.get(sender).push(text);

        if (!byDate.has(date)) {
            byDate.set(date, []);
        }
        byDate.get(date).push(`${sender}: ${text}`);

        if (/\b(decided|decision|approved|ship it|final|agreed|confirm)\b/i.test(text)) {
            decisionSignals.push(text);
        }

        if (keyPoints.length < 8 && text.length > 20) {
            keyPoints.push(text.slice(0, 180));
        }
    }

    const daily = Array.from(byDate.entries()).map(([date, items]) => ({
        date,
        summary: items.slice(0, 5).join("\n") || "No summary"
    }));

    const perUser = Array.from(byUser.entries())
        .map(([sender, lines]) => ({
            sender,
            summary: lines.slice(0, 4).join("\n") || "No summary"
        }))
        .sort((a, b) => b.summary.length - a.summary.length);

    return {
        keyPoints: keyPoints.slice(0, 6),
        decisions: decisionSignals.slice(0, 6),
        daily,
        perUser
    };
}

function createFallbackSummary(messages, breakdown) {
    const participants = Array.from(new Set((messages || []).map((entry) => sanitizeText(entry?.sender || "", 30)).filter(Boolean)));
    const total = (messages || []).length;
    const keyLines = (breakdown?.keyPoints || []).slice(0, 4).map((item) => `- ${item}`);
    const decisions = (breakdown?.decisions || []).slice(0, 3).map((item) => `- ${item}`);

    return [
        `Messages analyzed: ${total}`,
        `Participants: ${participants.join(", ") || "Unknown"}`,
        "Key points:",
        ...(keyLines.length ? keyLines : ["- No major key points detected."]),
        "Important decisions:",
        ...(decisions.length ? decisions : ["- No explicit decisions detected."])
    ].join("\n");
}

export function autoTagMessage(text) {
    const safeText = sanitizeText(text, 1400).toLowerCase();
    const tags = new Set();

    if (/\b(meeting|agenda|sync|schedule|standup|deadline)\b/.test(safeText)) {
        tags.add("Meeting");
        tags.add("Work");
    }

    if (/\b(invoice|contract|client|deploy|release|ticket|bug|project)\b/.test(safeText)) {
        tags.add("Work");
    }

    if (/\b(family|party|dinner|vacation|home|weekend|birthday)\b/.test(safeText)) {
        tags.add("Personal");
    }

    if (/\b(urgent|asap|important|critical|blocker|immediately|priority)\b/.test(safeText)) {
        tags.add("Important");
    }

    return Array.from(tags);
}

export function moderateMessage(text) {
    const safeText = sanitizeText(text, 1400).toLowerCase();
    const spamSignals = [/free money/i, /click here/i, /buy now/i, /http[s]?:\/\//i];
    const toxicSignals = [/\bidiot\b/i, /\bstupid\b/i, /\bshut up\b/i, /\bhate you\b/i];
    const abuseSignals = [/\bkill\b/i, /\bthreat\b/i, /\bviolence\b/i];

    const spamHits = spamSignals.reduce((acc, pattern) => acc + (pattern.test(safeText) ? 1 : 0), 0);
    const toxicHits = toxicSignals.reduce((acc, pattern) => acc + (pattern.test(safeText) ? 1 : 0), 0);
    const abuseHits = abuseSignals.reduce((acc, pattern) => acc + (pattern.test(safeText) ? 1 : 0), 0);

    const shouldFlag = spamHits + toxicHits + abuseHits > 0;
    const reason = abuseHits > 0 ? "abuse" : toxicHits > 0 ? "toxic-language" : spamHits > 0 ? "spam" : "";
    const urgency = /\b(urgent|asap|critical|production down|sev-1|incident)\b/i.test(safeText);

    return {
        shouldFlag,
        reason,
        urgency,
        score: spamHits + toxicHits * 2 + abuseHits * 3
    };
}

export function buildMoodTimeline(messages) {
    const buckets = new Map();

    for (const entry of messages || []) {
        if (entry?.isSystem) {
            continue;
        }

        const date = getDateKey(entry);
        const score = localMoodScore(entry?.message || "");

        if (!buckets.has(date)) {
            buckets.set(date, { score: 0, count: 0 });
        }

        const current = buckets.get(date);
        current.score += score;
        current.count += 1;
    }

    return Array.from(buckets.entries()).map(([date, value]) => {
        const average = value.count ? value.score / value.count : 0;
        let mood = "neutral";

        if (average > 0.35) {
            mood = "positive";
        } else if (average < -0.35) {
            mood = "tense";
        }

        return {
            date,
            mood,
            score: Number(average.toFixed(3))
        };
    });
}

export async function suggestReplies(messages, currentUser) {
    const recent = (messages || []).filter((item) => !item?.isSystem).slice(-16);
    const transcript = toRecentTranscript(recent, 16);

    const gateway = await requestAiGateway(
        "reply",
        {
            messages: recent,
            query: `Current user: ${sanitizeText(currentUser, 32)}`
        },
        {
            cacheKey: `reply:${transcript.slice(-240)}`,
            ttlMs: 45000
        }
    );

    if (Array.isArray(gateway?.result?.suggestions) && gateway.result.suggestions.length) {
        return gateway.result.suggestions.slice(0, 3);
    }

    const latest = recent[recent.length - 1]?.message || "";
    const safe = sanitizeText(latest, 180).toLowerCase();

    if (!safe) {
        return ["Looks good", "Can you share more details?", "Thanks, I will check."];
    }

    if (/\b(when|time|schedule|deadline)\b/.test(safe)) {
        return ["I can do today by 6 PM.", "Let us lock the time in calendar.", "Sharing exact ETA in 10 mins."];
    }

    if (/\b(help|issue|error|problem|bug)\b/.test(safe)) {
        return ["I am checking this now.", "Can you share a screenshot?", "I found a fix, sending it shortly."];
    }

    return ["Sounds good to me.", "Let me review and get back.", "Thanks for the update."];
}

export async function semanticSearch(messages, queryText, limit = 6) {
    const query = sanitizeText(queryText, 260);
    if (!query) {
        return [];
    }

    const normalized = (messages || [])
        .filter((entry) => !entry?.isSystem)
        .map((entry, index) => ({
            index,
            id: String(entry?.id || `m-${index}`),
            sender: sanitizeText(entry?.sender || "Unknown", 32),
            text: sanitizeText(entry?.message || "", 450),
            date: sanitizeText(entry?.date || "", 24),
            time: sanitizeText(entry?.time || "", 24)
        }))
        .filter((entry) => entry.text.length > 2)
        .slice(-120);

    if (!normalized.length) {
        return [];
    }

    const gateway = await requestAiGateway(
        "search",
        {
            messages: normalized,
            query,
        },
        {
            cacheKey: `embedding:${query}:${normalized.length}`,
            ttlMs: 90000,
            timeoutMs: 22000,
            debounceMs: 260
        }
    );

    if (Array.isArray(gateway?.result?.matches) && gateway.result.matches.length) {
        return gateway.result.matches.slice(0, limit);
    }

    const queryTokens = tokenize(query);
    return normalized
        .map((entry) => ({
            score: cosineSimilarity(queryTokens, tokenize(entry.text)),
            message: entry
        }))
        .sort((a, b) => b.score - a.score)
        .slice(0, limit)
        .map((item) => item.message);
}

export async function fetchWebContext(inputText) {
    const input = sanitizeText(inputText, 900);
    if (!input) {
        return "";
    }

    const hasUrl = /https?:\/\//i.test(input);
    const isQuestion = /\?$/.test(input) || /^\s*(what|why|how|when|who|latest|news)\b/i.test(input);

    if (!hasUrl && !isQuestion) {
        return "";
    }

    const gateway = await requestAiGateway(
        "insights",
        {
            messages: [],
            query: `Web context lookup: ${input}`
        },
        {
            cacheKey: `web:${input}`,
            ttlMs: 180000,
            timeoutMs: 24000
        }
    );

    return sanitizeText(typeof gateway?.result === 'string' ? gateway.result : '', 800);
}

export async function summarizeConversation(messages, mode = "all") {
    const list = Array.isArray(messages) ? messages : [];
    const transcript = toRecentTranscript(list, 180);
    const breakdown = extractBreakdown(list);

    if (!transcript) {
        return {
            provider: "local",
            summary: "No messages available for summary.",
            breakdown
        };
    }

    const gateway = await requestAiGateway(
        "summary",
        {
            messages: list,
            query: `mode:${sanitizeText(mode, 16)}`
        },
        {
            cacheKey: `summary:${mode}:${transcript.slice(-300)}`,
            ttlMs: 180000,
            timeoutMs: 26000
        }
    );

    const summary = sanitizeText(typeof gateway?.result === 'string' ? gateway.result : '', 5000) || createFallbackSummary(list, breakdown);

    return {
        provider: gateway?.provider || "local",
        summary,
        breakdown
    };
}

function extractTasksFromMessages(messages) {
    return (messages || [])
        .filter((entry) => /\b(todo|task|action item|follow up|deadline|owner)\b/i.test(String(entry?.message || "")))
        .slice(-8)
        .map((entry) => `- ${sanitizeText(entry?.sender || "Unknown", 24)}: ${sanitizeText(entry?.message || "", 140)}`);
}

export async function runAssistantCommand(commandText, messages) {
    const safeCommand = sanitizeText(commandText, 240);

    let intent = "explain";
    if (/\bsummarize\b/i.test(safeCommand)) {
        intent = "summarize";
    } else if (/\btask|extract\b/i.test(safeCommand)) {
        intent = "extract_tasks";
    }

    const gateway = await requestAiGateway(
        "insights",
        {
            messages: (messages || []).slice(-80),
            query: `${intent}: ${safeCommand}`
        },
        {
            cacheKey: `assistant:${intent}:${safeCommand}`,
            ttlMs: 60000,
            timeoutMs: 22000
        }
    );

    const serverReply = sanitizeText(typeof gateway?.result === 'string' ? gateway.result : '', 3200);
    if (serverReply) {
        return serverReply;
    }

    if (intent === "summarize") {
        const fallback = await summarizeConversation(messages, "all");
        return fallback.summary;
    }

    if (intent === "extract_tasks") {
        const tasks = extractTasksFromMessages(messages);
        return tasks.length ? tasks.join("\n") : "No clear tasks detected in recent messages.";
    }

    const latest = (messages || []).slice(-4).map((entry) => `- ${sanitizeText(entry?.sender || "User", 24)}: ${sanitizeText(entry?.message || "", 120)}`).join("\n");
    return latest ? `Recent context:\n${latest}` : "No enough context to explain yet.";
}
