/**
 * HTTP layer for the simulator UI.
 *
 * Every button in the UI ends up here:  React -> Axios -> FastAPI -> SQLite.
 * Nothing is hard-coded: the responses shown on screen are the real ones.
 */
import axios from 'axios'

export const API_BASE_URL = (import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000').replace(/\/$/, '')

export const http = axios.create({
  baseURL: API_BASE_URL,
  timeout: 20000,
  // Let the caller inspect 4xx/5xx responses instead of treating them as exceptions.
  validateStatus: () => true,
})

export const OFFLINE_MESSAGE =
  `Cannot reach the backend at ${API_BASE_URL}. Start it with start_backend.bat ` +
  '(or: cd backend && uvicorn app.main:app --reload --port 8000).'

export function buildUrl(path, params) {
  const url = new URL(API_BASE_URL + path)
  Object.entries(params || {}).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== '') url.searchParams.set(key, value)
  })
  return url.toString()
}

function tryParseJson(text) {
  try {
    return JSON.parse(text)
  } catch {
    return undefined
  }
}

/**
 * Send one HTTP request and return everything the inspector panels need:
 * the exact request, status, timing, headers and body.
 */
export async function sendRequest({ method = 'GET', path, params, headers = {}, data }) {
  const url = buildUrl(path, params)
  const body = data === undefined ? undefined : typeof data === 'string' ? data : JSON.stringify(data, null, 2)
  const request = { method, url, path, headers, body }
  const started = performance.now()
  try {
    const res = await http.request({
      method,
      url,
      headers,
      data: body,
      transformResponse: [(raw) => raw], // keep the raw text; parse below
      responseType: 'text',
    })
    const durationMs = Math.round(performance.now() - started)
    const rawText = typeof res.data === 'string' ? res.data : ''
    const contentType = res.headers['content-type'] || ''
    return {
      request,
      response: {
        status: res.status,
        statusText: res.statusText,
        headers: { ...res.headers },
        rawText,
        data: contentType.includes('json') ? tryParseJson(rawText) : undefined,
        contentType,
        durationMs,
        sizeBytes: new Blob([rawText]).size,
      },
    }
  } catch (error) {
    return {
      request,
      response: null,
      networkError: error.code === 'ECONNABORTED' ? 'The request timed out.' : OFFLINE_MESSAGE,
      durationMs: Math.round(performance.now() - started),
    }
  }
}

/** Simple JSON GET for the UI's own data needs (dashboard, logs...). Throws on failure. */
export async function getJson(path, params) {
  let res
  try {
    res = await http.get(path, { params })
  } catch {
    throw new Error(OFFLINE_MESSAGE)
  }
  if (res.status >= 400) throw new Error(res.data?.detail || `Request failed with status ${res.status}`)
  return res.data
}

export const api = {
  health: () => getJson('/api/v1/health'),
  overview: () => getJson('/api/v1/demo/overview'),
  demoAccounts: () => getJson('/api/v1/demo/accounts'),
  logs: (params) => getJson('/api/v1/logs', params),
  openApi: () => getJson('/openapi.json'),
  async wsdl() {
    const res = await http.get('/soap', { params: { wsdl: '' }, responseType: 'text', transformResponse: [(d) => d] })
    return res.data
  },
  clearLogs: () => sendRequest({ method: 'DELETE', path: '/api/v1/logs' }),
  resetDemo: () => sendRequest({ method: 'POST', path: '/api/v1/demo/reset' }),
  resetRateLimit: () => sendRequest({ method: 'POST', path: '/api/v1/demo/rate-limit/reset' }),
}

export const DOCS_URLS = {
  swagger: `${API_BASE_URL}/api-docs`,
  redoc: `${API_BASE_URL}/redoc`,
  openapi: `${API_BASE_URL}/openapi.json`,
  wsdl: `${API_BASE_URL}/soap?wsdl`,
  soap: `${API_BASE_URL}/soap`,
}
