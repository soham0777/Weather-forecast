import { useEffect, useState } from 'react'
import { api } from '../services/api'

/** Polls GET /api/v1/health so the header can show "System Operational". */
export default function useHealth(intervalMs = 15000) {
  const [state, setState] = useState({ status: 'checking', data: null })

  useEffect(() => {
    let cancelled = false
    async function check() {
      try {
        const data = await api.health()
        if (!cancelled) setState({ status: data.status === 'UP' ? 'up' : 'degraded', data })
      } catch {
        if (!cancelled) setState({ status: 'down', data: null })
      }
    }
    check()
    const timer = setInterval(check, intervalMs)
    return () => {
      cancelled = true
      clearInterval(timer)
    }
  }, [intervalMs])

  return state
}
