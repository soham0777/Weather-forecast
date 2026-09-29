/* Client-side checks that mirror the backend rules, for instant feedback.
   The server always re-validates; these never replace it. */

export const EMAIL_REGEX = /^[A-Za-z0-9._%+-]+@[A-Za-z0-9-]+(\.[A-Za-z0-9-]+)*\.[A-Za-z]{2,}$/;
export const PHONE_REGEX = /^\+?[0-9]{10,15}$/;
export const REGISTRATION_REGEX = /^([LU][0-9]{5}[A-Z]{2}[0-9]{4}[A-Z]{3}[0-9]{6}|[A-Z]{3}-[0-9]{4})$/;

export const PASSWORD_RULES = [
  { id: 'length', label: 'At least 8 characters', test: (v) => v.length >= 8 && v.length <= 64 },
  { id: 'upper', label: 'An upper-case letter', test: (v) => /[A-Z]/.test(v) },
  { id: 'lower', label: 'A lower-case letter', test: (v) => /[a-z]/.test(v) },
  { id: 'digit', label: 'A number', test: (v) => /\d/.test(v) },
  { id: 'special', label: 'A special character (e.g. @ # $ !)', test: (v) => /[^A-Za-z0-9\s]/.test(v) },
];

export const isStrongPassword = (v = '') => PASSWORD_RULES.every((rule) => rule.test(v));

export function validateEmail(value) {
  if (!value?.trim()) return 'E-mail is required.';
  if (!EMAIL_REGEX.test(value.trim())) return 'Please enter a valid e-mail address (e.g. name@college.edu).';
  return null;
}

export function validatePhone(value) {
  if (!value?.trim()) return 'Phone number is required.';
  if (!PHONE_REGEX.test(value.trim())) return 'Phone number must contain 10 to 15 digits (an optional leading + is allowed).';
  return null;
}

export function validateGpa(value) {
  if (value === '' || value === null || value === undefined) return 'GPA is required.';
  const n = Number(value);
  if (Number.isNaN(n) || n < 0 || n > 10) return 'GPA must be between 0 and 10.';
  if (!/^\d{1,2}(\.\d{1,2})?$/.test(String(value))) return 'GPA can have at most 2 decimal places.';
  return null;
}

export function required(value, label) {
  return value === null || value === undefined || String(value).trim() === '' ? `${label} is required.` : null;
}

/** Returns an object with only the fields that have errors. */
export function collectErrors(checks) {
  return Object.fromEntries(Object.entries(checks).filter(([, message]) => Boolean(message)));
}
