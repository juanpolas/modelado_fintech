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

const NAV_ITEMS: Array<{ key: TabKey; label: string; icon: React.ComponentType<{ className?: string }> }> = [
  { key: 'new', label: 'New Simulation', icon: FlaskConical },
  { key: 'signals', label: 'Real-World Signals', icon: Activity },
  { key: 'archetypes', label: 'Archetype Manager', icon: Users },
  { key: 'scenarios', label: 'Scenario Manager', icon: Landmark },
  { key: 'runs', label: 'Past Runs', icon: BarChart3 },
  { key: 'settings', label: 'Settings', icon: Settings },
]

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
  const [error, setError] = useState('')

  const [accessCode, setAccessCode] = useState('')
  const [archetypes, setArchetypes] = useState<Archetype[]>([])
  const [scenarios, setScenarios] = useState<Scenario[]>([])
  const [runs, setRuns] = useState<RunRecord[]>([])
  const [latestRun, setLatestRun] = useState<RunRecord | null>(null)
  const [sim, setSim] = useState<SimulationPayload>(emptyPayload())
  const [settings, setSettings] = useState<Record<string, unknown>>({ llm_provider: 'mock' })

  const [editingArchetype, setEditingArchetype] = useState<Archetype | null>(null)
  const [futureText, setFutureText] = useState('')
  const [impactText, setImpactText] = useState('')

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

  if (loading) {
    return <div className="flex min-h-screen items-center justify-center text-sm">Loading...</div>
  }

  if (!authorized) {
    return (
      <div className="dashboard-bg flex min-h-screen items-center justify-center p-4">
        <Card className="w-full max-w-md p-6">
          <h1 className="text-3xl font-bold">MiroFish AR Fintech Simulator</h1>
          <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">Secure internal access for simulations and strategy demos.</p>
          <div className="mt-6 space-y-3">
            <Input value={accessCode} onChange={(e) => setAccessCode(e.target.value)} placeholder="Access code" />
            <Button className="w-full" onClick={doLogin}>
              Enter
            </Button>
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
            <p className="text-xs text-slate-500 dark:text-slate-400">Fintech behavior strategy dashboard</p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {NAV_ITEMS.map((item) => {
              const Icon = item.icon
              return (
                <Button key={item.key} variant={tab === item.key ? 'default' : 'outline'} onClick={() => setTab(item.key)}>
                  <span className="inline-flex items-center gap-2">
                    <Icon className="h-4 w-4" />
                    {item.label}
                  </span>
                </Button>
              )
            })}
            <Button variant="ghost" onClick={() => setDark((v) => !v)}>{dark ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}</Button>
            <Button variant="danger" onClick={doLogout}>
              <span className="inline-flex items-center gap-2">
                <LogOut className="h-4 w-4" /> Logout
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
                <SectionTitle title="Simulation Studio" subtitle="Configure context, run, and explore outcomes." />

                <div className="grid gap-4 lg:grid-cols-3">
                  <Card className="space-y-3 lg:col-span-1">
                    <h3 className="font-semibold">Simulation Setup</h3>
                    <div>
                      <label className="mb-1 block text-xs">Scenario</label>
                      <Select
                        value={sim.scenario_id || ''}
                        onChange={(e) => {
                          const id = e.target.value || null
                          const picked = scenarios.find((s) => s.id === id)
                          setSim((prev) => ({
                            ...prev,
                            scenario_id: id,
                            scenario_name: picked?.name || 'custom',
                            country_context: picked ? copy(picked.default_country_context) : prev.country_context,
                            company_context: picked ? copy(picked.default_company_context) : prev.company_context,
                          }))
                        }}
                      >
                        <option value="">custom</option>
                        {scenarios.map((s) => (
                          <option key={s.id} value={s.id}>
                            {s.name}
                          </option>
                        ))}
                      </Select>
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <Field label="Agents" value={sim.num_agents} onChange={(v) => setSim((p) => ({ ...p, num_agents: Number(v) }))} />
                      <Field label="Steps" value={sim.num_steps} onChange={(v) => setSim((p) => ({ ...p, num_steps: Number(v) }))} />
                      <Field label="Seed" value={sim.seed} onChange={(v) => setSim((p) => ({ ...p, seed: Number(v) }))} />
                      <Field
                        label="Monte Carlo"
                        value={sim.monte_carlo_runs}
                        onChange={(v) => setSim((p) => ({ ...p, monte_carlo_runs: Number(v) }))}
                      />
                    </div>
                  </Card>

                  <Card className="space-y-3 lg:col-span-2">
                    <h3 className="font-semibold">Archetype Mix</h3>
                    <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                      {archetypes.map((a) => (
                        <div key={a.id} className="rounded-xl border border-border p-3">
                          <div className="mb-1 text-sm font-medium">{a.name}</div>
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
                        </div>
                      ))}
                    </div>
                    <div className="flex items-center justify-between">
                      <Badge className={Math.abs(mixTotal - 100) > 0.01 ? 'border-red-500 text-red-600' : ''}>Mix Total: {mixTotal.toFixed(2)}%</Badge>
                      <Button onClick={runSimulation}>
                        <span className="inline-flex items-center gap-2">
                          <Play className="h-4 w-4" /> Run Simulation
                        </span>
                      </Button>
                    </div>
                  </Card>
                </div>

                <div className="grid gap-4 lg:grid-cols-2">
                  <ContextEditor title="Country Context" data={sim.country_context} onChange={(k, v) => setSim((p) => ({ ...p, country_context: { ...p.country_context, [k]: v } }))} />
                  <ContextEditor
                    title="Company Context"
                    data={sim.company_context}
                    onChange={(k, v) => setSim((p) => ({ ...p, company_context: { ...p.company_context, [k]: v } }))}
                  />
                </div>

                <Card>
                  <SectionTitle title="AI Context Translators" subtitle="Translate future scenarios and global events into local simulation drivers." />
                  <div className="grid gap-4 md:grid-cols-2">
                    <div className="space-y-2">
                      <label className="text-xs">Future Scenario</label>
                      <TextArea value={futureText} onChange={(e) => setFutureText(e.target.value)} placeholder="Cambio de gobierno con incertidumbre" rows={4} />
                      <Button variant="outline" onClick={doTranslateScenario}>
                        Translate Scenario
                      </Button>
                    </div>
                    <div className="space-y-2">
                      <label className="text-xs">Global Event</label>
                      <TextArea value={impactText} onChange={(e) => setImpactText(e.target.value)} placeholder="There is a war in the Middle East" rows={4} />
                      <Button variant="outline" onClick={doTranslateImpact}>
                        Impact Translate
                      </Button>
                    </div>
                  </div>
                </Card>

                {latestRun ? (
                  <section className="space-y-4">
                    <SectionTitle title="Simulation Results" subtitle={`Run ID: ${latestRun.id}`} />

                    <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                      <MetricCard icon={Landmark} label="Migration Funds" value={num(currentMetrics?.estimated_migration_of_funds)} />
                      <MetricCard icon={Users} label="Churn Proxy" value={pct(currentMetrics?.churn_proxy)} />
                      <MetricCard icon={Shield} label="Liquidity Stress" value={pct(currentMetrics?.liquidity_stress_proxy)} />
                      <MetricCard icon={BarChart3} label="Promo Abuse Risk" value={pct(currentMetrics?.promo_abuse_risk_proxy)} />
                    </div>

                    <BehaviorContagionMap archetypes={archetypes} run={latestRun} payload={sim} />

                    <div className="grid gap-4 lg:grid-cols-3">
                      <Card className="lg:col-span-2">
                        <SectionTitle title="Timeline Dynamics" subtitle="Churn, trust deterioration, and liquidity stress." />
                        <div className="h-72 w-full">
                          <ResponsiveContainer>
                            <LineChart data={timeline}>
                              <XAxis dataKey="step" />
                              <YAxis domain={[0, 1]} />
                              <Tooltip />
                              <Legend />
                              <Line type="monotone" dataKey="churn_proxy" stroke="#ef4444" strokeWidth={2} dot={false} name="Churn" />
                              <Line
                                type="monotone"
                                dataKey="trust_deterioration_proxy"
                                stroke="#3b82f6"
                                strokeWidth={2}
                                dot={false}
                                name="Trust Deterioration"
                              />
                              <Line
                                type="monotone"
                                dataKey="liquidity_stress_proxy"
                                stroke="#f59e0b"
                                strokeWidth={2}
                                dot={false}
                                name="Liquidity Stress"
                              />
                            </LineChart>
                          </ResponsiveContainer>
                        </div>
                      </Card>

                      <Card>
                        <SectionTitle title="Action Distribution" subtitle="Final behavior mix." />
                        <div className="h-72 w-full">
                          <ResponsiveContainer>
                            <PieChart>
                              <Pie data={donutData} dataKey="value" nameKey="name" innerRadius={55} outerRadius={95}>
                                {donutData.map((_, i) => (
                                  <Cell key={i} fill={COLORS[i % COLORS.length]} />
                                ))}
                              </Pie>
                              <Tooltip />
                              <Legend />
                            </PieChart>
                          </ResponsiveContainer>
                        </div>
                      </Card>
                    </div>

                    <div className="grid gap-4 lg:grid-cols-2">
                      <Card>
                        <SectionTitle title="Tactical Recommendations" subtitle="Pragmatic actions for product and risk teams." />
                        <div className="space-y-2">
                          {(latestRun.tactical_recommendations?.tactical_actions || []).map((x, i) => (
                            <motion.div key={i} whileHover={{ y: -2 }} className="rounded-xl border border-border p-3">
                              <div className="mb-2 flex items-center justify-between">
                                <h4 className="font-medium">{x.title}</h4>
                                <Badge>Retention / Risk</Badge>
                              </div>
                              <p className="text-sm text-slate-500 dark:text-slate-400">{x.why}</p>
                            </motion.div>
                          ))}
                        </div>
                      </Card>

                      <Card>
                        <SectionTitle title="Innovation Lab" subtitle="Disruptive and globally-inspired concepts." />
                        <div className="space-y-2">
                          {(latestRun.disruptive_recommendations?.innovation_lab || []).map((x, i) => (
                            <motion.div key={i} whileHover={{ scale: 1.01 }} className="rounded-xl border border-border p-3">
                              <div className="mb-1 flex items-center justify-between gap-2">
                                <h4 className="font-medium">{x.idea}</h4>
                                <Lightbulb className="h-4 w-4 text-amber-500" />
                              </div>
                              <p className="text-sm text-slate-500 dark:text-slate-400">{x.fit}</p>
                              <p className="mt-2 text-xs">Inspiration: {x.inspiration}</p>
                            </motion.div>
                          ))}
                        </div>
                      </Card>
                    </div>
                  </section>
                ) : null}
              </section>
            ) : null}

            {tab === 'signals' ? (
              <section className="space-y-4">
                <SectionTitle
                  title="Real-World Signals"
                  subtitle="Ingest and fuse live X/Twitter narratives with Argentine media headlines."
                />
                <RealWorldSignals
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
                  <SectionTitle title="Archetype Manager" subtitle="Visual cards + editable behavioral profiles." />
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
                      New Archetype
                    </Button>
                    <Button variant="outline" onClick={() => exportJson('archetypes.json', archetypes)}>
                      Export
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
                            Edit
                          </Button>
                          <Button variant="danger" onClick={() => removeArchetype(a.id)}>
                            Delete
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
                  <SectionTitle title="Scenario Manager" subtitle="Persistent scenario library with editable context baselines." />
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
                    New Scenario
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
                          Save
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
                          Duplicate
                        </Button>
                        <Button variant="danger" onClick={() => removeScenario(s.id)}>
                          Delete
                        </Button>
                      </div>
                    </Card>
                  ))}
                </div>
              </section>
            ) : null}

            {tab === 'runs' ? (
              <section className="space-y-4">
                <SectionTitle title="Past Runs" subtitle="Review, duplicate, and export historical simulations." />
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
                          Open
                        </Button>
                        <Button variant="outline" onClick={() => duplicateRun(r.id)}>
                          Duplicate
                        </Button>
                        <Button variant="outline" onClick={() => exportJson(`run-${r.id}.json`, r)}>
                          Export
                        </Button>
                      </div>
                    </Card>
                  ))}
                </div>
              </section>
            ) : null}

            {tab === 'settings' ? (
              <section className="space-y-4">
                <SectionTitle title="Settings" subtitle="Runtime provider and model preferences." />
                <Card className="max-w-xl space-y-3">
                  <div>
                    <label className="mb-1 block text-xs">LLM Provider</label>
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
                    <label className="mb-1 block text-xs">LLM Model</label>
                    <Input
                      value={String(settings.llm_model || '')}
                      onChange={(e) => setSettings((s) => ({ ...s, llm_model: e.target.value }))}
                    />
                  </div>
                  <Button onClick={saveSettings}>Save Settings</Button>
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
