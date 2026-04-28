/**
 * encryption.js — dual-mode encryption layer
 *
 * New messages: Web Crypto API (AES-GCM + PBKDF2) — prefix "wc:"
 * Legacy messages: CryptoJS AES-CBC (prefix "U2FsdGVkX1" — "Salted__" in base64)
 *
 * encryptMessage / decryptMessage remain synchronous for backward compat with
 * existing call-sites. They use CryptoJS under the hood.
 *
 * encryptMessageAsync / decryptMessageAsync are the new Web Crypto versions.
 * Use these for all new features.
 */
import CryptoJS from 'crypto-js';

// ─── Legacy sync API (kept for backward compatibility) ──────────────────────

export function encryptMessage(text, secret) {
    const safeText = String(text || '');
    const safeSecret = String(secret || '');

    if (!safeSecret) {
        throw new Error('Encryption secret is required.');
    }

    if (!safeText) {
        throw new Error('Cannot encrypt empty message.');
    }

    return CryptoJS.AES.encrypt(safeText, safeSecret).toString();
}

export function decryptMessage(cipher, secret) {
    const safeCipher = String(cipher || '');
    const safeSecret = String(secret || '');

    if (!safeSecret) {
        throw new Error('Decryption secret is required.');
    }

    if (!safeCipher) {
        return '';
    }

    // Handle new Web Crypto messages synchronously by returning a placeholder
    // (full decryption handled asynchronously via decryptMessageAsync)
    if (safeCipher.startsWith('wc:')) {
        return '[Encrypted]';
    }

    const bytes = CryptoJS.AES.decrypt(safeCipher, safeSecret);
    const decrypted = bytes.toString(CryptoJS.enc.Utf8);

    if (!decrypted) {
        throw new Error('Unable to decrypt message. Check password.');
    }

    return decrypted;
}

// ─── Web Crypto API (AES-GCM + PBKDF2) ──────────────────────────────────────

const WC_PREFIX = 'wc:';
const PBKDF2_ITERATIONS = 200_000;
const SALT_BYTES = 16;
const IV_BYTES = 12;

async function deriveKey(secret, salt) {
    const enc = new TextEncoder();
    const keyMaterial = await crypto.subtle.importKey(
        'raw',
        enc.encode(secret),
        { name: 'PBKDF2' },
        false,
        ['deriveKey']
    );
    return crypto.subtle.deriveKey(
        { name: 'PBKDF2', salt, iterations: PBKDF2_ITERATIONS, hash: 'SHA-256' },
        keyMaterial,
        { name: 'AES-GCM', length: 256 },
        false,
        ['encrypt', 'decrypt']
    );
}

function bufToB64(buf) {
    return btoa(String.fromCharCode(...new Uint8Array(buf)));
}

function b64ToBuf(b64) {
    return Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
}

/**
 * Encrypt text using AES-GCM + PBKDF2. Returns a "wc:<b64>" string.
 */
export async function encryptMessageAsync(text, secret) {
    const safeText = String(text || '');
    const safeSecret = String(secret || '');
    if (!safeSecret) throw new Error('Encryption secret is required.');
    if (!safeText) throw new Error('Cannot encrypt empty message.');

    const salt = crypto.getRandomValues(new Uint8Array(SALT_BYTES));
    const iv = crypto.getRandomValues(new Uint8Array(IV_BYTES));
    const key = await deriveKey(safeSecret, salt);
    const enc = new TextEncoder();
    const cipherBuf = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, enc.encode(safeText));

    // Format: salt (16B) + iv (12B) + ciphertext
    const combined = new Uint8Array(salt.length + iv.length + cipherBuf.byteLength);
    combined.set(salt, 0);
    combined.set(iv, salt.length);
    combined.set(new Uint8Array(cipherBuf), salt.length + iv.length);

    return WC_PREFIX + bufToB64(combined);
}

/**
 * Decrypt a message encrypted with encryptMessageAsync (or legacy CryptoJS).
 * Returns the plaintext string.
 */
export async function decryptMessageAsync(cipher, secret) {
    const safeCipher = String(cipher || '');
    const safeSecret = String(secret || '');
    if (!safeSecret) throw new Error('Decryption secret is required.');
    if (!safeCipher) return '';

    // New Web Crypto format
    if (safeCipher.startsWith(WC_PREFIX)) {
        const combined = b64ToBuf(safeCipher.slice(WC_PREFIX.length));
        const salt = combined.slice(0, SALT_BYTES);
        const iv = combined.slice(SALT_BYTES, SALT_BYTES + IV_BYTES);
        const cipherBuf = combined.slice(SALT_BYTES + IV_BYTES);
        const key = await deriveKey(safeSecret, salt);
        const plainBuf = await crypto.subtle.decrypt({ name: 'AES-GCM', iv }, key, cipherBuf);
        return new TextDecoder().decode(plainBuf);
    }

    // Legacy CryptoJS format
    const bytes = CryptoJS.AES.decrypt(safeCipher, safeSecret);
    const decrypted = bytes.toString(CryptoJS.enc.Utf8);
    if (!decrypted) throw new Error('Unable to decrypt message. Check password.');
    return decrypted;
}
