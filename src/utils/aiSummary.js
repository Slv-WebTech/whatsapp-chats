import { createLocalSummary } from './localSummary';
import { auth } from '../services/firebase/config';

const DEFAULT_PROVIDER_ORDER = ['openai', 'gemini', 'ollama', 'local'];

function toChatTranscript(messages, maxMessages = 180) {
    return messages
        .slice(-maxMessages)
        .map((m) => `${m.date} ${m.time} - ${m.sender || 'System'}: ${m.message}`)
        .join('\n');
}

function truncateForModelInput(text, maxChars = 9000) {
    const normalized = String(text || '').trim();
    if (!normalized) {
        return '';
    }

    if (normalized.length <= maxChars) {
        return normalized;
    }

    return `${normalized.slice(-maxChars)}\n\n[Transcript truncated to fit model context]`;
}

function getProviderOrder() {
    const configured = String(import.meta.env.PUBLIC_AI_PROVIDER_ORDER || '')
        .split(',')
        .map((item) => item.trim().toLowerCase())
        .filter(Boolean);

    if (!configured.length) {
        return DEFAULT_PROVIDER_ORDER;
    }

    const uniqueConfigured = Array.from(new Set(configured));
    const withFallbacks = DEFAULT_PROVIDER_ORDER.filter((provider) => !uniqueConfigured.includes(provider));
    return [...uniqueConfigured, ...withFallbacks];
}

export function getConfiguredAiProviders() {
    const gatewayEnabled = String(
        import.meta.env.PUBLIC_AI_GATEWAY_ENABLED || (import.meta.env.DEV ? 'false' : 'true')
    ).toLowerCase() !== 'false';

    return {
        hasOpenAI: gatewayEnabled,
        hasGemini: gatewayEnabled,
        hasHuggingFace: gatewayEnabled,
        hasCloudProvider: gatewayEnabled,
        order: getProviderOrder()
    };
}

function normalizeAiText(text) {
    return String(text || '')
        .replace(/```(?:markdown|md|text)?/gi, '')
        .trim();
}

async function summarizeWithGateway(lastMessages) {
    const gatewayEnabled = String(
        import.meta.env.PUBLIC_AI_GATEWAY_ENABLED || (import.meta.env.DEV ? 'false' : 'true')
    ).toLowerCase() !== 'false';

    if (!gatewayEnabled) {
        return { summary: '', provider: '' };
    }

    const controller = new AbortController();
    const timeoutId = window.setTimeout(() => controller.abort(), 24000);

    try {
        const token = await auth?.currentUser?.getIdToken?.();
        const response = await fetch('/api/ai', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                ...(token ? { Authorization: `Bearer ${token}` } : {})
            },
            signal: controller.signal,
            body: JSON.stringify({
                task: 'summary',
                messages: lastMessages,
                query: 'mode:all'
            })
        });

        if (!response.ok) {
            return { summary: '', provider: '' };
        }

        const data = await response.json();
        const summaryText = String(data?.data?.result || data?.result || '').trim();
        const provider = String(data?.data?.provider || data?.provider || '').trim().toLowerCase();
        return {
            summary: normalizeAiText(summaryText),
            provider
        };
    } catch {
        return { summary: '', provider: '' };
    } finally {
        window.clearTimeout(timeoutId);
    }
}

export async function summarizeMessagesWithAI(messages, options = {}) {
    const includeMeta = Boolean(options?.includeMeta);

    if (!messages || messages.length === 0) {
        const fallback = 'No messages available for summary.';
        return includeMeta ? { summary: fallback, provider: 'empty' } : fallback;
    }

    const cappedMessages = messages.slice(-180).map((m, index) => ({
        id: String(m?.id || `summary-${index}`),
        sender: String(m?.sender || 'System'),
        message: String(m?.message || ''),
        date: String(m?.date || ''),
        time: String(m?.time || '')
    }));

    try {
        const result = await summarizeWithGateway(cappedMessages);
        if (result.summary) {
            return includeMeta
                ? {
                    summary: result.summary,
                    provider: result.provider || 'gateway'
                }
                : result.summary;
        }
    } catch {
        // Fallback below
    }

    const fallback = createLocalSummary(messages);
    return includeMeta ? { summary: fallback, provider: 'local' } : fallback;
}
