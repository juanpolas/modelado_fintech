export type QualLevel = 'very_low' | 'low' | 'medium' | 'high' | 'very_high'

export type Archetype = {
  id: string
  name: string
  description: string
  trust_level: QualLevel
  interest_rate_sensitivity: QualLevel
  promotion_sensitivity: QualLevel
  crypto_affinity: QualLevel
  rumor_sensitivity: QualLevel
  reaction_speed: QualLevel
  balance_bucket: 'low' | 'mid' | 'high'
  liquidity_preference: QualLevel
  risk_aversion: QualLevel
  income_stability: QualLevel
  macro_anxiety: QualLevel
  behavioral_prompt_template: string
  origin?: 'default' | 'twitter' | 'custom'
  reaction_patterns?: Record<string, string>
}

export type Scenario = {
  id: string
  name: string
  description: string
  default_country_context: Record<string, QualLevel>
  default_company_context: Record<string, QualLevel>
  notes?: string
  event_timeline?: Array<Record<string, unknown>>
}

export type SimulationPayload = {
  scenario_id?: string | null
  scenario_name: string
  num_agents: number
  num_steps: number
  seed: number
  monte_carlo_runs: number
  report_language?: 'es' | 'en'
  archetype_mix: Record<string, number>
  country_context: Record<string, QualLevel>
  company_context: Record<string, QualLevel>
}

export type RunRecord = {
  id: string
  created_at: string
  config: SimulationPayload
  outputs: {
    single_run: {
      estimated_total_system_funds?: number
      estimated_migration_of_funds: number
      migration_vs_total_pct?: number
      churn_proxy: number
      liquidity_stress_proxy: number
      promo_abuse_risk_proxy: number
      trust_deterioration_proxy: number
      panic_index_score?: number
      panic_index_label?: 'Normal' | 'Alert' | 'Stressed' | 'Panic'
      panic_index_components?: Record<string, unknown>
      panic_index_main_driver?: string
      final_action_distribution: Record<string, number>
      archetype_level_breakdown: Record<string, Record<string, number>>
      timeline: Array<{
        step: number
        churn_proxy: number
        trust_deterioration_proxy: number
        liquidity_stress_proxy: number
      }>
    }
    monte_carlo?: unknown
  }
  tactical_recommendations: {
    tactical_actions?: Array<{ title: string; why?: string; category?: string }>
    risk_mitigation?: string[]
    source?: 'llm' | 'heuristic'
  }
  disruptive_recommendations: {
    innovation_lab?: Array<{ idea: string; inspiration?: string; fit?: string; disruptiveness?: string }>
    source?: 'llm' | 'heuristic'
  }
}

export type TwitterFetchResponse = {
  source_type: 'twitter'
  source_name: string
  fetched_at: string
  query: string
  start_time?: string
  end_time?: string
  raw_count: number
  relevant_count?: number
  noise_count?: number
  noise_sample?: Array<{
    id?: string
    text: string
    author?: string
    username?: string
    created_at?: string
    url?: string
    lang?: string
  }>
  warning?: string
  error?: string
  tweets: Array<{
    id?: string
    text: string
    author?: string
    username?: string
    verified?: boolean
    created_at?: string
    lang?: string
    url?: string
    metrics?: Record<string, number>
  }>
}

export type TwitterAnalyzeResponse = {
  source_type: 'twitter'
  source_name: string
  fetched_at: string
  query?: string
  dominant_narratives: Array<[string, number]>
  severity: QualLevel
  affected_archetypes: string[]
  behavioral_impact_vector: Record<string, QualLevel>
  country_context_adjustment: Record<string, QualLevel>
  company_context_adjustment: Record<string, QualLevel>
  tweet_sample: Array<{
    id?: string
    text: string
    author?: string
    username?: string
    verified?: boolean
    created_at?: string
    lang?: string
    url?: string
    metrics?: Record<string, number>
  }>
  raw_count: number
  relevant_count?: number
  noise_count?: number
  noise_sample?: Array<{
    id?: string
    text: string
    author?: string
    username?: string
    created_at?: string
    url?: string
    lang?: string
  }>
}

export type NewsArticle = {
  source: string
  title: string
  summary?: string
  url: string
  published_at?: string
  category?: string
  raw_text_excerpt?: string
  event_type?: string
  severity?: QualLevel
  transmission_channels?: string[]
  argentina_impact_vector?: Record<string, QualLevel>
  company_impact_vector?: Record<string, QualLevel>
  affected_archetypes?: string[]
}

export type NewsFetchResponse = {
  source_type: 'news'
  source_name: string
  fetched_at: string
  source_status: Array<{ source: string; method: string; count: number; error?: string }>
  articles: NewsArticle[]
  raw_count: number
}

export type NewsAnalyzeResponse = {
  source_type: 'news'
  source_name: string
  fetched_at: string
  recognized_sources: string[]
  severity: QualLevel
  dominant_narratives: Array<[string, number]>
  articles: NewsArticle[]
  country_context_adjustment: Record<string, QualLevel>
  company_context_adjustment: Record<string, QualLevel>
  affected_archetypes: string[]
  raw_count: number
}

export type FusedSignalsResponse = {
  id: string
  source_type: 'fusion'
  source_name: string
  fetched_at: string
  severity: QualLevel
  dominant_narratives: Array<[string, number]>
  affected_archetypes: string[]
  country_context_adjustment: Record<string, QualLevel>
  company_context_adjustment: Record<string, QualLevel>
  review_required: boolean
  dedupe_policy: string
  inputs: { twitter_count: number; news_count: number }
}

export type SignalRecord = {
  _meta: {
    id: string
    source_type: string
    source_name: string
    fetched_at: string
  }
  [key: string]: unknown
}
