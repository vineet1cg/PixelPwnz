import axios from 'axios'

// Centralized API wrapper for the frontend.
const api = axios.create({
  baseURL: 'http://localhost:5000/api',
})

// Always return clean JSON (response.data).
export async function getDatasets() {
  const res = await api.get('/datasets')
  return res.data
}

export async function getSnapshots(datasetId, from, to) {
  const res = await api.get('/snapshots', {
    params: { datasetId, from, to },
  })
  return res.data
}

export async function getEvents() {
  const res = await api.get('/events')
  return res.data
}

