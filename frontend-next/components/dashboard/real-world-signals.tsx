'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
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

type SavedTwitterSearch = {
  id: string
  name: string
  include_terms: string[]
  geo_terms: string[]
  exclude_terms: string[]
  lang: string
  exclude_retweet: boolean
  exclude_reply: boolean
  require_links: boolean
}

const TWITTER_PRESETS = [
  '((dolar blue OR devaluacion OR inflacion OR bcra OR bancos OR fintech OR mercado pago OR uala OR naranja x OR corralito OR retiro de fondos OR stablecoin OR usdt OR bitcoin argentina OR cashback OR promo) (argentina OR ar)) lang:es -is:retweet -is:reply -has:links -futbol -amistoso -uefa -conmebol -mundial -piñon -españa -dominicanos',
  '((bitcoin argentina OR stablecoins OR usdt OR cripto OR crypto) (argentina OR ar)) lang:es -is:retweet -is:reply',
  '((cashback OR promo OR promos OR billetera OR wallet yield) (argentina OR ar)) lang:es -is:retweet -is:reply',
  '((retiro de fondos OR corralito OR corrida bancaria OR no puedo retirar) (argentina OR ar)) lang:es -is:retweet -is:reply',
]

type SignalsProps = {
  lang: 'es' | 'en'
  initialCountryContext: Record<string, QualLevel>
  initialCompanyContext: Record<string, QualLevel>
  onApply: (country: Record<string, QualLevel>, company: Record<string, QualLevel>) => void
  onError: (message: string) => void
  autoLoadOnMount?: boolean
  syncOnChange?: boolean
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
  autoLoadOnMount = false,
  syncOnChange = false,
}: SignalsProps) {
  const bootstrappedRef = useRef(false)
  const [tab, setTab] = useState<SignalTab>('twitter')
  const [loading, setLoading] = useState(false)
  const [query, setQuery] = useState(TWITTER_PRESETS[0])
  const [maxResults, setMaxResults] = useState(50)
  const [includeTerms, setIncludeTerms] = useState<string[]>([
    'dolar blue',
    'devaluacion',
    'inflacion',
    'bcra',
    'bancos',
    'fintech',
    'mercado pago',
    'uala',
    'naranja x',
    'corralito',
    'retiro de fondos',
    'stablecoin',
    'usdt',
    'bitcoin argentina',
    'cashback',
    'promo',
  ])
  const [geoTerms, setGeoTerms] = useState<string[]>(['argentina', 'ar'])
  const [excludeTerms, setExcludeTerms] = useState<string[]>([
    'futbol',
    'amistoso',
    'uefa',
    'conmebol',
    'mundial',
    'piñon',
    'españa',
    'dominicanos',
  ])
  const [langCode, setLangCode] = useState('es')
  const [excludeRetweet, setExcludeRetweet] = useState(true)
  const [excludeReply, setExcludeReply] = useState(true)
  const [requireLinks, setRequireLinks] = useState(true)
  const [newInclude, setNewInclude] = useState('')
  const [newGeo, setNewGeo] = useState('')
  const [newExclude, setNewExclude] = useState('')
  const [savedSearches, setSavedSearches] = useState<SavedTwitterSearch[]>([])
  const [selectedSavedId, setSelectedSavedId] = useState('')
  const [newSearchName, setNewSearchName] = useState('')

  const [twitterFetched, setTwitterFetched] = useState<TwitterFetchResponse | null>(null)
  const [twitterAnalyzed, setTwitterAnalyzed] = useState<TwitterAnalyzeResponse | null>(null)

  const [newsFetched, setNewsFetched] = useState<NewsFetchResponse | null>(null)
  const [newsAnalyzed, setNewsAnalyzed] = useState<NewsAnalyzeResponse | null>(null)

  const [fused, setFused] = useState<FusedSignalsResponse | null>(null)
  const [editableCountry, setEditableCountry] = useState<Record<string, QualLevel>>({})
  const [editableCompany, setEditableCompany] = useState<Record<string, QualLevel>>({})
  const [selectedCountryKeys, setSelectedCountryKeys] = useState<Record<string, boolean>>({})
  const [selectedCompanyKeys, setSelectedCompanyKeys] = useState<Record<string, boolean>>({})

  const effectiveCountry = useMemo(
    () => (Object.keys(editableCountry).length ? editableCountry : initialCountryContext),
    [editableCountry, initialCountryContext]
  )
  const effectiveCompany = useMemo(
    () => (Object.keys(editableCompany).length ? editableCompany : initialCompanyContext),
    [editableCompany, initialCompanyContext]
  )
  const appliedCountry = useMemo(
    () =>
      Object.fromEntries(
        Object.entries(editableCountry).filter(([k]) => selectedCountryKeys[k] !== false)
      ) as Record<string, QualLevel>,
    [editableCountry, selectedCountryKeys]
  )
  const appliedCompany = useMemo(
    () =>
      Object.fromEntries(
        Object.entries(editableCompany).filter(([k]) => selectedCompanyKeys[k] !== false)
      ) as Record<string, QualLevel>,
    [editableCompany, selectedCompanyKeys]
  )

  const builtQuery = useMemo(() => {
    const q = formatQueryParts(
      includeTerms,
      geoTerms,
      excludeTerms,
      langCode,
      excludeRetweet,
      excludeReply,
      requireLinks
    )
    return q
  }, [includeTerms, geoTerms, excludeTerms, langCode, excludeRetweet, excludeReply, requireLinks])

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

  useEffect(() => {
    setQuery(builtQuery)
  }, [builtQuery])

  useEffect(() => {
    ;(async () => {
      try {
        const st = await api.settings()
        const stored = Array.isArray(st.twitter_saved_searches) ? (st.twitter_saved_searches as SavedTwitterSearch[]) : []
        if (stored.length) setSavedSearches(stored)
      } catch {
        // ignore settings load errors in this panel
      }
    })()
  }, [])

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
      setSelectedCountryKeys(
        Object.fromEntries(Object.keys(out.country_context_adjustment).map((k) => [k, true]))
      )
      setSelectedCompanyKeys(
        Object.fromEntries(Object.keys(out.company_context_adjustment).map((k) => [k, true]))
      )
      setTab('fused')
    } catch (e) {
      onError((e as Error).message || 'Fusion failed')
    } finally {
      setLoading(false)
    }
  }

  async function persistSavedSearches(next: SavedTwitterSearch[]) {
    setSavedSearches(next)
    try {
      const st = await api.settings()
      await api.saveSettings({ ...st, twitter_saved_searches: next })
    } catch (e) {
      onError((e as Error).message || 'No se pudo guardar búsquedas')
    }
  }

  function addToken(value: string, setter: (next: string[]) => void, current: string[]) {
    const v = value.trim()
    if (!v) return
    if (current.some((x) => x.toLowerCase() === v.toLowerCase())) return
    setter([...current, v])
  }

  function removeToken(value: string, setter: (next: string[]) => void, current: string[]) {
    setter(current.filter((x) => x !== value))
  }

  function applySavedSearch(item: SavedTwitterSearch) {
    setIncludeTerms(item.include_terms || [])
    setGeoTerms(item.geo_terms || [])
    setExcludeTerms(item.exclude_terms || [])
    setLangCode(item.lang || 'es')
    setExcludeRetweet(item.exclude_retweet !== false)
    setExcludeReply(item.exclude_reply !== false)
    setRequireLinks(item.require_links !== false)
    setSelectedSavedId(item.id)
  }

  useEffect(() => {
    if (!autoLoadOnMount || bootstrappedRef.current) return
    bootstrappedRef.current = true
    ;(async () => {
      setLoading(true)
      try {
        const fetchedTw = await api.fetchTwitterSignals({ query, max_results: maxResults })
        setTwitterFetched(fetchedTw)
        const analyzedTw = await api.analyzeTwitterSignals({ fetched: fetchedTw })
        setTwitterAnalyzed(analyzedTw)

        const fetchedNw = await api.fetchNewsSignals({})
        setNewsFetched(fetchedNw)
        const analyzedNw = await api.analyzeNewsSignals({ fetched: fetchedNw })
        setNewsAnalyzed(analyzedNw)

        const out = await api.fuseSignals({
          twitter_analysis: analyzedTw,
          news_analysis: analyzedNw,
          user_context: {
            country_context: effectiveCountry,
            company_context: effectiveCompany,
          },
        })
        setFused(out)
        setEditableCountry(out.country_context_adjustment)
        setEditableCompany(out.company_context_adjustment)
        setSelectedCountryKeys(
          Object.fromEntries(Object.keys(out.country_context_adjustment).map((k) => [k, true]))
        )
        setSelectedCompanyKeys(
          Object.fromEntries(Object.keys(out.company_context_adjustment).map((k) => [k, true]))
        )
        setTab('fused')
      } catch (e) {
        onError((e as Error).message || 'Autoload failed')
      } finally {
        setLoading(false)
      }
    })()
  }, [autoLoadOnMount, effectiveCompany, effectiveCountry, maxResults, onError, query])

  useEffect(() => {
    if (!syncOnChange || !fused) return
    onApply(appliedCountry, appliedCompany)
  }, [syncOnChange, fused, appliedCountry, appliedCompany, onApply])

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
          <Card className="space-y-3">
            <SectionTitle
              title={lang === 'es' ? 'Constructor Dinámico de Query' : 'Dynamic Query Builder'}
              subtitle={lang === 'es' ? 'Agregá o quitá términos y guardá búsquedas reutilizables.' : 'Add or remove terms and save reusable searches.'}
            />

            <div className="grid gap-3 md:grid-cols-2">
              <div className="space-y-2">
                <p className="text-xs text-slate-400">{lang === 'es' ? 'Términos principales' : 'Main terms'}</p>
                <div className="flex gap-2">
                  <Input
                    value={newInclude}
                    onChange={(e) => setNewInclude(e.target.value)}
                    placeholder={lang === 'es' ? 'ej: fintech' : 'e.g. fintech'}
                  />
                  <Button
                    variant="outline"
                    onClick={() => {
                      addToken(newInclude, setIncludeTerms, includeTerms)
                      setNewInclude('')
                    }}
                  >
                    +
                  </Button>
                </div>
                <div className="flex flex-wrap gap-2">
                  {includeTerms.map((t) => (
                    <Badge key={t} className="cursor-pointer" onClick={() => removeToken(t, setIncludeTerms, includeTerms)} title={lang === 'es' ? 'Click para quitar' : 'Click to remove'}>
                      {t} ×
                    </Badge>
                  ))}
                </div>
              </div>

              <div className="space-y-2">
                <p className="text-xs text-slate-400">{lang === 'es' ? 'Términos geográficos' : 'Geo terms'}</p>
                <div className="flex gap-2">
                  <Input value={newGeo} onChange={(e) => setNewGeo(e.target.value)} placeholder={lang === 'es' ? 'ej: argentina' : 'e.g. argentina'} />
                  <Button
                    variant="outline"
                    onClick={() => {
                      addToken(newGeo, setGeoTerms, geoTerms)
                      setNewGeo('')
                    }}
                  >
                    +
                  </Button>
                </div>
                <div className="flex flex-wrap gap-2">
                  {geoTerms.map((t) => (
                    <Badge key={t} className="cursor-pointer" onClick={() => removeToken(t, setGeoTerms, geoTerms)} title={lang === 'es' ? 'Click para quitar' : 'Click to remove'}>
                      {t} ×
                    </Badge>
                  ))}
                </div>
              </div>

              <div className="space-y-2 md:col-span-2">
                <p className="text-xs text-slate-400">{lang === 'es' ? 'Términos excluidos (ruido)' : 'Excluded noise terms'}</p>
                <div className="flex gap-2">
                  <Input value={newExclude} onChange={(e) => setNewExclude(e.target.value)} placeholder={lang === 'es' ? 'ej: futbol' : 'e.g. football'} />
                  <Button
                    variant="outline"
                    onClick={() => {
                      addToken(newExclude, setExcludeTerms, excludeTerms)
                      setNewExclude('')
                    }}
                  >
                    +
                  </Button>
                </div>
                <div className="flex flex-wrap gap-2">
                  {excludeTerms.map((t) => (
                    <Badge key={t} className="cursor-pointer" onClick={() => removeToken(t, setExcludeTerms, excludeTerms)} title={lang === 'es' ? 'Click para quitar' : 'Click to remove'}>
                      {t} ×
                    </Badge>
                  ))}
                </div>
              </div>
            </div>

            <div className="grid gap-3 md:grid-cols-4">
              <Select value={langCode} onChange={(e) => setLangCode(e.target.value)}>
                <option value="es">lang:es</option>
                <option value="en">lang:en</option>
              </Select>
              <label className="flex items-center gap-2 text-sm">
                <input type="checkbox" checked={excludeRetweet} onChange={(e) => setExcludeRetweet(e.target.checked)} />
                -is:retweet
              </label>
              <label className="flex items-center gap-2 text-sm">
                <input type="checkbox" checked={excludeReply} onChange={(e) => setExcludeReply(e.target.checked)} />
                -is:reply
              </label>
              <label className="flex items-center gap-2 text-sm">
                <input type="checkbox" checked={requireLinks} onChange={(e) => setRequireLinks(e.target.checked)} />
                -has:links
              </label>
            </div>

            <TextPreview title={lang === 'es' ? 'Query generada' : 'Built query'} value={builtQuery} />

            <div className="grid gap-2 md:grid-cols-[1fr_auto_auto]">
              <Input
                value={newSearchName}
                onChange={(e) => setNewSearchName(e.target.value)}
                placeholder={lang === 'es' ? 'Nombre de búsqueda (ej: Macro + Cripto)' : 'Search name (e.g. Macro + Crypto)'}
              />
              <Button
                variant="outline"
                onClick={async () => {
                  const name = newSearchName.trim()
                  if (!name) return
                  const item: SavedTwitterSearch = {
                    id: `tw_${Date.now()}`,
                    name,
                    include_terms: includeTerms,
                    geo_terms: geoTerms,
                    exclude_terms: excludeTerms,
                    lang: langCode,
                    exclude_retweet: excludeRetweet,
                    exclude_reply: excludeReply,
                    require_links: requireLinks,
                  }
                  await persistSavedSearches([item, ...savedSearches])
                  setSelectedSavedId(item.id)
                  setNewSearchName('')
                }}
              >
                {lang === 'es' ? 'Guardar búsqueda' : 'Save search'}
              </Button>
              <Button
                variant="outline"
                onClick={async () => {
                  if (!selectedSavedId) return
                  await persistSavedSearches(savedSearches.filter((s) => s.id !== selectedSavedId))
                  setSelectedSavedId('')
                }}
              >
                {lang === 'es' ? 'Eliminar guardada' : 'Delete saved'}
              </Button>
            </div>

            {savedSearches.length ? (
              <div className="flex flex-wrap gap-2">
                {savedSearches.map((s) => (
                  <Button
                    key={s.id}
                    variant={s.id === selectedSavedId ? 'default' : 'outline'}
                    onClick={() => applySavedSearch(s)}
                  >
                    {s.name}
                  </Button>
                ))}
              </div>
            ) : null}
          </Card>

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
                <Badge>{lang === 'es' ? 'tweets relevantes' : 'relevant tweets'}: {twitterAnalyzed.raw_count}</Badge>
                {typeof twitterAnalyzed.noise_count === 'number' ? (
                  <Badge>{lang === 'es' ? 'ruido filtrado' : 'filtered noise'}: {twitterAnalyzed.noise_count}</Badge>
                ) : null}
                {twitterFetched?.warning ? <Badge className="border-red-300 text-red-600">{twitterFetched.warning}</Badge> : null}
                {twitterFetched?.error ? <Badge className="border-red-300 text-red-600">{twitterFetched.error.slice(0, 120)}...</Badge> : null}
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
            <Button variant="outline" onClick={() => onApply(appliedCountry, appliedCompany)} disabled={!fused}>
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
                      <div className="flex items-center gap-2">
                        <input
                          type="checkbox"
                          checked={selectedCountryKeys[k] !== false}
                          onChange={(e) => setSelectedCountryKeys((prev) => ({ ...prev, [k]: e.target.checked }))}
                          title={lang === 'es' ? 'Incluir esta señal en la simulación' : 'Include this signal in simulation'}
                        />
                        <ImpactBar label={k} value={v} />
                      </div>
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
                      <div className="flex items-center gap-2">
                        <input
                          type="checkbox"
                          checked={selectedCompanyKeys[k] !== false}
                          onChange={(e) => setSelectedCompanyKeys((prev) => ({ ...prev, [k]: e.target.checked }))}
                          title={lang === 'es' ? 'Incluir esta señal en la simulación' : 'Include this signal in simulation'}
                        />
                        <ImpactBar label={k} value={v} />
                      </div>
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

function maybeQuote(term: string) {
  const t = term.trim()
  if (!t) return ''
  return /\s/.test(t) ? `"${t}"` : t
}

function formatQueryParts(
  includeTerms: string[],
  geoTerms: string[],
  excludeTerms: string[],
  langCode: string,
  excludeRetweet: boolean,
  excludeReply: boolean,
  requireLinks: boolean
) {
  const include = includeTerms.map(maybeQuote).filter(Boolean).join(' OR ')
  const geo = geoTerms.map(maybeQuote).filter(Boolean).join(' OR ')
  const negatives = excludeTerms.map((t) => `-${maybeQuote(t)}`).join(' ')
  const filters = [
    `lang:${langCode || 'es'}`,
    excludeRetweet ? '-is:retweet' : '',
    excludeReply ? '-is:reply' : '',
    requireLinks ? '-has:links' : '',
    negatives,
  ]
    .filter(Boolean)
    .join(' ')
  if (!include && !geo) return filters
  if (include && geo) return `((${include}) (${geo})) ${filters}`.trim()
  return `(${include || geo}) ${filters}`.trim()
}

function TextPreview({ title, value }: { title: string; value: string }) {
  return (
    <div className="rounded-xl border border-border bg-muted/30 p-3">
      <p className="mb-1 text-xs text-slate-400">{title}</p>
      <p className="break-words text-sm">{value}</p>
    </div>
  )
}
