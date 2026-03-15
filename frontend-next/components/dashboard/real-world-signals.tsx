'use client'

import { useMemo, useState } from 'react'
import { Activity, AlertTriangle, Newspaper, RefreshCw, Sparkles, Twitter } from 'lucide-react'
import { motion } from 'framer-motion'
import { api } from '@/lib/api'
import { QUAL_LEVELS } from '@/lib/constants'
import type {
  FusedSignalsResponse,
  NewsAnalyzeResponse,
  NewsFetchResponse,
  QualLevel,
  TwitterAnalyzeResponse,
  TwitterFetchResponse,
} from '@/types'
import { Badge, Button, Card, Input, SectionTitle, Select } from '@/components/ui/primitives'

const TWITTER_PRESETS = [
  '(argentina OR "dolar blue" OR devaluacion OR inflacion OR bancos OR fintech OR "mercado pago" OR "naranja x" OR "uala") lang:es -is:retweet',
  '("bitcoin argentina" OR stablecoins OR "crypto argentina" OR "comprar usdt") lang:es -is:retweet',
  '(cashback OR promos OR "promo bancaria" OR "tarjeta virtual") argentina lang:es -is:retweet',
  '("retiro de fondos" OR corralito OR bancos OR "no puedo retirar") argentina lang:es -is:retweet',
]

type SignalsProps = {
  lang: 'es' | 'en'
  initialCountryContext: Record<string, QualLevel>
  initialCompanyContext: Record<string, QualLevel>
  onApply: (country: Record<string, QualLevel>, company: Record<string, QualLevel>) => void
  onError: (message: string) => void
}

type SignalTab = 'twitter' | 'news' | 'fused'

function severityClass(level?: string) {
  if (level === 'very_high') return 'bg-red-500/15 text-red-600 dark:text-red-300 border-red-400/40'
  if (level === 'high') return 'bg-orange-500/15 text-orange-600 dark:text-orange-300 border-orange-400/40'
  if (level === 'medium') return 'bg-amber-500/15 text-amber-700 dark:text-amber-300 border-amber-400/40'
  if (level === 'low') return 'bg-blue-500/15 text-blue-600 dark:text-blue-300 border-blue-400/40'
  return 'bg-slate-500/15 text-slate-600 dark:text-slate-300 border-slate-400/40'
}

function ImpactBar({ label, value }: { label: string; value: QualLevel }) {
  const widthMap: Record<QualLevel, string> = {
    very_low: 'w-[20%]',
    low: 'w-[40%]',
    medium: 'w-[60%]',
    high: 'w-[80%]',
    very_high: 'w-full',
  }
  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between text-xs">
        <span className="text-slate-500 dark:text-slate-400">{label}</span>
        <span className="font-medium">{value}</span>
      </div>
      <div className="h-2 rounded-full bg-muted">
        <div className={`h-2 rounded-full bg-primary ${widthMap[value]}`} />
      </div>
    </div>
  )
}

export function RealWorldSignals({
  lang,
  initialCountryContext,
  initialCompanyContext,
  onApply,
  onError,
}: SignalsProps) {
  const [tab, setTab] = useState<SignalTab>('twitter')
  const [loading, setLoading] = useState(false)
  const [query, setQuery] = useState(TWITTER_PRESETS[0])
  const [maxResults, setMaxResults] = useState(50)

  const [twitterFetched, setTwitterFetched] = useState<TwitterFetchResponse | null>(null)
  const [twitterAnalyzed, setTwitterAnalyzed] = useState<TwitterAnalyzeResponse | null>(null)

  const [newsFetched, setNewsFetched] = useState<NewsFetchResponse | null>(null)
  const [newsAnalyzed, setNewsAnalyzed] = useState<NewsAnalyzeResponse | null>(null)

  const [fused, setFused] = useState<FusedSignalsResponse | null>(null)
  const [editableCountry, setEditableCountry] = useState<Record<string, QualLevel>>({})
  const [editableCompany, setEditableCompany] = useState<Record<string, QualLevel>>({})

  const effectiveCountry = useMemo(
    () => (Object.keys(editableCountry).length ? editableCountry : initialCountryContext),
    [editableCountry, initialCountryContext]
  )
  const effectiveCompany = useMemo(
    () => (Object.keys(editableCompany).length ? editableCompany : initialCompanyContext),
    [editableCompany, initialCompanyContext]
  )

  async function refreshTwitter() {
    setLoading(true)
    try {
      const fetched = await api.fetchTwitterSignals({ query, max_results: maxResults })
      setTwitterFetched(fetched)
      const analyzed = await api.analyzeTwitterSignals({ fetched })
      setTwitterAnalyzed(analyzed)
    } catch (e) {
      onError((e as Error).message || 'Twitter fetch failed')
    } finally {
      setLoading(false)
    }
  }

  async function refreshNews() {
    setLoading(true)
    try {
      const fetched = await api.fetchNewsSignals({})
      setNewsFetched(fetched)
      const analyzed = await api.analyzeNewsSignals({ fetched })
      setNewsAnalyzed(analyzed)
    } catch (e) {
      onError((e as Error).message || 'News fetch failed')
    } finally {
      setLoading(false)
    }
  }

  async function runFusion() {
    setLoading(true)
    try {
      const out = await api.fuseSignals({
        twitter_analysis: twitterAnalyzed || undefined,
        news_analysis: newsAnalyzed || undefined,
        user_context: {
          country_context: effectiveCountry,
          company_context: effectiveCompany,
        },
      })
      setFused(out)
      setEditableCountry(out.country_context_adjustment)
      setEditableCompany(out.company_context_adjustment)
      setTab('fused')
    } catch (e) {
      onError((e as Error).message || 'Fusion failed')
    } finally {
      setLoading(false)
    }
  }

  return (
    <Card className="space-y-4">
      <SectionTitle
        title={lang === 'es' ? 'Señales del Mundo Real' : 'Real-World Signals'}
        subtitle={lang === 'es' ? 'Narrativas en vivo de X/Twitter + medios argentinos + contexto fusionado.' : 'Live X/Twitter narratives + Argentine news adapters + fused context modifiers.'}
      />

      <div className="flex flex-wrap gap-2">
        <Button variant={tab === 'twitter' ? 'default' : 'outline'} onClick={() => setTab('twitter')}>
          <Twitter className="h-4 w-4" /> {lang === 'es' ? 'Twitter/X en Vivo' : 'Twitter/X Live'}
        </Button>
        <Button variant={tab === 'news' ? 'default' : 'outline'} onClick={() => setTab('news')}>
          <Newspaper className="h-4 w-4" /> {lang === 'es' ? 'Noticias en Vivo' : 'News Live'}
        </Button>
        <Button variant={tab === 'fused' ? 'default' : 'outline'} onClick={() => setTab('fused')}>
          <Sparkles className="h-4 w-4" /> {lang === 'es' ? 'Contexto Fusionado' : 'Fused Context'}
        </Button>
      </div>

      {tab === 'twitter' ? (
        <div className="space-y-4">
          <div className="grid gap-3 md:grid-cols-[1fr_140px_auto_auto]">
            <Input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="X query" />
            <Input type="number" min={10} max={100} value={maxResults} onChange={(e) => setMaxResults(Number(e.target.value || 50))} />
            <Button variant="outline" onClick={refreshTwitter} disabled={loading}>
              <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} /> {lang === 'es' ? 'Traer + Analizar' : 'Fetch + Analyze'}
            </Button>
            <Select value={query} onChange={(e) => setQuery(e.target.value)}>
              {TWITTER_PRESETS.map((preset) => (
                <option key={preset} value={preset}>
                  Preset query
                </option>
              ))}
            </Select>
          </div>

          {twitterAnalyzed ? (
            <>
              <div className="flex flex-wrap items-center gap-2">
              <Badge className={severityClass(twitterAnalyzed.severity)}>{lang === 'es' ? 'severidad' : 'severity'}: {twitterAnalyzed.severity}</Badge>
                <Badge>{lang === 'es' ? 'tweets' : 'tweets'}: {twitterAnalyzed.raw_count}</Badge>
                {twitterFetched?.warning ? <Badge className="border-red-300 text-red-600">{twitterFetched.warning}</Badge> : null}
              </div>

              <div className="grid gap-2 md:grid-cols-2">
                {twitterAnalyzed.dominant_narratives.slice(0, 8).map(([name, count]) => (
                  <Badge key={name} className="justify-between px-3 py-2 text-xs">
                    <span>{name.replaceAll('_', ' ')}</span>
                    <span>{count}</span>
                  </Badge>
                ))}
              </div>

              <div className="grid gap-2 md:grid-cols-2">
                {(twitterAnalyzed.tweet_sample || []).slice(0, 8).map((t) => (
                  <motion.a
                    key={`${t.id}-${t.text.slice(0, 12)}`}
                    href={t.url || '#'}
                    target="_blank"
                    rel="noreferrer"
                    whileHover={{ y: -2 }}
                    className="rounded-xl border border-border bg-muted/40 p-3 text-sm"
                  >
                    <div className="mb-1 flex items-center justify-between gap-2">
                      <span className="font-medium">{t.author || t.username || 'unknown'}</span>
                      <span className="text-xs text-slate-500">{(t.created_at || '').slice(0, 19).replace('T', ' ')}</span>
                    </div>
                    <p className="line-clamp-3 text-slate-600 dark:text-slate-300">{t.text}</p>
                  </motion.a>
                ))}
              </div>
            </>
          ) : null}
        </div>
      ) : null}

      {tab === 'news' ? (
        <div className="space-y-4">
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" onClick={refreshNews} disabled={loading}>
              <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} /> {lang === 'es' ? 'Traer + Analizar Noticias' : 'Fetch + Analyze News'}
            </Button>
            <Button variant="outline" onClick={runFusion} disabled={loading || (!twitterAnalyzed && !newsAnalyzed)}>
              <Sparkles className="h-4 w-4" /> {lang === 'es' ? 'Construir Contexto Fusionado' : 'Build Fused Context'}
            </Button>
          </div>

          {newsFetched ? (
            <div className="rounded-xl border border-border p-3 text-sm">
              <div className="mb-2 font-medium">{lang === 'es' ? 'Salud de Fuentes' : 'Source Health'}</div>
              <div className="flex flex-wrap gap-2">
                {newsFetched.source_status.slice(0, 30).map((s) => (
                  <Badge key={s.source} className={s.count > 0 ? 'border-green-400/40 text-green-600 dark:text-green-300' : 'border-red-400/40 text-red-600 dark:text-red-300'}>
                    {s.source}: {s.count}
                  </Badge>
                ))}
              </div>
            </div>
          ) : null}

          {newsAnalyzed ? (
            <>
              <div className="flex flex-wrap gap-2">
                <Badge className={severityClass(newsAnalyzed.severity)}>{lang === 'es' ? 'severidad' : 'severity'}: {newsAnalyzed.severity}</Badge>
                <Badge>{lang === 'es' ? 'artículos' : 'articles'}: {newsAnalyzed.raw_count}</Badge>
                <Badge>{lang === 'es' ? 'fuentes reconocidas' : 'recognized sources'}: {newsAnalyzed.recognized_sources.length}</Badge>
              </div>

              <div className="grid gap-2 md:grid-cols-2">
                {newsAnalyzed.articles.slice(0, 12).map((a) => (
                  <motion.a
                    key={`${a.source}-${a.title}`}
                    href={a.url}
                    target="_blank"
                    rel="noreferrer"
                    whileHover={{ y: -2 }}
                    className="rounded-xl border border-border bg-muted/40 p-3"
                  >
                    <div className="mb-2 flex flex-wrap items-center gap-2">
                      <Badge>{a.source}</Badge>
                      {a.event_type ? <Badge>{a.event_type}</Badge> : null}
                      {a.severity ? <Badge className={severityClass(a.severity)}>sev: {a.severity}</Badge> : null}
                    </div>
                    <p className="mb-2 line-clamp-2 text-sm font-medium">{a.title}</p>
                    {a.transmission_channels?.length ? (
                      <div className="flex flex-wrap gap-1">
                        {a.transmission_channels.slice(0, 4).map((ch) => (
                          <Badge key={ch} className="text-[10px]">
                            {ch}
                          </Badge>
                        ))}
                      </div>
                    ) : null}
                  </motion.a>
                ))}
              </div>
            </>
          ) : null}
        </div>
      ) : null}

      {tab === 'fused' ? (
        <div className="space-y-4">
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" onClick={runFusion} disabled={loading || (!twitterAnalyzed && !newsAnalyzed)}>
              <Activity className="h-4 w-4" /> {lang === 'es' ? 'Actualizar Fusión' : 'Refresh Fusion'}
            </Button>
            <Button variant="outline" onClick={() => onApply(editableCountry, editableCompany)} disabled={!fused}>
              {lang === 'es' ? 'Aplicar a Nueva Simulación' : 'Apply to New Simulation'}
            </Button>
            <Button variant="outline" onClick={async () => { setLoading(true); try { await api.refreshSignals(); await refreshTwitter(); await refreshNews(); await runFusion(); } catch (e) { onError((e as Error).message) } finally { setLoading(false) } }} disabled={loading}>
              <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} /> {lang === 'es' ? 'Refresh Manual' : 'Manual Refresh'}
            </Button>
          </div>

          {fused ? (
            <>
              <div className="flex flex-wrap gap-2">
                <Badge className={severityClass(fused.severity)}>{lang === 'es' ? 'severidad' : 'severity'}: {fused.severity}</Badge>
                <Badge>{lang === 'es' ? 'señales twitter' : 'twitter signals'}: {fused.inputs.twitter_count}</Badge>
                <Badge>{lang === 'es' ? 'señales noticias' : 'news signals'}: {fused.inputs.news_count}</Badge>
                <Badge>{fused.dedupe_policy}</Badge>
              </div>

              <div className="grid gap-2 md:grid-cols-2">
                {fused.dominant_narratives.map(([name, score]) => (
                  <Badge key={name} className="justify-between px-3 py-2 text-xs">
                    <span>{name.replaceAll('_', ' ')}</span>
                    <span>{score.toFixed(1)}</span>
                  </Badge>
                ))}
              </div>

              <div className="rounded-xl border border-border p-3">
                <div className="mb-2 flex items-center gap-2 text-sm font-medium">
                  <AlertTriangle className="h-4 w-4 text-amber-500" /> {lang === 'es' ? 'Arquetipos afectados' : 'Affected archetypes'}
                </div>
                <div className="flex flex-wrap gap-2">
                  {fused.affected_archetypes.map((a) => (
                    <Badge key={a}>{a}</Badge>
                  ))}
                </div>
              </div>

              <div className="grid gap-4 lg:grid-cols-2">
                <Card className="space-y-2">
                  <SectionTitle title={lang === 'es' ? 'Impacto País' : 'Country Impact'} />
                  {Object.entries(editableCountry).map(([k, v]) => (
                    <div key={k} className="grid gap-2 sm:grid-cols-[1fr_140px] sm:items-center">
                      <ImpactBar label={k} value={v} />
                      <Select value={v} onChange={(e) => setEditableCountry((prev) => ({ ...prev, [k]: e.target.value as QualLevel }))}>
                        {QUAL_LEVELS.map((q) => (
                          <option key={q} value={q}>
                            {q}
                          </option>
                        ))}
                      </Select>
                    </div>
                  ))}
                </Card>

                <Card className="space-y-2">
                  <SectionTitle title={lang === 'es' ? 'Impacto Compañía' : 'Company Impact'} />
                  {Object.entries(editableCompany).map(([k, v]) => (
                    <div key={k} className="grid gap-2 sm:grid-cols-[1fr_140px] sm:items-center">
                      <ImpactBar label={k} value={v} />
                      <Select value={v} onChange={(e) => setEditableCompany((prev) => ({ ...prev, [k]: e.target.value as QualLevel }))}>
                        {QUAL_LEVELS.map((q) => (
                          <option key={q} value={q}>
                            {q}
                          </option>
                        ))}
                      </Select>
                    </div>
                  ))}
                </Card>
              </div>
            </>
          ) : (
            <p className="text-sm text-slate-500 dark:text-slate-400">
              {lang === 'es'
                ? 'Primero corré el análisis de Twitter y Noticias, luego construí el contexto fusionado.'
                : 'Run Twitter and News analysis first, then build fused context.'}
            </p>
          )}
        </div>
      ) : null}
    </Card>
  )
}
