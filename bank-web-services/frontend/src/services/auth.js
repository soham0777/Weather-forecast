/**
 * DEMO AUTHENTICATION helper.
 *
 * Gets OAuth 2.0 access tokens (client credentials grant) from the backend
 * and caches them until shortly before they expire.
 */
import { DEMO_CLIENTS } from '../data/demoClients'
import { http, OFFLINE_MESSAGE } from './api'

const cache = new Map() // clientId -> { token, scope, expiresAt }

export async function getToken(clientId, { force = false } = {}) {
  const client = DEMO_CLIENTS.find((c) => c.id === clientId)
  if (!client || !client.clientSecret) return null

  const cached = cache.get(clientId)
  if (!force && cached && cached.expiresAt - Date.now() > 60_000) return cached

  const form = new URLSearchParams({
    grant_type: 'client_credentials',
    client_id: client.id,
    client_secret: client.clientSecret,
  })
  let res
  try {
    res = await http.post('/api/v1/oauth/token', form, {
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    })
  } catch {
    throw new Error(OFFLINE_MESSAGE)
  }
  if (res.status !== 200) {
    throw new Error(res.data?.error_description || `Token request failed (${res.status})`)
  }
  const entry = {
    token: res.data.access_token,
    scope: res.data.scope,
    expiresAt: Date.now() + res.data.expires_in * 1000,
  }
  cache.set(clientId, entry)
  return entry
}

/** Decode (NOT verify) a JWT so its claims can be shown for learning purposes. */
export function decodeJwt(token) {
  try {
    const [header, payload] = token.split('.').slice(0, 2).map((part) => {
      const base64 = part.replace(/-/g, '+').replace(/_/g, '/')
      return JSON.parse(atob(base64.padEnd(base64.length + ((4 - (base64.length % 4)) % 4), '=')))
    })
    return { header, payload }
  } catch {
    return null
  }
}
