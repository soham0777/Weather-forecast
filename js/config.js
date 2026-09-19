// Central configuration & small persistent-storage helpers.

export const DEFAULT_API_KEY = 'da1582d9e132b07e3885c0c24ce41ecc';

const STORAGE_KEYS = {
  apiKey: 'aurora.apiKey',
  units: 'aurora.units',
  theme: 'aurora.theme',
  recents: 'aurora.recents',
  lastLocation: 'aurora.lastLocation',
};

function safeGet(key) {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

function safeSet(key, value) {
  try {
    localStorage.setItem(key, value);
  } catch {
    /* storage unavailable (private mode, quota) — fail silently */
  }
}

export function getApiKey() {
  return safeGet(STORAGE_KEYS.apiKey) || DEFAULT_API_KEY;
}

export function setApiKey(key) {
  if (!key) {
    try { localStorage.removeItem(STORAGE_KEYS.apiKey); } catch { /* noop */ }
    return;
  }
  safeSet(STORAGE_KEYS.apiKey, key.trim());
}

export function getUnits() {
  return safeGet(STORAGE_KEYS.units) === 'imperial' ? 'imperial' : 'metric';
}

export function setUnits(units) {
  safeSet(STORAGE_KEYS.units, units);
}

export function getThemePref() {
  return safeGet(STORAGE_KEYS.theme) || 'auto';
}

export function setThemePref(theme) {
  safeSet(STORAGE_KEYS.theme, theme);
}

export function getRecents() {
  try {
    return JSON.parse(safeGet(STORAGE_KEYS.recents) || '[]');
  } catch {
    return [];
  }
}

export function pushRecent(place) {
  const recents = getRecents().filter((p) => p.key !== place.key);
  recents.unshift(place);
  safeSet(STORAGE_KEYS.recents, JSON.stringify(recents.slice(0, 6)));
}

export function getLastLocation() {
  try {
    return JSON.parse(safeGet(STORAGE_KEYS.lastLocation) || 'null');
  } catch {
    return null;
  }
}

export function setLastLocation(loc) {
  safeSet(STORAGE_KEYS.lastLocation, JSON.stringify(loc));
}
