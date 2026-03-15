'use client'

import { useEffect, useMemo, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import {
  Activity,
  BarChart3,
  FlaskConical,
  Landmark,
  Lightbulb,
  LogOut,
  Moon,
  Play,
  Settings,
  Shield,
  Sun,
  Users,
} from 'lucide-react'
import {
  Cell,
  Legend,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Scatter,
  ScatterChart,
  Tooltip,
  XAxis,
  YAxis,
  ZAxis,
} from 'recharts'
import { api } from '@/lib/api'
import { ACTION_ORDER, DEFAULT_COMPANY_CONTEXT, DEFAULT_COUNTRY_CONTEXT, QUAL_LEVELS, QUAL_NUM } from '@/lib/constants'
import type { Archetype, QualLevel, RunRecord, Scenario, SimulationPayload } from '@/types'
import { Badge, Button, Card, Input, SectionTitle, Select, TextArea } from '@/components/ui/primitives'
import { BehaviorContagionMap } from '@/components/dashboard/behavior-contagion-map'
import { RealWorldSignals } from '@/components/dashboard/real-world-signals'

type TabKey = 'new' | 'signals' | 'archetypes' | 'scenarios' | 'runs' | 'settings'
type Lang = 'es' | 'en'

const NAV_ITEMS: Array<{ key: TabKey; icon: React.ComponentType<{ className?: string }> }> = [
  { key: 'new', icon: FlaskConical },
  { key: 'signals', icon: Activity },
  { key: 'archetypes', icon: Users },
  { key: 'scenarios', icon: Landmark },
  { key: 'runs', icon: BarChart3 },
  { key: 'settings', icon: Settings },
]

const I18N = {
  es: {
    appSubtitle: 'Panel de estrategia de comportamiento fintech',
    loading: 'Cargando...',
    secureAccess: 'Acceso interno seguro para simulaciones y demos estratégicas.',
    enterCode: 'Código de acceso',
    enter: 'Ingresar',
    logout: 'Salir',
    dark: 'Modo oscuro',
    light: 'Modo claro',
    nav: {
      new: 'Nueva Simulación',
      signals: 'Señales del Mundo Real',
      archetypes: 'Gestor de Arquetipos',
      scenarios: 'Gestor de Escenarios',
      runs: 'Ejecuciones Previas',
      settings: 'Configuración',
    },
    simulationStudio: 'Estudio de Simulación',
    simulationStudioSub: 'Configura el contexto, ejecuta y explora resultados.',
    runSimulation: 'Ejecutar Simulación',
    simulationResults: 'Resultados de Simulación',
    realWorldSignals: 'Señales del Mundo Real',
    realWorldSignalsSub: 'Ingesta y fusión de narrativas de X/Twitter y medios argentinos.',
  },
  en: {
    appSubtitle: 'Fintech behavior strategy dashboard',
    loading: 'Loading...',
    secureAccess: 'Secure internal access for simulations and strategy demos.',
    enterCode: 'Access code',
    enter: 'Enter',
    logout: 'Logout',
    dark: 'Dark mode',
    light: 'Light mode',
    nav: {
      new: 'New Simulation',
      signals: 'Real-World Signals',
      archetypes: 'Archetype Manager',
      scenarios: 'Scenario Manager',
      runs: 'Past Runs',
      settings: 'Settings',
    },
    simulationStudio: 'Simulation Studio',
    simulationStudioSub: 'Configure context, run, and explore outcomes.',
    runSimulation: 'Run Simulation',
    simulationResults: 'Simulation Results',
    realWorldSignals: 'Real-World Signals',
    realWorldSignalsSub: 'Ingest and fuse live X/Twitter narratives with Argentine media headlines.',
  },
} as const

const COLORS = ['#ef4444', '#3b82f6', '#f59e0b', '#22c55e', '#8b5cf6', '#06b6d4', '#fb7185', '#64748b']

const emptyPayload = (): SimulationPayload => ({
  scenario_id: null,
  scenario_name: 'custom',
  num_agents: 300,
  num_steps: 12,
  seed: 42,
  monte_carlo_runs: 1,
  archetype_mix: {},
  country_context: { ...DEFAULT_COUNTRY_CONTEXT },
  company_context: { ...DEFAULT_COMPANY_CONTEXT },
})

function copy<T>(x: T): T {
  return JSON.parse(JSON.stringify(x))
}

export default function Page() {
  const [authorized, setAuthorized] = useState(false)
  const [loading, setLoading] = useState(true)
  const [tab, setTab] = useState<TabKey>('new')
  const [dark, setDark] = useState(false)
  const [lang, setLang] = useState<Lang>('es')
  const [error, setError] = useState('')

  const [accessCode, setAccessCode] = useState('')
  const [archetypes, setArchetypes] = useState<Archetype[]>([])
  const [scenarios, setScenarios] = useState<Scenario[]>([])
  const [runs, setRuns] = useState<RunRecord[]>([])
  const [latestRun, setLatestRun] = useState<RunRecord | null>(null)
  const [sim, setSim] = useState<SimulationPayload>(emptyPayload())
  const [simStep, setSimStep] = useState(1)
  const [settings, setSettings] = useState<Record<string, unknown>>({ llm_provider: 'mock' })

  const [editingArchetype, setEditingArchetype] = useState<Archetype | null>(null)
  const [futureText, setFutureText] = useState('')
  const [impactText, setImpactText] = useState('')
  const t = I18N[lang]

  useEffect(() => {
    const root = document.documentElement
    if (dark) root.classList.add('dark')
    else root.classList.remove('dark')
  }, [dark])

  useEffect(() => {
    ;(async () => {
      try {
        const status = await api.authStatus()
        setAuthorized(status.authorized)
        if (status.authorized) await loadAll()
      } catch {
        setAuthorized(false)
      } finally {
        setLoading(false)
      }
    })()
  }, [])

  async function loadAll() {
    const [a, s, r, st] = await Promise.all([api.archetypes(), api.scenarios(), api.runs(), api.settings()])
    setArchetypes(a)
    setScenarios(s)
    setRuns(r)
    setSettings(st)
    if (!latestRun && r[0]) setLatestRun(r[0])

    setSim((prev) => {
      const next = copy(prev)
      if (Object.keys(next.archetype_mix).length === 0 && a.length) {
        const even = Number((100 / a.length).toFixed(2))
        for (const item of a) next.archetype_mix[item.id] = even
      }
      return next
    })
  }

  const mixTotal = useMemo(
    () => Object.values(sim.archetype_mix || {}).reduce((acc, n) => acc + Number(n || 0), 0),
    [sim.archetype_mix]
  )
  const archetypeMixChart = useMemo(
    () =>
      archetypes.map((a) => ({
        name: a.name,
        value: Number(sim.archetype_mix[a.id] || 0),
      })),
    [archetypes, sim.archetype_mix]
  )
  const wizardSteps = useMemo(
    () =>
      lang === 'es'
        ? [
            'Señales',
            'Contexto AR',
            'Estrategia de Compañía',
            'Mix de Arquetipos',
            'Revisión y Run',
            'Resultados',
            'Contagio',
            'Recomendaciones',
          ]
        : [
            'Signals',
            'Argentina Context',
            'Company Strategy',
            'Archetype Mix',
            'Review & Run',
            'Results',
            'Contagion',
            'Recommendations',
          ],
    [lang]
  )

  const currentMetrics = latestRun?.outputs?.single_run
  const timeline = currentMetrics?.timeline || []

  const donutData = ACTION_ORDER.map((key) => ({
    name: key,
    value: currentMetrics?.final_action_distribution?.[key] || 0,
  })).filter((x) => x.value > 0)

  async function doLogin() {
    setError('')
    try {
      await api.login(accessCode)
      setAuthorized(true)
      await loadAll()
    } catch (e) {
      setError((e as Error).message || 'Login failed')
    }
  }

  async function doLogout() {
    await api.logout()
    setAuthorized(false)
    setLatestRun(null)
    setAccessCode('')
  }

  async function runSimulation() {
    setError('')
    if (Math.abs(mixTotal - 100) > 0.01) {
      setError(`Archetype mix must total 100 (current: ${mixTotal.toFixed(2)})`)
      return
    }

    try {
      const run = await api.simulate(sim)
      setLatestRun(run)
      const rr = await api.runs()
      setRuns(rr)
      setSimStep(6)
    } catch (e) {
      setError((e as Error).message)
    }
  }

  async function doTranslateScenario() {
    if (!futureText.trim()) return
    try {
      const out = await api.translateScenario(futureText)
      setSim((prev) => ({
        ...prev,
        country_context: { ...prev.country_context, ...(out.country_context as Record<string, QualLevel>) },
        company_context: { ...prev.company_context, ...(out.company_context as Record<string, QualLevel>) },
      }))
    } catch (e) {
      setError((e as Error).message)
    }
  }

  async function doTranslateImpact() {
    if (!impactText.trim()) return
    try {
      const out = await api.impactTranslate(impactText)
      setSim((prev) => ({
        ...prev,
        country_context: { ...prev.country_context, ...(out.country_context as Record<string, QualLevel>) },
        company_context: { ...prev.company_context, ...(out.company_context as Record<string, QualLevel>) },
      }))
    } catch (e) {
      setError((e as Error).message)
    }
  }

  async function saveArchetype(item: Archetype) {
    try {
      if (archetypes.some((a) => a.id === item.id)) await api.updateArchetype(item.id, item)
      else await api.createArchetype(item)
      setEditingArchetype(null)
      setArchetypes(await api.archetypes())
    } catch (e) {
      setError((e as Error).message)
    }
  }

  async function removeArchetype(id: string) {
    try {
      await api.deleteArchetype(id)
      setArchetypes(await api.archetypes())
    } catch (e) {
      setError((e as Error).message)
    }
  }

  async function saveScenario(item: Scenario) {
    try {
      if (scenarios.some((s) => s.id === item.id)) await api.updateScenario(item.id, item)
      else await api.createScenario(item)
      setScenarios(await api.scenarios())
    } catch (e) {
      setError((e as Error).message)
    }
  }

  async function removeScenario(id: string) {
    try {
      await api.deleteScenario(id)
      setScenarios(await api.scenarios())
    } catch (e) {
      setError((e as Error).message)
    }
  }

  async function duplicateRun(id: string) {
    try {
      const run = await api.duplicateRun(id)
      setLatestRun(run)
      setRuns(await api.runs())
      setTab('new')
    } catch (e) {
      setError((e as Error).message)
    }
  }

  async function saveSettings() {
    try {
      await api.saveSettings(settings)
      setSettings(await api.settings())
    } catch (e) {
      setError((e as Error).message)
    }
  }

  function exportJson(name: string, data: unknown) {
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
    const a = document.createElement('a')
    a.href = URL.createObjectURL(blob)
    a.download = name
    a.click()
    URL.revokeObjectURL(a.href)
  }

  if (loading) return <div className="flex min-h-screen items-center justify-center text-sm">{t.loading}</div>

  if (!authorized) {
    return (
      <div className="dashboard-bg flex min-h-screen items-center justify-center p-4">
        <Card className="w-full max-w-md p-6">
          <h1 className="text-3xl font-bold">MiroFish AR Fintech Simulator</h1>
          <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">{t.secureAccess}</p>
          <div className="mt-6 space-y-3">
            <Input value={accessCode} onChange={(e) => setAccessCode(e.target.value)} placeholder={t.enterCode} />
            <Button className="w-full" onClick={doLogin}>{t.enter}</Button>
            {error ? <p className="text-sm text-red-600">{error}</p> : null}
          </div>
        </Card>
      </div>
    )
  }

  return (
    <div className="dashboard-bg min-h-screen">
      <header className="sticky top-0 z-10 border-b border-border bg-background/90 backdrop-blur">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-3 px-4 py-3">
          <div>
            <h1 className="text-2xl font-bold">MiroFish AR Fintech Simulator</h1>
            <p className="text-xs text-slate-500 dark:text-slate-400">{t.appSubtitle}</p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {NAV_ITEMS.map((item) => {
              const Icon = item.icon
              return (
                <Button key={item.key} variant={tab === item.key ? 'default' : 'outline'} onClick={() => setTab(item.key)}>
                  <span className="inline-flex items-center gap-2">
                    <Icon className="h-4 w-4" />
                    {t.nav[item.key]}
                  </span>
                </Button>
              )
            })}
            <Button variant="outline" onClick={() => setLang((v) => (v === 'es' ? 'en' : 'es'))}>{lang.toUpperCase()}</Button>
            <Button variant="ghost" onClick={() => setDark((v) => !v)} title={dark ? t.light : t.dark}>
              {dark ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
            </Button>
            <Button variant="danger" onClick={doLogout}>
              <span className="inline-flex items-center gap-2">
                <LogOut className="h-4 w-4" /> {t.logout}
              </span>
            </Button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-7xl space-y-6 p-4">
        {error ? <Card className="border-red-400 text-red-700 dark:text-red-300">{error}</Card> : null}

        <AnimatePresence mode="wait">
          <motion.div
            key={tab}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.18 }}
          >
            {tab === 'new' ? (
              <section className="space-y-6">
                <SectionTitle
                  title={lang === 'es' ? 'Flujo Guiado de Simulación' : 'Guided Simulation Journey'}
                  subtitle={
                    lang === 'es'
                      ? 'Seguí una secuencia clara: señales, contexto, estrategia, arquetipos, revisión y resultados.'
                      : 'Follow a clear sequence: signals, context, strategy, archetypes, review, and results.'
                  }
                />

                <Card className="space-y-4">
                  <div className="grid gap-2 md:grid-cols-4 xl:grid-cols-8">
                    {wizardSteps.map((label, idx) => {
                      const n = idx + 1
                      const active = simStep === n
                      const done = simStep > n
                      return (
                        <div key={label} className={`rounded-xl border p-2 text-center text-xs ${active ? 'border-primary bg-primary/10' : 'border-border'} ${done ? 'opacity-90' : ''}`}>
                          <div className={`mx-auto mb-1 flex h-6 w-6 items-center justify-center rounded-full ${active || done ? 'bg-primary text-white' : 'bg-muted'}`}>{n}</div>
                          <div>{label}</div>
                        </div>
                      )
                    })}
                  </div>
                  <div className="flex items-center justify-between">
                    <Button variant="outline" onClick={() => setSimStep((s) => Math.max(1, s - 1))} disabled={simStep === 1}>
                      {lang === 'es' ? 'Anterior' : 'Previous'}
                    </Button>
                    <Badge>{lang === 'es' ? 'Paso actual' : 'Current step'}: {wizardSteps[simStep - 1]}</Badge>
                    <Button variant="outline" onClick={() => setSimStep((s) => Math.min(8, s + 1))} disabled={simStep === 8}>
                      {lang === 'es' ? 'Siguiente' : 'Next'}
                    </Button>
                  </div>
                </Card>

                {simStep === 1 ? (
                  <RealWorldSignals
                    lang={lang}
                    initialCountryContext={sim.country_context}
                    initialCompanyContext={sim.company_context}
                    onError={setError}
                    onApply={(country, company) => {
                      setSim((prev) => ({
                        ...prev,
                        country_context: { ...prev.country_context, ...country },
                        company_context: { ...prev.company_context, ...company },
                      }))
                    }}
                  />
                ) : null}

                {simStep === 2 ? (
                  <div className="grid gap-4 lg:grid-cols-3">
                    <ContextClusterCard
                      title={lang === 'es' ? 'Presión Macro' : 'Macro Pressure'}
                      fields={['inflation_expectation', 'usd_volatility', 'country_risk_pressure']}
                      data={sim.country_context}
                      lang={lang}
                    />
                    <ContextClusterCard
                      title={lang === 'es' ? 'Confianza y Pánico' : 'Trust & Panic'}
                      fields={['bank_trust_index', 'social_panic_level', 'consumer_confidence']}
                      data={sim.country_context}
                      lang={lang}
                    />
                    <ContextClusterCard
                      title={lang === 'es' ? 'Presión Conductual' : 'Behavior Pressure'}
                      fields={['liquidity_preference_shift', 'crypto_volatility', 'policy_uncertainty']}
                      data={sim.country_context}
                      lang={lang}
                    />
                    <div className="lg:col-span-3">
                      <ContextEditor
                        title={lang === 'es' ? 'Editar Contexto Argentina (Avanzado)' : 'Edit Argentina Context (Advanced)'}
                        data={sim.country_context}
                        onChange={(k, v) => setSim((p) => ({ ...p, country_context: { ...p.country_context, [k]: v } }))}
                      />
                    </div>
                  </div>
                ) : null}

                {simStep === 3 ? (
                  <div className="grid gap-4 lg:grid-cols-2">
                    <ContextEditor
                      title={lang === 'es' ? 'Retención y Yield' : 'Retention & Yield'}
                      data={pickContext(sim.company_context, ['wallet_yield_current', 'wallet_yield_new', 'competitor_yield', 'cashback_percent', 'cashback_cap'])}
                      onChange={(k, v) => setSim((p) => ({ ...p, company_context: { ...p.company_context, [k]: v } }))}
                    />
                    <ContextEditor
                      title={lang === 'es' ? 'Fricción, Soporte y Liquidez' : 'Friction, Support & Liquidity'}
                      data={pickContext(sim.company_context, ['onboarding_friction', 'KYC_friction', 'app_stability', 'transfer_limits', 'withdrawal_delay_risk', 'support_quality', 'trust_baseline'])}
                      onChange={(k, v) => setSim((p) => ({ ...p, company_context: { ...p.company_context, [k]: v } }))}
                    />
                    <div className="lg:col-span-2">
                      <ContextEditor
                        title={lang === 'es' ? 'Estrategia de Crédito' : 'Credit Strategy'}
                        data={pickContext(sim.company_context, ['credit_offer_aggressiveness', 'loan_rate_level'])}
                        onChange={(k, v) => setSim((p) => ({ ...p, company_context: { ...p.company_context, [k]: v } }))}
                      />
                    </div>
                  </div>
                ) : null}

                {simStep === 4 ? (
                  <div className="space-y-4">
                    <div className="grid gap-4 lg:grid-cols-3">
                      {archetypes.map((a) => (
                        <Card key={a.id} className="space-y-2">
                          <div className="flex items-center justify-between">
                            <h4 className="font-semibold">{a.name}</h4>
                            <Badge>{a.balance_bucket}</Badge>
                          </div>
                          <p className="text-sm text-slate-500 dark:text-slate-400">{a.description}</p>
                          <div className="flex flex-wrap gap-1">
                            <Badge>trust {a.trust_level}</Badge>
                            <Badge>liq {a.liquidity_preference}</Badge>
                            <Badge>crypto {a.crypto_affinity}</Badge>
                            <Badge>rumor {a.rumor_sensitivity}</Badge>
                          </div>
                          <Input
                            type="number"
                            min={0}
                            max={100}
                            value={sim.archetype_mix[a.id] ?? 0}
                            onChange={(e) =>
                              setSim((prev) => ({
                                ...prev,
                                archetype_mix: { ...prev.archetype_mix, [a.id]: Number(e.target.value || 0) },
                              }))
                            }
                          />
                        </Card>
                      ))}
                    </div>
                    <div className="grid gap-4 lg:grid-cols-2">
                      <Card>
                        <SectionTitle title={lang === 'es' ? 'Mix de Población' : 'Population Mix'} />
                        <div className="h-72">
                          <ResponsiveContainer>
                            <PieChart>
                              <Pie data={archetypeMixChart.filter((x) => x.value > 0)} dataKey="value" nameKey="name" innerRadius={60} outerRadius={100}>
                                {archetypeMixChart.map((_, i) => (
                                  <Cell key={i} fill={COLORS[i % COLORS.length]} />
                                ))}
                              </Pie>
                              <Legend />
                            </PieChart>
                          </ResponsiveContainer>
                        </div>
                      </Card>
                      <Card>
                        <SectionTitle title={lang === 'es' ? 'Control de Pesos' : 'Weight Control'} />
                        <Badge className={Math.abs(mixTotal - 100) > 0.01 ? 'border-red-500 text-red-600' : ''}>
                          {lang === 'es' ? 'Total mezcla' : 'Mix Total'}: {mixTotal.toFixed(2)}%
                        </Badge>
                      </Card>
                    </div>
                  </div>
                ) : null}

                {simStep === 5 ? (
                  <Card className="space-y-4">
                    <SectionTitle title={lang === 'es' ? 'Revisión Previa al Run' : 'Pre-Run Review'} subtitle={lang === 'es' ? 'Validá el contexto antes de simular.' : 'Validate context before simulation.'} />
                    <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
                      <Field label={lang === 'es' ? 'Agentes' : 'Agents'} value={sim.num_agents} onChange={(v) => setSim((p) => ({ ...p, num_agents: Number(v) }))} />
                      <Field label={lang === 'es' ? 'Pasos' : 'Steps'} value={sim.num_steps} onChange={(v) => setSim((p) => ({ ...p, num_steps: Number(v) }))} />
                      <Field label="Seed" value={sim.seed} onChange={(v) => setSim((p) => ({ ...p, seed: Number(v) }))} />
                      <Field label="Monte Carlo" value={sim.monte_carlo_runs} onChange={(v) => setSim((p) => ({ ...p, monte_carlo_runs: Number(v) }))} />
                    </div>
                    <div className="flex items-center justify-between">
                      <Badge>{lang === 'es' ? 'Escenario' : 'Scenario'}: {sim.scenario_name}</Badge>
                      <Button onClick={runSimulation}>
                        <span className="inline-flex items-center gap-2">
                          <Play className="h-4 w-4" /> {t.runSimulation}
                        </span>
                      </Button>
                    </div>
                  </Card>
                ) : null}

                {latestRun && simStep >= 6 ? (
                  <section className="space-y-4">
                    {simStep === 6 ? (
                      <>
                        <SectionTitle title={t.simulationResults} subtitle={`Run ID: ${latestRun.id}`} />
                        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                          <MetricCard icon={Landmark} label={lang === 'es' ? 'Migración de Fondos' : 'Migration Funds'} value={num(currentMetrics?.estimated_migration_of_funds)} />
                          <MetricCard icon={Users} label={lang === 'es' ? 'Riesgo de Churn' : 'Churn Risk'} value={pct(currentMetrics?.churn_proxy)} />
                          <MetricCard icon={Shield} label={lang === 'es' ? 'Estrés de Liquidez' : 'Liquidity Stress'} value={pct(currentMetrics?.liquidity_stress_proxy)} />
                          <MetricCard icon={BarChart3} label={lang === 'es' ? 'Riesgo Promo' : 'Promo Abuse Risk'} value={pct(currentMetrics?.promo_abuse_risk_proxy)} />
                        </div>
                        <div className="grid gap-4 lg:grid-cols-3">
                          <Card className="lg:col-span-2">
                            <SectionTitle title={lang === 'es' ? 'Dinámica Temporal' : 'Timeline Dynamics'} subtitle={lang === 'es' ? 'Churn, confianza y liquidez por paso.' : 'Churn, trust and liquidity per step.'} />
                            <div className="h-72 w-full">
                              <ResponsiveContainer>
                                <LineChart data={timeline}>
                                  <XAxis dataKey="step" />
                                  <YAxis domain={[0, 1]} />
                                  <Tooltip />
                                  <Legend />
                                  <Line type="monotone" dataKey="churn_proxy" stroke="#ef4444" strokeWidth={2} dot={false} />
                                  <Line type="monotone" dataKey="trust_deterioration_proxy" stroke="#3b82f6" strokeWidth={2} dot={false} />
                                  <Line type="monotone" dataKey="liquidity_stress_proxy" stroke="#f59e0b" strokeWidth={2} dot={false} />
                                </LineChart>
                              </ResponsiveContainer>
                            </div>
                          </Card>
                          <Card>
                            <SectionTitle title={lang === 'es' ? 'Distribución Final' : 'Final Actions'} />
                            <div className="h-72 w-full">
                              <ResponsiveContainer>
                                <PieChart>
                                  <Pie data={donutData} dataKey="value" nameKey="name" innerRadius={55} outerRadius={95}>
                                    {donutData.map((_, i) => (
                                      <Cell key={i} fill={COLORS[i % COLORS.length]} />
                                    ))}
                                  </Pie>
                                  <Legend />
                                </PieChart>
                              </ResponsiveContainer>
                            </div>
                          </Card>
                        </div>
                      </>
                    ) : null}

                    {simStep === 7 ? <BehaviorContagionMap archetypes={archetypes} run={latestRun} payload={sim} lang={lang} /> : null}

                    {simStep === 8 ? (
                      <div className="grid gap-4 lg:grid-cols-2">
                        <Card>
                          <SectionTitle title={lang === 'es' ? 'Acciones Tácticas' : 'Tactical Actions'} subtitle={lang === 'es' ? 'Mitigación de riesgo, retención y liquidez.' : 'Risk mitigation, retention and liquidity actions.'} />
                          <div className="space-y-2">
                            {(latestRun.tactical_recommendations?.tactical_actions || []).map((x, i) => (
                              <motion.div key={i} whileHover={{ y: -2 }} className="rounded-xl border border-border p-3">
                                <div className="mb-2 flex items-center justify-between">
                                  <h4 className="font-medium">{x.title}</h4>
                                  <Badge>{lang === 'es' ? 'Táctico' : 'Tactical'}</Badge>
                                </div>
                                <p className="text-sm text-slate-500 dark:text-slate-400">{x.why}</p>
                              </motion.div>
                            ))}
                          </div>
                        </Card>
                        <Card>
                          <SectionTitle title={lang === 'es' ? 'Innovation Lab' : 'Innovation Lab'} subtitle={lang === 'es' ? 'Ideas disruptivas para nuevos productos.' : 'Disruptive ideas for new products.'} />
                          <div className="space-y-2">
                            {(latestRun.disruptive_recommendations?.innovation_lab || []).map((x, i) => (
                              <motion.div key={i} whileHover={{ scale: 1.01 }} className="rounded-xl border border-border p-3">
                                <div className="mb-1 flex items-center justify-between gap-2">
                                  <h4 className="font-medium">{x.idea}</h4>
                                  <Lightbulb className="h-4 w-4 text-amber-500" />
                                </div>
                                <p className="text-sm text-slate-500 dark:text-slate-400">{x.fit}</p>
                                <p className="mt-2 text-xs">{lang === 'es' ? 'Inspiración' : 'Inspiration'}: {x.inspiration}</p>
                              </motion.div>
                            ))}
                          </div>
                        </Card>
                      </div>
                    ) : null}
                  </section>
                ) : null}
              </section>
            ) : null}

            {tab === 'signals' ? (
              <section className="space-y-4">
                <SectionTitle title={t.realWorldSignals} subtitle={t.realWorldSignalsSub} />
                <RealWorldSignals
                  lang={lang}
                  initialCountryContext={sim.country_context}
                  initialCompanyContext={sim.company_context}
                  onError={setError}
                  onApply={(country, company) => {
                    setSim((prev) => ({
                      ...prev,
                      country_context: { ...prev.country_context, ...country },
                      company_context: { ...prev.company_context, ...company },
                    }))
                    setTab('new')
                  }}
                />
              </section>
            ) : null}

            {tab === 'archetypes' ? (
              <section className="space-y-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <SectionTitle
                    title={lang === 'es' ? 'Gestor de Arquetipos' : 'Archetype Manager'}
                    subtitle={lang === 'es' ? 'Tarjetas visuales y perfiles conductuales editables.' : 'Visual cards + editable behavioral profiles.'}
                  />
                  <div className="flex gap-2">
                    <Button
                      onClick={() => {
                        if (!archetypes[0]) return
                        const base = copy(archetypes[0])
                        base.id = `${base.id}_copy_${Math.floor(Math.random() * 9999)}`
                        base.name = `${base.name} copy`
                        setEditingArchetype(base)
                      }}
                    >
                      {lang === 'es' ? 'Nuevo Arquetipo' : 'New Archetype'}
                    </Button>
                    <Button variant="outline" onClick={() => exportJson('archetypes.json', archetypes)}>
                      {lang === 'es' ? 'Exportar' : 'Export'}
                    </Button>
                  </div>
                </div>

                <Card>
                  <SectionTitle title="Archetype Map" subtitle="X trust level, Y risk aversion, bubble size by simulation mix." />
                  <div className="h-72">
                    <ResponsiveContainer>
                      <ScatterChart>
                        <XAxis type="number" dataKey="x" domain={[1, 5]} name="Trust" ticks={[1, 2, 3, 4, 5]} />
                        <YAxis type="number" dataKey="y" domain={[1, 5]} name="Risk Aversion" ticks={[1, 2, 3, 4, 5]} />
                        <ZAxis type="number" dataKey="z" range={[120, 1200]} />
                        <Tooltip cursor={{ strokeDasharray: '3 3' }} />
                        <Scatter
                          data={archetypes.map((a) => ({
                            x: QUAL_NUM[a.trust_level],
                            y: QUAL_NUM[a.risk_aversion],
                            z: Math.max(1, sim.archetype_mix[a.id] || 1),
                            name: a.name,
                          }))}
                          fill="#3b82f6"
                        />
                      </ScatterChart>
                    </ResponsiveContainer>
                  </div>
                </Card>

                <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                  {archetypes.map((a) => (
                    <motion.div key={a.id} whileHover={{ y: -4 }}>
                      <Card className="relative overflow-hidden">
                        <div className="mb-3 flex items-start justify-between gap-2">
                          <h3 className="font-semibold">{a.name}</h3>
                          <Badge>{a.balance_bucket}</Badge>
                        </div>
                        <p className="mb-3 text-sm text-slate-500 dark:text-slate-400">{a.description}</p>
                        <div className="mb-4 flex flex-wrap gap-1.5">
                          <Badge>trust: {a.trust_level}</Badge>
                          <Badge>liq: {a.liquidity_preference}</Badge>
                          <Badge>crypto: {a.crypto_affinity}</Badge>
                          <Badge>rumor: {a.rumor_sensitivity}</Badge>
                        </div>
                        <div className="flex gap-2">
                          <Button variant="outline" onClick={() => setEditingArchetype(copy(a))}>
                            {lang === 'es' ? 'Editar' : 'Edit'}
                          </Button>
                          <Button variant="danger" onClick={() => removeArchetype(a.id)}>
                            {lang === 'es' ? 'Eliminar' : 'Delete'}
                          </Button>
                        </div>
                        <div className="pointer-events-none absolute inset-x-0 bottom-0 translate-y-full border-t border-border bg-card/95 p-3 text-xs text-slate-500 opacity-0 transition duration-200 group-hover:translate-y-0 group-hover:opacity-100" />
                      </Card>
                    </motion.div>
                  ))}
                </div>
              </section>
            ) : null}

            {tab === 'scenarios' ? (
              <section className="space-y-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <SectionTitle
                    title={lang === 'es' ? 'Gestor de Escenarios' : 'Scenario Manager'}
                    subtitle={lang === 'es' ? 'Biblioteca persistente de escenarios con contexto editable.' : 'Persistent scenario library with editable context baselines.'}
                  />
                  <Button
                    onClick={() => {
                      const id = `scenario_${Math.floor(Math.random() * 9999)}`
                      saveScenario({
                        id,
                        name: `New Scenario ${id}`,
                        description: 'Editable scenario.',
                        default_country_context: copy(DEFAULT_COUNTRY_CONTEXT),
                        default_company_context: copy(DEFAULT_COMPANY_CONTEXT),
                        notes: '',
                        event_timeline: [],
                      })
                    }}
                  >
                    {lang === 'es' ? 'Nuevo Escenario' : 'New Scenario'}
                  </Button>
                </div>

                <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                  {scenarios.map((s) => (
                    <Card key={s.id} className="space-y-2">
                      <Input value={s.name} onChange={(e) => setScenarios((prev) => prev.map((x) => (x.id === s.id ? { ...x, name: e.target.value } : x)))} />
                      <TextArea
                        rows={4}
                        value={s.description}
                        onChange={(e) => setScenarios((prev) => prev.map((x) => (x.id === s.id ? { ...x, description: e.target.value } : x)))}
                      />
                      <div className="flex gap-2">
                        <Button variant="outline" onClick={() => saveScenario(s)}>
                          {lang === 'es' ? 'Guardar' : 'Save'}
                        </Button>
                        <Button
                          variant="outline"
                          onClick={() => {
                            const dupe = copy(s)
                            dupe.id = `${s.id}_copy_${Math.floor(Math.random() * 9999)}`
                            dupe.name = `${s.name} copy`
                            saveScenario(dupe)
                          }}
                        >
                          {lang === 'es' ? 'Duplicar' : 'Duplicate'}
                        </Button>
                        <Button variant="danger" onClick={() => removeScenario(s.id)}>
                          {lang === 'es' ? 'Eliminar' : 'Delete'}
                        </Button>
                      </div>
                    </Card>
                  ))}
                </div>
              </section>
            ) : null}

            {tab === 'runs' ? (
              <section className="space-y-4">
                <SectionTitle
                  title={lang === 'es' ? 'Ejecuciones Previas' : 'Past Runs'}
                  subtitle={lang === 'es' ? 'Revisá, duplicá y exportá simulaciones históricas.' : 'Review, duplicate, and export historical simulations.'}
                />
                <div className="grid gap-4">
                  {runs.map((r) => (
                    <Card key={r.id} className="flex flex-wrap items-center justify-between gap-3">
                      <div>
                        <h3 className="font-medium">{r.id}</h3>
                        <p className="text-sm text-slate-500 dark:text-slate-400">
                          {new Date(r.created_at).toLocaleString()} • {r.config.scenario_name}
                        </p>
                      </div>
                      <div className="flex gap-2">
                        <Button variant="outline" onClick={() => { setLatestRun(r); setTab('new') }}>
                          {lang === 'es' ? 'Abrir' : 'Open'}
                        </Button>
                        <Button variant="outline" onClick={() => duplicateRun(r.id)}>
                          {lang === 'es' ? 'Duplicar' : 'Duplicate'}
                        </Button>
                        <Button variant="outline" onClick={() => exportJson(`run-${r.id}.json`, r)}>
                          {lang === 'es' ? 'Exportar' : 'Export'}
                        </Button>
                      </div>
                    </Card>
                  ))}
                </div>
              </section>
            ) : null}

            {tab === 'settings' ? (
              <section className="space-y-4">
                <SectionTitle
                  title={lang === 'es' ? 'Configuración' : 'Settings'}
                  subtitle={lang === 'es' ? 'Proveedor y modelo LLM en tiempo de ejecución.' : 'Runtime provider and model preferences.'}
                />
                <Card className="max-w-xl space-y-3">
                  <div>
                    <label className="mb-1 block text-xs">{lang === 'es' ? 'Proveedor LLM' : 'LLM Provider'}</label>
                    <Select
                      value={String(settings.llm_provider || 'mock')}
                      onChange={(e) => setSettings((s) => ({ ...s, llm_provider: e.target.value }))}
                    >
                      <option value="mock">mock</option>
                      <option value="deepseek">deepseek</option>
                      <option value="qwen">qwen</option>
                    </Select>
                  </div>
                  <div>
                    <label className="mb-1 block text-xs">LLM Base URL</label>
                    <Input
                      value={String(settings.llm_base_url || '')}
                      onChange={(e) => setSettings((s) => ({ ...s, llm_base_url: e.target.value }))}
                    />
                  </div>
                  <div>
                    <label className="mb-1 block text-xs">{lang === 'es' ? 'Modelo LLM' : 'LLM Model'}</label>
                    <Input
                      value={String(settings.llm_model || '')}
                      onChange={(e) => setSettings((s) => ({ ...s, llm_model: e.target.value }))}
                    />
                  </div>
                  <Button onClick={saveSettings}>{lang === 'es' ? 'Guardar configuración' : 'Save Settings'}</Button>
                </Card>
              </section>
            ) : null}
          </motion.div>
        </AnimatePresence>
      </main>

      <AnimatePresence>
        {editingArchetype ? (
          <motion.aside
            className="fixed inset-0 z-50 bg-black/35"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setEditingArchetype(null)}
          >
            <motion.div
              className="absolute right-0 top-0 h-full w-full max-w-xl overflow-auto border-l border-border bg-background p-4"
              initial={{ x: 300 }}
              animate={{ x: 0 }}
              exit={{ x: 300 }}
              onClick={(e) => e.stopPropagation()}
            >
              <SectionTitle title="Edit Archetype" subtitle={editingArchetype.id} />
              <div className="space-y-3">
                <Input
                  value={editingArchetype.name}
                  onChange={(e) => setEditingArchetype({ ...editingArchetype, name: e.target.value })}
                  placeholder="Name"
                />
                <TextArea
                  value={editingArchetype.description}
                  onChange={(e) => setEditingArchetype({ ...editingArchetype, description: e.target.value })}
                  rows={3}
                />
                <div className="grid grid-cols-2 gap-2">
                  {([
                    'trust_level',
                    'interest_rate_sensitivity',
                    'promotion_sensitivity',
                    'crypto_affinity',
                    'rumor_sensitivity',
                    'reaction_speed',
                    'liquidity_preference',
                    'risk_aversion',
                    'income_stability',
                    'macro_anxiety',
                  ] as Array<
                    | 'trust_level'
                    | 'interest_rate_sensitivity'
                    | 'promotion_sensitivity'
                    | 'crypto_affinity'
                    | 'rumor_sensitivity'
                    | 'reaction_speed'
                    | 'liquidity_preference'
                    | 'risk_aversion'
                    | 'income_stability'
                    | 'macro_anxiety'
                  >).map((key) => (
                    <div key={key}>
                      <label className="mb-1 block text-xs">{key}</label>
                      <Select
                        value={editingArchetype[key]}
                        onChange={(e) =>
                          setEditingArchetype({ ...editingArchetype, [key]: e.target.value as QualLevel } as Archetype)
                        }
                      >
                        {QUAL_LEVELS.map((v) => (
                          <option key={v} value={v}>
                            {v}
                          </option>
                        ))}
                      </Select>
                    </div>
                  ))}
                </div>
                <div>
                  <label className="mb-1 block text-xs">behavioral_prompt_template</label>
                  <TextArea
                    rows={8}
                    value={editingArchetype.behavioral_prompt_template}
                    onChange={(e) => setEditingArchetype({ ...editingArchetype, behavioral_prompt_template: e.target.value })}
                  />
                </div>
                <div className="flex gap-2">
                  <Button onClick={() => saveArchetype(editingArchetype)}>Save</Button>
                  <Button variant="outline" onClick={() => setEditingArchetype(null)}>
                    Cancel
                  </Button>
                </div>
              </div>
            </motion.div>
          </motion.aside>
        ) : null}
      </AnimatePresence>
    </div>
  )
}

function Field({ label, value, onChange }: { label: string; value: number; onChange: (v: string) => void }) {
  return (
    <div>
      <label className="mb-1 block text-xs">{label}</label>
      <Input type="number" value={value} onChange={(e) => onChange(e.target.value)} />
    </div>
  )
}

function ContextEditor({
  title,
  data,
  onChange,
}: {
  title: string
  data: Record<string, QualLevel>
  onChange: (key: string, value: QualLevel) => void
}) {
  return (
    <Card>
      <SectionTitle title={title} />
      <div className="grid gap-2 sm:grid-cols-2">
        {Object.keys(data).map((key) => (
          <div key={key}>
            <label className="mb-1 block text-xs">{key}</label>
            <Select value={data[key]} onChange={(e) => onChange(key, e.target.value as QualLevel)}>
              {QUAL_LEVELS.map((q) => (
                <option key={q} value={q}>
                  {q}
                </option>
              ))}
            </Select>
          </div>
        ))}
      </div>
    </Card>
  )
}

function pickContext(data: Record<string, QualLevel>, keys: string[]) {
  const out: Record<string, QualLevel> = {}
  for (const k of keys) {
    if (data[k]) out[k] = data[k]
  }
  return out
}

function ContextClusterCard({
  title,
  fields,
  data,
  lang,
}: {
  title: string
  fields: string[]
  data: Record<string, QualLevel>
  lang: 'es' | 'en'
}) {
  return (
    <Card>
      <SectionTitle title={title} />
      <div className="space-y-2">
        {fields.map((key) => (
          <div key={key} className="rounded-xl border border-border p-3">
            <div className="text-xs text-slate-500">{key}</div>
            <div className="mt-1 flex items-center justify-between">
              <span className="text-sm font-medium">{data[key]}</span>
              <Badge>{lang === 'es' ? 'impacto' : 'impact'}</Badge>
            </div>
          </div>
        ))}
      </div>
    </Card>
  )
}

function MetricCard({
  icon: Icon,
  label,
  value,
}: {
  icon: React.ComponentType<{ className?: string }>
  label: string
  value: string
}) {
  return (
    <Card>
      <div className="mb-2 flex items-center justify-between">
        <p className="text-sm text-slate-500 dark:text-slate-400">{label}</p>
        <Icon className="h-4 w-4 text-primary" />
      </div>
      <p className="text-2xl font-semibold">{value}</p>
    </Card>
  )
}

function num(v?: number) {
  if (v === undefined || v === null) return '-'
  return Intl.NumberFormat('en-US', { maximumFractionDigits: 0 }).format(v)
}

function pct(v?: number) {
  if (v === undefined || v === null) return '-'
  return `${(v * 100).toFixed(1)}%`
}
