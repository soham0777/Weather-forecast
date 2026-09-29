const dateFormatter = new Intl.DateTimeFormat('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
const dateTimeFormatter = new Intl.DateTimeFormat('en-IN', {
  day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit',
});
const currencyFormatter = new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 });
const numberFormatter = new Intl.NumberFormat('en-IN');

/** "2026-09-29" (a LocalDate) → 29 Sept 2026. Parsed as a local date, not UTC. */
export function formatDate(value) {
  if (!value) return '—';
  const date = typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value)
    ? parseLocalDate(value) : new Date(value);
  return Number.isNaN(date.getTime()) ? '—' : dateFormatter.format(date);
}

/** ISO instant → local date and time. */
export function formatDateTime(value) {
  if (!value) return '—';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? '—' : dateTimeFormatter.format(date);
}

/** "14:30:00" → "02:30 pm" */
export function formatTime(value) {
  if (!value) return '—';
  const [h, m] = value.split(':').map(Number);
  const date = new Date(2000, 0, 1, h, m);
  return date.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' });
}

export function formatCurrency(value) {
  if (value === null || value === undefined) return '—';
  return currencyFormatter.format(Number(value));
}

export function formatStipend(value) {
  if (value === null || value === undefined) return '—';
  return Number(value) === 0 ? 'Unpaid' : `${currencyFormatter.format(Number(value))}/month`;
}

export function formatNumber(value) {
  if (value === null || value === undefined) return '—';
  return numberFormatter.format(value);
}

export function formatPercent(value) {
  return value === null || value === undefined ? null : `${value}%`;
}

export function formatRating(value) {
  return value === null || value === undefined ? null : `${Number(value).toFixed(1)} / 5`;
}

export function formatBytes(bytes) {
  if (!bytes) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB'];
  const i = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1);
  return `${(bytes / 1024 ** i).toFixed(i === 0 ? 0 : 1)} ${units[i]}`;
}

export function parseLocalDate(value) {
  const [y, m, d] = value.split('-').map(Number);
  return new Date(y, m - 1, d);
}

export function todayIso() {
  const now = new Date();
  return toIsoDate(now);
}

export function toIsoDate(date) {
  const pad = (n) => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

/** Whole days from today until a yyyy-MM-dd date (negative when in the past). */
export function daysUntil(isoDate) {
  if (!isoDate) return null;
  const target = parseLocalDate(isoDate);
  const today = parseLocalDate(todayIso());
  return Math.round((target - today) / 86400000);
}

export function deadlineLabel(isoDate) {
  const days = daysUntil(isoDate);
  if (days === null) return null;
  if (days < 0) return 'Deadline passed';
  if (days === 0) return 'Closes today';
  if (days === 1) return 'Closes tomorrow';
  return `Closes in ${days} days`;
}

/** "2026-09" → "Sep 2026" */
export function formatMonth(period) {
  const [y, m] = period.split('-').map(Number);
  return new Date(y, m - 1, 1).toLocaleDateString('en-IN', { month: 'short', year: 'numeric' });
}

/** "2026-09-29" → "29 Sep" */
export function formatDayShort(period) {
  return parseLocalDate(period).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' });
}

export function titleCase(value) {
  if (!value) return '';
  return value.toLowerCase().replace(/_/g, ' ').replace(/^\w/, (c) => c.toUpperCase());
}
