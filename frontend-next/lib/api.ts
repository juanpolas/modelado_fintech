import type {
  Archetype,
  FusedSignalsResponse,
  NewsAnalyzeResponse,
  NewsFetchResponse,
  RunRecord,
  Scenario,
  SignalRecord,
  SimulationPayload,
  TwitterAnalyzeResponse,
  TwitterFetchResponse,
} from '@/types'

const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:8000'

async function req<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      ...(init?.headers || {}),
    },
    credentials: 'include',
    cache: 'no-store',
  })

  if (!res.ok) {
    let msg = `Request failed (${res.status})`
    try {
      const body = await res.json()
      msg = body.detail || JSON.stringify(body)
    } catch {}
    throw new Error(msg)
  }

  return (await res.json()) as T
}

export const api = {
  authStatus: () => req<{ authorized: boolean }>('/auth/status'),
  login: (code: string) => req<{ ok: boolean }>('/auth/login', { method: 'POST', body: JSON.stringify({ code }) }),
  logout: () => req<{ ok: boolean }>('/auth/logout', { method: 'POST' }),

  archetypes: () => req<Archetype[]>('/archetypes'),
  createArchetype: (payload: Archetype) => req<Archetype>('/archetypes', { method: 'POST', body: JSON.stringify(payload) }),
  updateArchetype: (id: string, payload: Archetype) =>
    req<Archetype>(`/archetypes/${id}`, { method: 'PUT', body: JSON.stringify(payload) }),
  deleteArchetype: (id: string) => req<{ deleted: boolean }>(`/archetypes/${id}`, { method: 'DELETE' }),

  scenarios: () => req<Scenario[]>('/scenarios'),
  createScenario: (payload: Scenario) => req<Scenario>('/scenarios', { method: 'POST', body: JSON.stringify(payload) }),
  updateScenario: (id: string, payload: Scenario) => req<Scenario>(`/scenarios/${id}`, { method: 'PUT', body: JSON.stringify(payload) }),
  deleteScenario: (id: string) => req<{ deleted: boolean }>(`/scenarios/${id}`, { method: 'DELETE' }),

  runs: () => req<RunRecord[]>('/runs'),
  runById: (id: string) => req<RunRecord>(`/runs/${id}`),
  duplicateRun: (id: string) => req<RunRecord>(`/runs/${id}/duplicate`, { method: 'POST' }),

  simulate: (payload: SimulationPayload) => req<RunRecord>('/simulate', { method: 'POST', body: JSON.stringify(payload) }),
  translateScenario: (text: string) => req<{ country_context: Record<string, string>; company_context: Record<string, string> }>(
    '/translate-scenario',
    { method: 'POST', body: JSON.stringify({ text }) }
  ),
  impactTranslate: (text: string) =>
    req<{ country_context: Record<string, string>; company_context: Record<string, string> }>('/impact-translate', {
      method: 'POST',
      body: JSON.stringify({ text }),
    }),

  settings: () => req<Record<string, unknown>>('/settings'),
  saveSettings: (payload: Record<string, unknown>) => req<Record<string, unknown>>('/settings', { method: 'PUT', body: JSON.stringify(payload) }),

  fetchTwitterSignals: (payload?: {
    query?: string
    max_results?: number
    start_time?: string
    end_time?: string
  }) => req<TwitterFetchResponse>('/signals/twitter/fetch', { method: 'POST', body: JSON.stringify(payload || {}) }),
  analyzeTwitterSignals: (payload?: { fetched?: TwitterFetchResponse; query?: string }) =>
    req<TwitterAnalyzeResponse>('/signals/twitter/analyze', { method: 'POST', body: JSON.stringify(payload || {}) }),

  fetchNewsSignals: (payload?: { sources?: string[] }) =>
    req<NewsFetchResponse>('/signals/news/fetch', { method: 'POST', body: JSON.stringify(payload || {}) }),
  analyzeNewsSignals: (payload?: { fetched?: NewsFetchResponse; sources?: string[] }) =>
    req<NewsAnalyzeResponse>('/signals/news/analyze', { method: 'POST', body: JSON.stringify(payload || {}) }),

  fuseSignals: (payload: {
    twitter_analysis?: TwitterAnalyzeResponse
    news_analysis?: NewsAnalyzeResponse
    user_context?: {
      country_context?: Record<string, string>
      company_context?: Record<string, string>
      affected_archetypes?: string[]
    }
  }) => req<FusedSignalsResponse>('/signals/fuse', { method: 'POST', body: JSON.stringify(payload) }),
  recentSignals: (sourceType?: string, limit = 50) =>
    req<SignalRecord[]>(`/signals/recent?${new URLSearchParams({ ...(sourceType ? { source_type: sourceType } : {}), limit: String(limit) }).toString()}`),
  refreshSignals: () => req<{ ok: boolean; fused: FusedSignalsResponse }>('/signals/refresh', { method: 'POST' }),
}
