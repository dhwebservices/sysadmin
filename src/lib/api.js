const API_BASE = import.meta.env.VITE_SYSADMIN_API_URL || ''

function buildUrl(path) {
  if (!API_BASE) {
    throw new Error('Missing VITE_SYSADMIN_API_URL.')
  }
  return `${API_BASE}${path}`
}

async function request(path, token, options = {}) {
  const res = await fetch(buildUrl(path), {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(options.headers || {}),
    },
  })
  const text = await res.text()
  const body = text ? JSON.parse(text) : null
  if (!res.ok) {
    throw new Error(body?.error || body?.message || `Request failed (${res.status})`)
  }
  return body
}

export function apiGet(path, token) {
  return request(path, token)
}

export function apiPost(path, token, payload) {
  return request(path, token, {
    method: 'POST',
    body: JSON.stringify(payload || {}),
  })
}
