const API = import.meta.env.VITE_API_URL || 'http://localhost:5000/api'

// Helper to get auth token from localStorage
const getAuthHeaders = () => {
  const token = localStorage.getItem('dtm_token')
  return token ? { Authorization: `Bearer ${token}` } : {}
}

// Helper for authenticated requests
async function request(path, options = {}) {
  const res = await fetch(`${API}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...getAuthHeaders(),
      ...options.headers,
    },
  })
  if (!res.ok) {
    const error = await res.json().catch(() => ({ error: `API ${res.status}` }))
    throw new Error(error.error || `API ${res.status}: ${path}`)
  }
  return res.json()
}

export const api = {
  // ====================
  // Authentication
  // ====================
  signup: (name, email, password) =>
    fetch(`${API}/auth/signup`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, email, password }),
    }).then(r => r.json()),

  login: (email, password) =>
    fetch(`${API}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    }).then(r => r.json()),

  getCurrentUser: () => request('/auth/me'),

  logout: () => {
    localStorage.removeItem('dtm_token')
  },

  // ====================
  // Metadata
  // ====================
  getTimeBounds: () => request('/meta/time-bounds'),
  triggerForecast: () => fetch(`${API}/meta/trigger-forecast`, { method: 'POST' }).then(r => r.json()),

  // ====================
  // Datasets
  // ====================
  getDatasets: () => request('/datasets'),

  // ====================
  // Snapshots
  // ====================
  getSnapshots: (datasetId, from, to) => {
    const params = new URLSearchParams()
    if (from) params.set('from', from)
    if (to) params.set('to', to)
    const qs = params.toString()
    return request(`/datasets/${datasetId}/snapshots${qs ? '?' + qs : ''}`)
  },

  // ====================
  // Events
  // ====================
  getEvents: () => request('/events'),
  getDatasetEvents: (datasetId) => request(`/datasets/${datasetId}/events`),
  explainEvent: (eventId) => request(`/events/${eventId}/explain`),

  // Flagged events (requires auth)
  getFlaggedEvents: () => request('/events/flagged'),

  // Flag/unflag an event (requires auth)
  flagEvent: (eventId, requestAI = false) =>
    request(`/events/${eventId}/flag`, {
      method: 'POST',
      body: JSON.stringify({ requestAI }),
    }),

  updateEventNote: (eventId, text) =>
    request(`/events/${eventId}/note`, {
      method: 'POST',
      body: JSON.stringify({ text }),
    }),

  // ====================
  // Manual operations
  // ====================
  fetchNow: (datasetId) =>
    fetch(`${API}/fetch-now/${datasetId}`, { method: 'POST' }).then(r => r.json()),

  // ====================
  // Exports
  // ====================
  exportCSV: (datasetId) => `${API}/datasets/${datasetId}/export`,
}

