import { BRAND } from './branding';

function toBrandKey(name) {
    return String(name || '')
        .trim()
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '') || 'app';
}

export const BRAND_KEY = toBrandKey(BRAND.name);
export const BRAND_EMAIL_DOMAIN = `${BRAND_KEY}.app`;
export const BRAND_PERSIST_FALLBACK = `${BRAND_KEY}-persist`;
export const BRAND_VERSION_STORAGE_KEY = `${BRAND_KEY}.app.version`;
export const BRAND_SW_CACHE_PREFIX = `${BRAND_KEY}-cache`;
export const BRAND_SYNC_TAG = `${BRAND_KEY}-sync`;
export const BRAND_PUSH_TAG = `${BRAND_KEY}-push`;
export const BRAND_PUSH_MESSAGE_TAG = `${BRAND_KEY}-message`;
