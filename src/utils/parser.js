import { safeParseDateParts, safeParseTime, createValidDate, validateMessageArray, getSafeMessageText, getSafeSenderName, clampNumber } from './validators';
import { withFallback, parseWithRecovery } from './errorHandling';

const DATE_PATTERN = '(\\d{1,2}[\\/.-]\\d{1,2}[\\/.-]\\d{2,4})';
const TIME_PATTERN = '(\\d{1,2}:\\d{2}(?::\\d{2})?\\s?(?:[ap]m)?)';
const SEPARATOR_PATTERN = '[—-]';

const MESSAGE_REGEX = new RegExp(
    `^${DATE_PATTERN},\\s${TIME_PATTERN}\\s${SEPARATOR_PATTERN}\\s([^:]+):\\s([\\s\\S]*)$`,
    'i'
);
const SYSTEM_REGEX = new RegExp(
    `^${DATE_PATTERN},\\s${TIME_PATTERN}\\s${SEPARATOR_PATTERN}\\s([\\s\\S]*)$`,
    'i'
);
const BRACKETED_MESSAGE_REGEX = new RegExp(
    `^\\[${DATE_PATTERN},\\s${TIME_PATTERN}\\]\\s([^:]+):\\s([\\s\\S]*)$`,
    'i'
);
const BRACKETED_SYSTEM_REGEX = new RegExp(
    `^\\[${DATE_PATTERN},\\s${TIME_PATTERN}\\]\\s([\\s\\S]*)$`,
    'i'
);

// Constants for parser limits
const MAX_MESSAGE_LENGTH = 10000; // Truncate extremely long messages
const MAX_PENDING_MESSAGE_LENGTH = 50000; // Total pending message size
const MAX_SENDER_LENGTH = 200; // Sender name length
const MAX_MESSAGES_PER_FILE = 100000; // Prevent unbounded parsing
const DEFAULT_PARSE_CHUNK_SIZE = 1200;

function yieldToMainThread() {
    return new Promise((resolve) => {
        if (typeof window !== 'undefined' && typeof window.requestAnimationFrame === 'function') {
            window.requestAnimationFrame(() => resolve());
            return;
        }

        setTimeout(resolve, 0);
    });
}

function normalizeLineEndings(text) {
    if (!text || typeof text !== 'string') {
        return '';
    }
    return text.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
}

function finalizePendingMessage(pending, messages, usersSet, parseStats) {
    if (!pending) {
        return null;
    }

    // Safety checks
    if (messages.length >= MAX_MESSAGES_PER_FILE) {
        parseStats.skipped++;
        return null;
    }

    try {
        // Validate date
        const dateParts = safeParseDateParts(pending.date);
        if (!dateParts) {
            parseStats.invalidDates++;
            return null;
        }

        // Validate time
        const timeParts = safeParseTime(pending.time);
        if (!timeParts) {
            parseStats.invalidTimes++;
            return null;
        }

        // Sanitize message text
        let messageText = pending.message.trimEnd();
        if (messageText.length > MAX_MESSAGE_LENGTH) {
            messageText = messageText.slice(0, MAX_MESSAGE_LENGTH);
            parseStats.truncated++;
        }

        // Sanitize sender
        let sender = pending.sender ? getSafeSenderName(pending.sender) : null;
        if (!pending.isSystem && !sender) {
            parseStats.missingSenders++;
            return null; // Skip messages without sender name
        }

        const formattedMessage = {
            id: `${pending.date}-${pending.time}-${messages.length}`,
            date: pending.date,
            time: pending.time,
            sender: sender,
            message: messageText,
            isSystem: pending.isSystem || false
        };

        messages.push(formattedMessage);
        if (formattedMessage.sender && !pending.isSystem) {
            usersSet.add(formattedMessage.sender);
        }
        return formattedMessage;
    } catch (error) {
        console.warn('Error finalizing message:', error);
        parseStats.errors++;
        return null;
    }
}

function createParseStats(totalLines) {
    return {
        total: totalLines,
        parsed: 0,
        skipped: 0,
        invalidDates: 0,
        invalidTimes: 0,
        truncated: 0,
        missingSenders: 0,
        errors: 0
    };
}

function processChatLine(line, state) {
    const { messages, usersSet, parseStats } = state;

    if (!line || typeof line !== 'string') {
        parseStats.skipped++;
        return null;
    }

    if (line.length > 50000) {
        parseStats.skipped++;
        return null;
    }

    const msgMatch = line.match(MESSAGE_REGEX);
    if (msgMatch) {
        const finalized = finalizePendingMessage(state.pending, messages, usersSet, parseStats);
        state.pending = {
            date: msgMatch[1],
            time: msgMatch[2],
            sender: msgMatch[3] ? msgMatch[3].trim() : null,
            message: msgMatch[4] || '',
            isSystem: false
        };
        parseStats.parsed++;
        return finalized;
    }

    const bracketedMsgMatch = line.match(BRACKETED_MESSAGE_REGEX);
    if (bracketedMsgMatch) {
        const finalized = finalizePendingMessage(state.pending, messages, usersSet, parseStats);
        state.pending = {
            date: bracketedMsgMatch[1],
            time: bracketedMsgMatch[2],
            sender: bracketedMsgMatch[3] ? bracketedMsgMatch[3].trim() : null,
            message: bracketedMsgMatch[4] || '',
            isSystem: false
        };
        parseStats.parsed++;
        return finalized;
    }

    const sysMatch = line.match(SYSTEM_REGEX);
    if (sysMatch) {
        const maybeMessage = sysMatch[3] || '';

        const finalized = finalizePendingMessage(state.pending, messages, usersSet, parseStats);
        state.pending = {
            date: sysMatch[1],
            time: sysMatch[2],
            sender: null,
            message: maybeMessage,
            isSystem: true
        };
        parseStats.parsed++;
        return finalized;
    }

    const bracketedSysMatch = line.match(BRACKETED_SYSTEM_REGEX);
    if (bracketedSysMatch) {
        const maybeMessage = bracketedSysMatch[3] || '';

        const finalized = finalizePendingMessage(state.pending, messages, usersSet, parseStats);
        state.pending = {
            date: bracketedSysMatch[1],
            time: bracketedSysMatch[2],
            sender: null,
            message: maybeMessage,
            isSystem: true
        };
        parseStats.parsed++;
        return finalized;
    }

    if (state.pending && state.pending.message.length < MAX_PENDING_MESSAGE_LENGTH) {
        state.pending.message += `\n${line}`;
    } else if (state.pending) {
        parseStats.truncated++;
    }

    return null;
}

async function parseWhatsAppTextInChunks(rawText, options = {}) {
    const text = normalizeLineEndings(rawText || '');
    const lines = text.split('\n');
    const messages = [];
    const usersSet = new Set();
    const parseStats = createParseStats(lines.length);
    const chunkSize = clampNumber(options.chunkSize ?? DEFAULT_PARSE_CHUNK_SIZE, 200, 5000);
    const onChunk = typeof options.onChunk === 'function' ? options.onChunk : null;
    const onProgress = typeof options.onProgress === 'function' ? options.onProgress : null;

    const state = {
        pending: null,
        messages,
        usersSet,
        parseStats
    };

    let stagedMessages = [];
    let stagedUsers = new Set();

    const flushStage = (processedLines) => {
        if (stagedMessages.length && onChunk) {
            onChunk({
                messages: stagedMessages,
                users: Array.from(stagedUsers)
            });
        }

        if (onProgress) {
            const percent = lines.length ? Math.min(100, Math.round((processedLines / lines.length) * 100)) : 100;
            onProgress({ processedLines, totalLines: lines.length, percent });
        }

        stagedMessages = [];
        stagedUsers = new Set();
    };

    for (let index = 0; index < lines.length; index++) {
        const finalized = processChatLine(lines[index], state);

        if (finalized) {
            stagedMessages.push(finalized);
            if (finalized.sender && !finalized.isSystem) {
                stagedUsers.add(finalized.sender);
            }
        }

        if ((index + 1) % chunkSize === 0) {
            flushStage(index + 1);
            await yieldToMainThread();
        }
    }

    const finalizedTail = finalizePendingMessage(state.pending, messages, usersSet, parseStats);
    if (finalizedTail) {
        stagedMessages.push(finalizedTail);
        if (finalizedTail.sender && !finalizedTail.isSystem) {
            stagedUsers.add(finalizedTail.sender);
        }
    }

    flushStage(lines.length);

    if (process.env.NODE_ENV === 'development') {
        console.log('Parse statistics:', parseStats);
    }

    return {
        messages,
        users: Array.from(usersSet).sort(),
        stats: parseStats
    };
}

function decodeBuffer(buffer) {
    const encodings = ['utf-8', 'utf-16le', 'windows-1252'];

    for (const encoding of encodings) {
        try {
            const text = new TextDecoder(encoding, { fatal: false }).decode(buffer);
            if (text && /\d{1,2}[\/.\-]\d{1,2}[\/.\-]\d{2,4},\s\d{1,2}:\d{2}/.test(text)) {
                return text;
            }
        } catch (error) {
            // Try the next encoding.
        }
    }

    return new TextDecoder('utf-8', { fatal: false }).decode(buffer);
}

/**
 * Parse WhatsApp chat export with enhanced error handling and validation
 */
export function parseWhatsAppChat(rawText) {
    const text = normalizeLineEndings(rawText || '');
    const lines = text.split('\n');
    const messages = [];
    const usersSet = new Set();
    let pending = null;

    const parseStats = {
        total: lines.length,
        parsed: 0,
        skipped: 0,
        invalidDates: 0,
        invalidTimes: 0,
        truncated: 0,
        missingSenders: 0,
        errors: 0
    };

    for (const line of lines) {
        if (!line || typeof line !== 'string') {
            parseStats.skipped++;
            continue;
        }

        // Guard against extremely long lines
        if (line.length > 50000) {
            parseStats.skipped++;
            continue;
        }

        const msgMatch = line.match(MESSAGE_REGEX);
        if (msgMatch) {
            finalizePendingMessage(pending, messages, usersSet, parseStats);
            pending = {
                date: msgMatch[1],
                time: msgMatch[2],
                sender: msgMatch[3] ? msgMatch[3].trim() : null,
                message: msgMatch[4] || '',
                isSystem: false
            };
            parseStats.parsed++;
            continue;
        }

        const bracketedMsgMatch = line.match(BRACKETED_MESSAGE_REGEX);
        if (bracketedMsgMatch) {
            finalizePendingMessage(pending, messages, usersSet, parseStats);
            pending = {
                date: bracketedMsgMatch[1],
                time: bracketedMsgMatch[2],
                sender: bracketedMsgMatch[3] ? bracketedMsgMatch[3].trim() : null,
                message: bracketedMsgMatch[4] || '',
                isSystem: false
            };
            parseStats.parsed++;
            continue;
        }

        const sysMatch = line.match(SYSTEM_REGEX);
        if (sysMatch) {
            const maybeMessage = sysMatch[3] || '';

            finalizePendingMessage(pending, messages, usersSet, parseStats);
            pending = {
                date: sysMatch[1],
                time: sysMatch[2],
                sender: null,
                message: maybeMessage,
                isSystem: true
            };
            parseStats.parsed++;
            continue;
        }

        const bracketedSysMatch = line.match(BRACKETED_SYSTEM_REGEX);
        if (bracketedSysMatch) {
            const maybeMessage = bracketedSysMatch[3] || '';

            finalizePendingMessage(pending, messages, usersSet, parseStats);
            pending = {
                date: bracketedSysMatch[1],
                time: bracketedSysMatch[2],
                sender: null,
                message: maybeMessage,
                isSystem: true
            };
            parseStats.parsed++;
            continue;
        }

        // Continuation line
        if (pending && pending.message.length < MAX_PENDING_MESSAGE_LENGTH) {
            pending.message += `\n${line}`;
        } else if (pending) {
            parseStats.truncated++;
        }
    }

    finalizePendingMessage(pending, messages, usersSet, parseStats);

    // Log statistics in development
    if (process.env.NODE_ENV === 'development') {
        console.log('Parse statistics:', parseStats);
    }

    return {
        messages,
        users: Array.from(usersSet).sort(),
        stats: parseStats
    };
}

export async function parseWhatsAppFileInChunks(file, options = {}) {
    if (!file || !(file instanceof File || file instanceof Blob)) {
        return Promise.reject(new Error('Invalid file object provided'));
    }

    const maxFileSize = 50 * 1024 * 1024;
    if (file.size > maxFileSize) {
        return Promise.reject(new Error(`File size exceeds maximum limit of ${maxFileSize / 1024 / 1024}MB`));
    }

    const extension = file.name ? file.name.split('.').pop()?.toLowerCase() : '';
    const buffer = await file.arrayBuffer();
    let content = '';

    if (extension === 'doc' || extension === 'docx') {
        content = decodeBuffer(new Uint8Array(buffer));
    } else {
        content = new TextDecoder('utf-8', { fatal: false }).decode(buffer);
    }

    const sanitized = String(content || '')
        .replace(/\u0000/g, '')
        .slice(0, 5000000);

    if (!sanitized.trim()) {
        return Promise.reject(new Error('File is empty or contains no readable text'));
    }

    const parsed = await parseWhatsAppTextInChunks(sanitized, options);

    if (!parsed.messages || parsed.messages.length === 0) {
        return Promise.reject(new Error('No valid messages found in file. Check file format.'));
    }

    return parsed;
}

/**
 * Parse WhatsApp chat file with encoding detection and error recovery
 */
export function parseWhatsAppFile(file) {
    if (!file || !(file instanceof File || file instanceof Blob)) {
        return Promise.reject(new Error('Invalid file object provided'));
    }

    const maxFileSize = 50 * 1024 * 1024; // 50 MB limit
    if (file.size > maxFileSize) {
        return Promise.reject(new Error(`File size exceeds maximum limit of ${maxFileSize / 1024 / 1024}MB`));
    }

    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        const extension = file.name ? file.name.split('.').pop()?.toLowerCase() : '';

        // Timeout after 30 seconds
        const timeout = setTimeout(() => {
            reader.abort();
            reject(new Error('File parsing timeout - file may be too large or corrupted'));
        }, 30000);

        reader.onload = () => {
            clearTimeout(timeout);
            try {
                let content = '';

                if (typeof reader.result === 'string') {
                    content = reader.result;
                } else if (reader.result instanceof ArrayBuffer) {
                    const buffer = new Uint8Array(reader.result || new ArrayBuffer(0));
                    content = decodeBuffer(buffer);
                } else {
                    throw new Error('Unexpected file format');
                }

                // Sanitize content
                const sanitized = String(content || '')
                    .replace(/\u0000/g, '') // Remove null characters
                    .slice(0, 5000000); // Cap at 5MB of text

                if (!sanitized.trim()) {
                    reject(new Error('File is empty or contains no readable text'));
                    return;
                }

                const parsed = parseWhatsAppChat(sanitized);

                // Validate results
                if (!parsed.messages || parsed.messages.length === 0) {
                    reject(new Error('No valid messages found in file. Check file format.'));
                    return;
                }

                resolve(parsed);
            } catch (error) {
                reject(new Error(`Failed to parse file: ${error?.message || 'Unknown error'}`));
            }
        };

        reader.onerror = () => {
            clearTimeout(timeout);
            reject(new Error('Could not read the file. Check if the file is accessible.'));
        };

        reader.onabort = () => {
            clearTimeout(timeout);
            reject(new Error('File reading was cancelled.'));
        };

        try {
            if (extension === 'doc' || extension === 'docx') {
                reader.readAsArrayBuffer(file);
            } else {
                reader.readAsText(file);
            }
        } catch (error) {
            reject(new Error(`Failed to initiate file reading: ${error?.message || 'Unknown error'}`));
        }
    });
}
