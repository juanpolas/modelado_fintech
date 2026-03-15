'use client'

import { useEffect, useMemo, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import {
  Activity,
  AlertTriangle,
  BarChart3,
  FlaskConical,
  Landmark,
  Lightbulb,
  LogOut,
  Moon,
  PanelLeftClose,
  PanelLeftOpen,
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
  Sankey,
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

type TabKey = 'new' | 'signals' | 'archetypes' | 'contexts' | 'scenarios' | 'runs' | 'settings'
type Lang = 'es' | 'en'
type ContextProfile = {
  id: string
  title: string
  description: string
  country_context: Record<string, QualLevel>
}

const NAV_ITEMS: Array<{ key: TabKey; icon: React.ComponentType<{ className?: string }> }> = [
  { key: 'new', icon: FlaskConical },
  { key: 'signals', icon: Activity },
  { key: 'archetypes', icon: Users },
  { key: 'contexts', icon: Shield },
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
      contexts: 'Contextos',
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
      contexts: 'Contexts',
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

const DEFAULT_ARCHETYPE_IDS = new Set([
  'rate_seeker',
  'promo_hunter',
  'anti_bank_user',
  'conservative_salaried',
  'crypto_opportunist',
  'inflation_defensive_saver',
  'low_trust_fast_withdrawer',
  'everyday_transactional',
])

const SCENARIO_ES_BY_ID: Record<string, { name: string; description: string }> = {
  wallet_yield_increase: {
    name: 'suba de rendimiento en billetera',
    description: 'Línea base por defecto para suba de rendimiento en billetera.',
  },
  competitor_yield_increase: {
    name: 'suba de rendimiento de competidor',
    description: 'Línea base por defecto para suba de rendimiento de competidor.',
  },
  cashback_campaign_launch: {
    name: 'lanzamiento de campaña de cashback',
    description: 'Línea base por defecto para lanzamiento de campaña de cashback.',
  },
  negative_rumor: {
    name: 'rumor negativo en redes sociales',
    description: 'Línea base por defecto para rumor negativo en redes sociales.',
  },
  fx_devaluation_shock: {
    name: 'shock de devaluación / movimiento FX',
    description: 'Línea base por defecto para shock de devaluación / movimiento FX.',
  },
  stricter_kyc: {
    name: 'mayor fricción KYC',
    description: 'Línea base por defecto para mayor fricción KYC.',
  },
  crypto_drawdown: {
    name: 'evento de caída cripto',
    description: 'Línea base por defecto para evento de caída cripto.',
  },
  app_instability: {
    name: 'incidente de inestabilidad de app',
    description: 'Línea base por defecto para incidente de inestabilidad de app.',
  },
  trust_crisis: {
    name: 'crisis de confianza',
    description: 'Línea base por defecto para crisis de confianza.',
  },
  regulatory_tightening: {
    name: 'endurecimiento regulatorio',
    description: 'Línea base por defecto para endurecimiento regulatorio.',
  },
  loan_demand_stress: {
    name: 'evento de estrés de demanda de crédito',
    description: 'Línea base por defecto para evento de estrés de demanda de crédito.',
  },
  liquidity_panic: {
    name: 'evento de pánico de liquidez',
    description: 'Línea base por defecto para evento de pánico de liquidez.',
  },
}

const SCENARIO_EN_NAME_BY_ID: Record<string, string> = {
  wallet_yield_increase: 'wallet yield increase',
  competitor_yield_increase: 'competitor yield increase',
  cashback_campaign_launch: 'cashback campaign launch',
  negative_rumor: 'negative rumor on social media',
  fx_devaluation_shock: 'sudden FX move / devaluation shock',
  stricter_kyc: 'stricter KYC friction',
  crypto_drawdown: 'crypto drawdown event',
  app_instability: 'app instability incident',
  trust_crisis: 'trust crisis',
  regulatory_tightening: 'regulatory tightening',
  loan_demand_stress: 'loan demand stress event',
  liquidity_panic: 'liquidity panic event',
}

const ARCHETYPE_PROP_META_ES: Record<string, string> = {
  trust_level: 'Nivel de confianza inicial del segmento.',
  liquidity_preference: 'Preferencia por liquidez inmediata ante estrés.',
  crypto_affinity: 'Tendencia a migrar hacia cripto como cobertura.',
  rumor_sensitivity: 'Qué tanto reacciona a rumores o ruido social.',
  macro_anxiety: 'Ansiedad frente a inflación, dólar y riesgo país.',
  risk_aversion: 'Aversión a tomar riesgo financiero.',
}

const ARCHETYPE_PROP_META_EN: Record<string, string> = {
  trust_level: 'Baseline trust level of this segment.',
  liquidity_preference: 'Preference for immediate liquidity under stress.',
  crypto_affinity: 'Tendency to move into crypto as hedge.',
  rumor_sensitivity: 'Sensitivity to rumors and social noise.',
  macro_anxiety: 'Anxiety around inflation, FX and country risk.',
  risk_aversion: 'Aversion to financial risk taking.',
}

const COMPANY_FIELD_DOC: Record<
  string,
  {
    es: { label: string; help: string }
    en: { label: string; help: string }
  }
> = {
  wallet_yield_current: {
    es: { label: 'Rendimiento actual de billetera', help: 'Nivel de rendimiento vigente hoy en tu producto.' },
    en: { label: 'Current wallet yield', help: 'Current yield level in your product.' },
  },
  wallet_yield_new: {
    es: { label: 'Rendimiento propuesto', help: 'Rendimiento que querés testear para medir impacto en retención/migración.' },
    en: { label: 'Proposed wallet yield', help: 'Yield you want to test for retention/migration impact.' },
  },
  competitor_yield: {
    es: { label: 'Rendimiento del competidor', help: 'Nivel de atractivo externo que compite por tus saldos.' },
    en: { label: 'Competitor yield', help: 'External attractiveness competing for your balances.' },
  },
  cashback_percent: {
    es: { label: 'Intensidad de cashback', help: 'Magnitud del incentivo promocional para activar uso.' },
    en: { label: 'Cashback intensity', help: 'Promotional incentive level to activate usage.' },
  },
  cashback_cap: {
    es: { label: 'Tope de cashback', help: 'Límite del beneficio para controlar costo y abuso.' },
    en: { label: 'Cashback cap', help: 'Benefit limit to control cost and abuse.' },
  },
  onboarding_friction: {
    es: { label: 'Fricción de onboarding', help: 'Dificultad de alta inicial; afecta conversión y abandono temprano.' },
    en: { label: 'Onboarding friction', help: 'Sign-up difficulty; impacts conversion and early drop-off.' },
  },
  KYC_friction: {
    es: { label: 'Fricción KYC', help: 'Carga de verificación regulatoria; impacta velocidad de activación.' },
    en: { label: 'KYC friction', help: 'Regulatory verification burden; impacts activation speed.' },
  },
  app_stability: {
    es: { label: 'Estabilidad de app', help: 'Confiabilidad operativa percibida; clave para confianza y pánico.' },
    en: { label: 'App stability', help: 'Perceived operational reliability; key for trust and panic.' },
  },
  transfer_limits: {
    es: { label: 'Límites de transferencia', help: 'Restricciones de movimiento que pueden frenar o desviar fondos.' },
    en: { label: 'Transfer limits', help: 'Movement constraints that can slow or redirect funds.' },
  },
  withdrawal_delay_risk: {
    es: { label: 'Riesgo de demora en retiros', help: 'Probabilidad percibida de fricción/demora al retirar.' },
    en: { label: 'Withdrawal delay risk', help: 'Perceived probability of friction/delay when withdrawing.' },
  },
  support_quality: {
    es: { label: 'Calidad de soporte', help: 'Capacidad de contener incertidumbre y sostener confianza.' },
    en: { label: 'Support quality', help: 'Ability to contain uncertainty and preserve trust.' },
  },
  trust_baseline: {
    es: { label: 'Confianza base en la marca', help: 'Punto de partida reputacional antes de shocks externos.' },
    en: { label: 'Baseline trust in brand', help: 'Reputational starting point before external shocks.' },
  },
  credit_offer_aggressiveness: {
    es: { label: 'Agresividad comercial de crédito', help: 'Qué tan fuerte empujás originación/oferta crediticia.' },
    en: { label: 'Credit offer aggressiveness', help: 'How aggressively lending offers are pushed.' },
  },
  loan_rate_level: {
    es: { label: 'Nivel de tasa de crédito', help: 'Costo del crédito para el usuario; afecta demanda y estrés.' },
    en: { label: 'Loan rate level', help: 'User borrowing cost; affects demand and stress.' },
  },
}

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
  const [dark, setDark] = useState(true)
  const [sidebarCollapsed, setSidebarCollapsed] = useState(true)
  const [lang, setLang] = useState<Lang>('es')
  const [error, setError] = useState('')
  const [info, setInfo] = useState('')

  const [accessCode, setAccessCode] = useState('')
  const [archetypes, setArchetypes] = useState<Archetype[]>([])
  const [scenarios, setScenarios] = useState<Scenario[]>([])
  const [runs, setRuns] = useState<RunRecord[]>([])
  const [latestRun, setLatestRun] = useState<RunRecord | null>(null)
  const [sim, setSim] = useState<SimulationPayload>(emptyPayload())
  const [simStep, setSimStep] = useState(1)
  const [settings, setSettings] = useState<Record<string, unknown>>({ llm_provider: 'mock' })
  const [contextProfiles, setContextProfiles] = useState<ContextProfile[]>([])
  const [selectedContextId, setSelectedContextId] = useState<string | null>(null)

  const [editingArchetype, setEditingArchetype] = useState<Archetype | null>(null)
  const [selectedArchetypeId, setSelectedArchetypeId] = useState<string | null>(null)
  const [selectedScenarioId, setSelectedScenarioId] = useState<string | null>(null)
  const [excludedArchetypes, setExcludedArchetypes] = useState<Record<string, boolean>>({})
  const [futureText, setFutureText] = useState('')
  const [impactText, setImpactText] = useState('')
  const [panicOpen, setPanicOpen] = useState(false)
  const [downloadingPdf, setDownloadingPdf] = useState(false)
  const [llmContextPrompt, setLlmContextPrompt] = useState('')
  const [llmContextTitle, setLlmContextTitle] = useState('')
  const [llmContextDescription, setLlmContextDescription] = useState('')
  const [llmGeneratedCountryContext, setLlmGeneratedCountryContext] = useState<Record<string, QualLevel> | null>(null)
  const [llmContextLoading, setLlmContextLoading] = useState(false)
  const [llmReviewContextLoading, setLlmReviewContextLoading] = useState(false)
  const [llmReviewScenarioLoading, setLlmReviewScenarioLoading] = useState(false)
  const [llmScenarioPrompt, setLlmScenarioPrompt] = useState('')
  const [llmScenarioLoading, setLlmScenarioLoading] = useState(false)
  const [hypoAffectsCountry, setHypoAffectsCountry] = useState(true)
  const [hypoAffectsCompany, setHypoAffectsCompany] = useState(true)
  const [baselineContextTitle, setBaselineContextTitle] = useState<string>('')
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
    const storedProfiles = Array.isArray(st.context_profiles) ? (st.context_profiles as ContextProfile[]) : []
    const baseProfile: ContextProfile = {
      id: 'ctx_base_default',
      title: lang === 'es' ? 'Contexto Base Argentina v2' : 'Argentina Base Context v2',
      description:
        lang === 'es'
          ? 'Perfil base editable para simulaciones.'
          : 'Editable baseline profile for simulations.',
      country_context: copy(DEFAULT_COUNTRY_CONTEXT),
    }
    const normalizedStoredProfiles = storedProfiles.map((p) =>
      p.id === 'ctx_base_default'
        ? {
            ...p,
            title: baseProfile.title,
          }
        : p
    )
    const withBase =
      normalizedStoredProfiles.some((p) => p.id === 'ctx_base_default')
        ? normalizedStoredProfiles
        : [baseProfile, ...normalizedStoredProfiles]
    const mergedProfiles = withBase.length ? withBase : [baseProfile]
    setContextProfiles(mergedProfiles)
    if (!selectedContextId) {
      const preferred = mergedProfiles.find((p) => p.id === 'ctx_base_default') || mergedProfiles[0]
      if (preferred) setSelectedContextId(preferred.id)
    }
    if (!baselineContextTitle) {
      const preferred = mergedProfiles.find((p) => p.id === 'ctx_base_default') || mergedProfiles[0]
      if (preferred) setBaselineContextTitle(preferred.title)
    }
    if (!latestRun && r[0]) setLatestRun(r[0])
    if (!selectedArchetypeId && a[0]) setSelectedArchetypeId(a[0].id)
    if (!selectedScenarioId && s[0]) setSelectedScenarioId(s[0].id)

    setSim((prev) => {
      const next = copy(prev)
      if (Object.keys(next.archetype_mix).length === 0 && a.length) {
        const even = Number((100 / a.length).toFixed(2))
        for (const item of a) next.archetype_mix[item.id] = even
      }
      return next
    })
  }

  useEffect(() => {
    if (!archetypes.length) return
    if (!selectedArchetypeId || !archetypes.some((a) => a.id === selectedArchetypeId)) {
      setSelectedArchetypeId(archetypes[0].id)
    }
  }, [archetypes, selectedArchetypeId])

  useEffect(() => {
    if (!archetypes.length) return
    // Keep exclusion map aligned with the currently available archetypes.
    setExcludedArchetypes((prev) => {
      const next: Record<string, boolean> = {}
      for (const a of archetypes) {
        if (prev[a.id]) next[a.id] = true
      }
      return next
    })
  }, [archetypes])

  useEffect(() => {
    if (!scenarios.length) return
    if (!selectedScenarioId || !scenarios.some((s) => s.id === selectedScenarioId)) {
      setSelectedScenarioId(scenarios[0].id)
    }
  }, [scenarios, selectedScenarioId])

  useEffect(() => {
    if (!contextProfiles.length) return
    if (!selectedContextId || !contextProfiles.some((c) => c.id === selectedContextId)) {
      setSelectedContextId(contextProfiles[0].id)
    }
  }, [contextProfiles, selectedContextId])

  useEffect(() => {
    const ctx = contextProfiles.find((c) => c.id === selectedContextId) || contextProfiles[0]
    if (ctx?.title) setBaselineContextTitle(ctx.title)
  }, [contextProfiles, selectedContextId])

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
  const wizardStepMeta = useMemo(
    () =>
      lang === 'es'
        ? [
            {
              title: 'Señales',
              short: 'Ingesta de X + noticias y fusión de señales.',
              rationale: 'Define el contexto de entrada real. Si esta etapa está mal, el resto de la simulación pierde validez.',
            },
            {
              title: 'Contexto AR',
              short: 'Base actual vs hipótesis a testear.',
              rationale: 'Separa “cómo está hoy” de “qué pasaría si…”, para interpretar resultados con trazabilidad.',
            },
            {
              title: 'Estrategia de Compañía',
              short: 'Palancas de producto, fricción y confianza.',
              rationale: 'Modela decisiones accionables del negocio y su impacto en conducta de usuarios.',
            },
            {
              title: 'Mix de Arquetipos',
              short: 'Composición poblacional por segmentos.',
              rationale: 'La mezcla define sensibilidad sistémica: cambia contagio, churn y salida de fondos.',
            },
            {
              title: 'Revisión y Run',
              short: 'Chequeo final de parámetros y ejecución.',
              rationale: 'Garantiza que el experimento sea entendible y reproducible antes de correr.',
            },
            {
              title: 'Resultados',
              short: 'KPIs, dinámica temporal y distribución de acciones.',
              rationale: 'Muestra impacto agregado y evolución del riesgo durante la simulación.',
            },
            {
              title: 'Contagio',
              short: 'Propagación de comportamiento entre arquetipos.',
              rationale: 'Explica quién dispara el evento, quién amplifica y quién resiste.',
            },
            {
              title: 'Recomendaciones',
              short: 'Acciones tácticas e ideas de innovación.',
              rationale: 'Traduce hallazgos del modelo en decisiones ejecutables de corto y mediano plazo.',
            },
          ]
        : [
            {
              title: 'Signals',
              short: 'Ingest X + news and fuse signals.',
              rationale: 'Sets the real input context. If this stage is wrong, downstream simulation quality drops.',
            },
            {
              title: 'Argentina Context',
              short: 'Current baseline vs hypothesis under test.',
              rationale: 'Separates “current state” from “what-if” assumptions for traceable interpretation.',
            },
            {
              title: 'Company Strategy',
              short: 'Product levers, friction and trust controls.',
              rationale: 'Models actionable business decisions and their behavioral impact.',
            },
            {
              title: 'Archetype Mix',
              short: 'Population composition by segment.',
              rationale: 'Composition defines systemic sensitivity: contagion, churn and outflows.',
            },
            {
              title: 'Review & Run',
              short: 'Final check and execution.',
              rationale: 'Ensures the experiment is understandable and reproducible before running.',
            },
            {
              title: 'Results',
              short: 'KPIs, timeline dynamics and action mix.',
              rationale: 'Shows aggregate impact and risk evolution across the run.',
            },
            {
              title: 'Contagion',
              short: 'Behavior spread across archetypes.',
              rationale: 'Explains trigger segments, amplifiers and resilient groups.',
            },
            {
              title: 'Recommendations',
              short: 'Tactical actions and innovation ideas.',
              rationale: 'Converts model findings into practical strategy decisions.',
            },
          ],
    [lang]
  )

  const currentMetrics = latestRun?.outputs?.single_run
  const timeline = currentMetrics?.timeline || []

  const donutData = ACTION_ORDER.map((key) => ({
    name: key,
    value: currentMetrics?.final_action_distribution?.[key] || 0,
  })).filter((x) => x.value > 0)
  const sankeyData = useMemo(() => buildSankeyData(currentMetrics), [currentMetrics])
  const panicScore = Number(currentMetrics?.panic_index_score || 0)
  const panicLabel = currentMetrics?.panic_index_label || 'Normal'
  const panicMainDriver = currentMetrics?.panic_index_main_driver || 'trust_deterioration'

  const selectedArchetype = useMemo(
    () => archetypes.find((a) => a.id === selectedArchetypeId) || archetypes[0] || null,
    [archetypes, selectedArchetypeId]
  )
  const otherArchetypes = useMemo(
    () => archetypes.filter((a) => a.id !== selectedArchetype?.id),
    [archetypes, selectedArchetype]
  )
  const selectedScenario = useMemo(
    () => scenarios.find((s) => s.id === selectedScenarioId) || scenarios[0] || null,
    [scenarios, selectedScenarioId]
  )
  const otherScenarios = useMemo(
    () => scenarios.filter((s) => s.id !== selectedScenario?.id),
    [scenarios, selectedScenario]
  )
  const selectedContext = useMemo(
    () => contextProfiles.find((c) => c.id === selectedContextId) || contextProfiles[0] || null,
    [contextProfiles, selectedContextId]
  )
  const otherContexts = useMemo(
    () => contextProfiles.filter((c) => c.id !== selectedContext?.id),
    [contextProfiles, selectedContext]
  )

  function localizeScenarioNameById(id: string, fallback: string) {
    if (lang !== 'es') return fallback
    return SCENARIO_ES_BY_ID[id]?.name || fallback
  }

  function localizeScenarioDescriptionById(id: string, fallback: string) {
    if (lang !== 'es') return fallback
    return SCENARIO_ES_BY_ID[id]?.description || fallback
  }

  function localizeScenarioNameLoose(name: string) {
    if (lang !== 'es') return name
    if (SCENARIO_ES_BY_ID[name]) return SCENARIO_ES_BY_ID[name].name
    const byEnglish = Object.entries(SCENARIO_EN_NAME_BY_ID).find(([, en]) => en.toLowerCase() === name.toLowerCase())
    if (byEnglish) return SCENARIO_ES_BY_ID[byEnglish[0]]?.name || name
    return name
  }

  function getArchetypeOrigin(a: Archetype): 'default' | 'x' | 'custom' {
    if (a.origin === 'twitter') return 'x'
    if (a.origin === 'custom') return 'custom'
    if (a.origin === 'default') return 'default'
    if (DEFAULT_ARCHETYPE_IDS.has(a.id)) return 'default'
    const blob = `${a.id} ${a.name} ${a.description}`.toLowerCase()
    if (/(x\.com|twitter|tweet|señal|signal|narrativ|tendencia|trend)/i.test(blob)) return 'x'
    return 'custom'
  }

  function getScenarioOrigin(s: Scenario): 'default' | 'custom' {
    if (SCENARIO_ES_BY_ID[s.id]) return 'default'
    return 'custom'
  }

  function saveContextProfiles(nextProfiles: ContextProfile[]) {
    setContextProfiles(nextProfiles)
    const nextSettings = { ...settings, context_profiles: nextProfiles }
    setSettings(nextSettings)
    void api.saveSettings(nextSettings).catch((e) => setError((e as Error).message))
  }

  async function generateContextFromLLM() {
    const text = llmContextPrompt.trim()
    if (!text) {
      setError(lang === 'es' ? 'Escribí un evento para traducir.' : 'Write an event to translate.')
      return
    }
    setLlmContextLoading(true)
    setError('')
    try {
      const out = await api.translateScenario(text)
      const generated = out.country_context as Record<string, QualLevel>
      setLlmGeneratedCountryContext(generated)
      if (!llmContextTitle.trim()) {
        const short = text.length > 48 ? `${text.slice(0, 48)}...` : text
        setLlmContextTitle(lang === 'es' ? `Contexto: ${short}` : `Context: ${short}`)
      }
      if (!llmContextDescription.trim()) {
        const notes = Array.isArray((out as { notes?: unknown }).notes) ? ((out as { notes?: string[] }).notes || []).join(' | ') : ''
        setLlmContextDescription(notes || (lang === 'es' ? 'Contexto generado por LLM a partir de evento narrativo.' : 'Context generated by LLM from narrative event.'))
      }
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setLlmContextLoading(false)
    }
  }

  function saveGeneratedContextAsNew() {
    if (!llmGeneratedCountryContext) {
      setError(lang === 'es' ? 'Primero generá un contexto con LLM.' : 'Generate a context with LLM first.')
      return
    }
    const id = `ctx_${Math.floor(Math.random() * 999999)}`
    const next: ContextProfile = {
      id,
      title: llmContextTitle.trim() || (lang === 'es' ? `Nuevo contexto ${id}` : `New context ${id}`),
      description: llmContextDescription.trim() || (lang === 'es' ? 'Contexto generado por LLM.' : 'LLM generated context.'),
      country_context: {
        ...copy(DEFAULT_COUNTRY_CONTEXT),
        ...llmGeneratedCountryContext,
      },
    }
    const updated = [next, ...contextProfiles]
    setSelectedContextId(id)
    saveContextProfiles(updated)
  }

  async function updateSelectedContextWithLLM() {
    if (!selectedContext) return
    setLlmReviewContextLoading(true)
    setError('')
    setInfo('')
    try {
      const reviewed = await api.reviewContextWithLlm({
        context_profile: {
          id: selectedContext.id,
          title: selectedContext.title,
          description: selectedContext.description,
          country_context: selectedContext.country_context,
        },
      })
      setContextProfiles((prev) =>
        prev.map((x) =>
          x.id === selectedContext.id
            ? {
                ...x,
                title: reviewed.title || x.title,
                description: reviewed.description || x.description,
                country_context: {
                  ...x.country_context,
                  ...(reviewed.country_context as Record<string, QualLevel>),
                },
              }
            : x
        )
      )
      setInfo(
        lang === 'es'
          ? 'Contexto actualizado con revisión LLM. Revisá los cambios y guardá.'
          : 'Context updated with LLM review. Check changes and save.'
      )
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setLlmReviewContextLoading(false)
    }
  }

  async function updateSelectedScenarioWithLLM() {
    if (!selectedScenario) return
    setLlmReviewScenarioLoading(true)
    setError('')
    setInfo('')
    try {
      const reviewed = await api.reviewScenarioWithLlm({
        scenario: {
          id: selectedScenario.id,
          name: selectedScenario.name,
          description: selectedScenario.description,
          default_country_context: selectedScenario.default_country_context,
          default_company_context: selectedScenario.default_company_context,
          notes: selectedScenario.notes,
        },
      })
      setScenarios((prev) =>
        prev.map((x) =>
          x.id === selectedScenario.id
            ? {
                ...x,
                name: reviewed.name || x.name,
                description: reviewed.description || x.description,
                default_country_context: {
                  ...x.default_country_context,
                  ...(reviewed.default_country_context as Record<string, QualLevel>),
                },
                default_company_context: {
                  ...x.default_company_context,
                  ...(reviewed.default_company_context as Record<string, QualLevel>),
                },
                notes: reviewed.notes || x.notes,
              }
            : x
        )
      )
      setInfo(
        lang === 'es'
          ? 'Escenario actualizado con revisión LLM. Revisá y guardá.'
          : 'Scenario updated with LLM review. Review and save.'
      )
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setLlmReviewScenarioLoading(false)
    }
  }

  async function validateHypotheticalWithLLM() {
    if (!selectedScenario) return
    setLlmReviewScenarioLoading(true)
    setError('')
    setInfo('')
    try {
      const reviewed = await api.reviewScenarioWithLlm({
        scenario: {
          id: selectedScenario.id,
          name: selectedScenario.name,
          description: selectedScenario.description,
          default_country_context: selectedScenario.default_country_context,
          default_company_context: selectedScenario.default_company_context,
          notes: selectedScenario.notes,
        },
      })
      setScenarios((prev) =>
        prev.map((x) =>
          x.id === selectedScenario.id
            ? {
                ...x,
                name: reviewed.name || x.name,
                description: reviewed.description || x.description,
                default_country_context: {
                  ...x.default_country_context,
                  ...(reviewed.default_country_context as Record<string, QualLevel>),
                },
                default_company_context: {
                  ...x.default_company_context,
                  ...(reviewed.default_company_context as Record<string, QualLevel>),
                },
                notes: reviewed.notes || x.notes,
              }
            : x
        )
      )
      setInfo(
        lang === 'es'
          ? 'Escenario hipotético validado por LLM. Podés aplicarlo a la simulación.'
          : 'Hypothetical scenario validated by LLM. You can now apply it to the simulation.'
      )
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setLlmReviewScenarioLoading(false)
    }
  }

  async function generateScenarioFromLLM() {
    const text = llmScenarioPrompt.trim()
    if (!text) {
      setError(lang === 'es' ? 'Escribí una hipótesis para generar el escenario.' : 'Write a hypothesis to generate the scenario.')
      return
    }
    setLlmScenarioLoading(true)
    setError('')
    setInfo('')
    try {
      const generated = await api.generateScenarioWithLlm({ text, lang })
      const id = `scenario_ai_${Math.floor(Math.random() * 999999)}`
      const newScenario: Scenario = {
        id,
        name: generated.name || (lang === 'es' ? 'Escenario hipotético IA' : 'AI hypothetical scenario'),
        description: generated.description || '',
        default_country_context: generated.default_country_context as Record<string, QualLevel>,
        default_company_context: generated.default_company_context as Record<string, QualLevel>,
        notes: generated.notes || '',
      }
      await saveScenario(newScenario)
      setSelectedScenarioId(id)
      setInfo(
        lang === 'es'
          ? 'Escenario hipotético generado por LLM. Revisá, ajustá y luego aplicalo en Nueva Simulación.'
          : 'Hypothetical scenario generated by LLM. Review, adjust, and apply it in New Simulation.'
      )
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setLlmScenarioLoading(false)
    }
  }

  function applyHypotheticalScenarioToSimulation() {
    if (!selectedScenario) return
    setSim((prev) => ({
      ...prev,
      scenario_id: selectedScenario.id,
      scenario_name: selectedScenario.name,
      country_context: hypoAffectsCountry
        ? { ...prev.country_context, ...selectedScenario.default_country_context }
        : prev.country_context,
      company_context: hypoAffectsCompany
        ? { ...prev.company_context, ...selectedScenario.default_company_context }
        : prev.company_context,
    }))
    setInfo(
      lang === 'es'
        ? `Escenario hipotético aplicado: ${localizeScenarioNameById(selectedScenario.id, selectedScenario.name)}.`
        : `Hypothetical scenario applied: ${localizeScenarioNameById(selectedScenario.id, selectedScenario.name)}.`
    )
  }

  const canAdvanceFromContextStep = simStep !== 2 || (Boolean(selectedScenarioId) && sim.scenario_id === selectedScenarioId)

  function goNextStep() {
    if (simStep === 2 && !canAdvanceFromContextStep) {
      setError(
        lang === 'es'
          ? 'Para continuar, primero elegí un escenario hipotético y hacé clic en "Aplicar a simulación".'
          : 'To continue, first select a hypothetical scenario and click "Apply to simulation".'
      )
      return
    }
    setError('')
    setSimStep((s) => Math.min(8, s + 1))
  }

  function levelBadgeClass(level?: QualLevel) {
    if (level === 'very_high') return 'border-red-500/40 bg-red-500/15 text-red-300'
    if (level === 'high') return 'border-orange-500/40 bg-orange-500/15 text-orange-300'
    if (level === 'medium') return 'border-amber-500/40 bg-amber-500/15 text-amber-200'
    if (level === 'low') return 'border-blue-500/40 bg-blue-500/15 text-blue-300'
    return 'border-emerald-500/40 bg-emerald-500/15 text-emerald-300'
  }

  function qualLabel(level: QualLevel) {
    if (lang === 'es') {
      if (level === 'very_low') return 'muy_bajo'
      if (level === 'low') return 'bajo'
      if (level === 'medium') return 'medio'
      if (level === 'high') return 'alto'
      return 'muy_alto'
    }
    return level
  }

  function toggleArchetypeInSimulation(archetypeId: string) {
    setExcludedArchetypes((prev) => {
      const willExclude = !prev[archetypeId]
      setSim((old) => ({
        ...old,
        archetype_mix: {
          ...old.archetype_mix,
          // Excluded archetypes are forced to 0 so they do not participate in the run.
          [archetypeId]: willExclude ? 0 : Number(old.archetype_mix[archetypeId] || 0),
        },
      }))
      return { ...prev, [archetypeId]: willExclude }
    })
  }

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
      setError(
        lang === 'es'
          ? `La mezcla de arquetipos debe sumar 100 (actual: ${mixTotal.toFixed(2)})`
          : `Archetype mix must total 100 (current: ${mixTotal.toFixed(2)})`
      )
      return
    }

    try {
      const payload = { ...sim, report_language: lang as 'es' | 'en' }
      const run = await api.simulate(payload)
      setLatestRun(run)
      const rr = await api.runs()
      setRuns(rr)
      setSimStep(6)
    } catch (e) {
      setError((e as Error).message)
    }
  }

  async function downloadReportPdf(runId: string) {
    try {
      setDownloadingPdf(true)
      const blob = await api.downloadRunReportPdf(runId, lang)
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `run_${runId}_report_${lang}.pdf`
      a.click()
      URL.revokeObjectURL(url)
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setDownloadingPdf(false)
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
          <h1 className="text-2xl font-bold sm:text-3xl">AR Fintech Simulator</h1>
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
    <div className="dashboard-bg min-h-screen p-2 sm:p-4">
      <div className="mx-auto flex max-w-[1600px] flex-col gap-4 lg:flex-row">
        <aside
          className={`glass-card sticky top-4 hidden h-[calc(100vh-2rem)] flex-col p-4 transition-all duration-200 lg:flex ${
            sidebarCollapsed ? 'w-[86px]' : 'w-[270px]'
          }`}
        >
          <div className="mb-6">
            <div className={`flex items-start ${sidebarCollapsed ? 'justify-center' : 'justify-between'}`}>
              {!sidebarCollapsed ? (
                <div>
                  <p className="text-xs uppercase tracking-[0.22em] text-slate-400">AR Fintech</p>
                  <h1 className="mt-2 text-xl font-semibold">{lang === 'es' ? 'Inteligencia Fintech' : 'Fintech Intelligence'}</h1>
                  <p className="mt-1 text-xs text-slate-400">{t.appSubtitle}</p>
                </div>
              ) : null}
              <Button
                variant="outline"
                className={sidebarCollapsed ? 'px-2 py-2' : 'px-2 py-2'}
                onClick={() => setSidebarCollapsed((v) => !v)}
                title={sidebarCollapsed ? (lang === 'es' ? 'Expandir menú' : 'Expand menu') : (lang === 'es' ? 'Ocultar menú' : 'Collapse menu')}
              >
                {sidebarCollapsed ? <PanelLeftOpen className="h-4 w-4" /> : <PanelLeftClose className="h-4 w-4" />}
              </Button>
            </div>
          </div>
          <div className="space-y-2">
            {NAV_ITEMS.map((item) => {
              const Icon = item.icon
              const active = tab === item.key
              return (
                <button
                  key={item.key}
                  onClick={() => setTab(item.key)}
                  title={t.nav[item.key]}
                  className={`flex w-full items-center rounded-xl px-3 py-2 text-left text-sm transition ${
                    active ? 'bg-primary/20 text-white' : 'text-slate-300 hover:bg-white/5'
                  }`}
                >
                  <Icon className="h-4 w-4" />
                  {!sidebarCollapsed ? <span className="ml-3">{t.nav[item.key]}</span> : null}
                </button>
              )
            })}
          </div>
          <div className="mt-auto space-y-2">
            <div className={`flex gap-2 ${sidebarCollapsed ? 'flex-col' : ''}`}>
              <Button className={sidebarCollapsed ? '' : 'flex-1'} variant="outline" onClick={() => setLang((v) => (v === 'es' ? 'en' : 'es'))} title={lang === 'es' ? 'Cambiar idioma' : 'Switch language'}>
                {lang.toUpperCase()}
              </Button>
              <Button className={sidebarCollapsed ? '' : 'flex-1'} variant="outline" onClick={() => setDark((v) => !v)} title={dark ? t.light : t.dark}>
                {dark ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
              </Button>
            </div>
            <Button className="w-full" variant="danger" onClick={doLogout} title={t.logout}>
              <span className="inline-flex items-center gap-2">
                <LogOut className="h-4 w-4" /> {!sidebarCollapsed ? t.logout : null}
              </span>
            </Button>
          </div>
        </aside>

        <section className="min-w-0 flex-1 space-y-4">
          <header className="glass-card rounded-2xl p-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h2 className="text-xl font-semibold sm:text-2xl">{t.nav[tab]}</h2>
                <p className="text-[11px] text-slate-400 sm:text-xs">{lang === 'es' ? 'Plataforma de inteligencia de comportamiento para equipos de estrategia.' : 'Behavior intelligence platform for strategy teams.'}</p>
              </div>
              <div className="w-full overflow-x-auto lg:hidden">
                <div className="flex gap-2 pb-1">
                {NAV_ITEMS.map((item) => {
                  const Icon = item.icon
                  return (
                    <Button key={item.key} className="shrink-0" variant={tab === item.key ? 'default' : 'outline'} onClick={() => setTab(item.key)}>
                      <span className="inline-flex items-center gap-2">
                        <Icon className="h-4 w-4" />
                        {t.nav[item.key]}
                      </span>
                    </Button>
                  )
                })}
                </div>
              </div>
              <div className="grid w-full grid-cols-2 gap-2 text-xs sm:w-auto sm:min-w-[220px]">
                <Card className="p-3">
                  <p className="text-slate-400">{lang === 'es' ? 'Escenario' : 'Scenario'}</p>
                  <p className="font-medium">
                    {sim.scenario_id
                      ? localizeScenarioNameById(sim.scenario_id, sim.scenario_name)
                      : localizeScenarioNameLoose(sim.scenario_name)}
                  </p>
                </Card>
                <Card className="p-3">
                  <p className="text-slate-400">{lang === 'es' ? 'Último Run' : 'Latest Run'}</p>
                  <p className="font-medium">{latestRun?.id || '-'}</p>
                </Card>
              </div>
            </div>
          </header>

          <main className="space-y-6">
        {error ? <Card className="border-red-400 text-red-700 dark:text-red-300">{error}</Card> : null}
        {info ? <Card className="border-emerald-400 text-emerald-700 dark:text-emerald-300">{info}</Card> : null}

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
                <Card className="border-primary/30 bg-gradient-to-r from-blue-500/10 via-indigo-500/10 to-violet-500/10 p-6">
                  <SectionTitle
                    title={lang === 'es' ? 'Flujo Guiado de Simulación' : 'Guided Simulation Journey'}
                    subtitle={
                      lang === 'es'
                        ? 'Esta es la vista principal de trabajo: completá cada etapa para construir una simulación consistente y accionable.'
                        : 'This is the main working area: complete each stage to build a consistent, actionable simulation.'
                    }
                  />
                  <div className="mt-3 grid gap-3 md:grid-cols-3">
                    <Card className="p-3">
                      <p className="text-xs text-slate-400">{lang === 'es' ? 'Enfoque' : 'Focus'}</p>
                      <p className="mt-1 text-sm font-medium">{lang === 'es' ? 'Laboratorio de decisión' : 'Decision lab'}</p>
                    </Card>
                    <Card className="p-3">
                      <p className="text-xs text-slate-400">{lang === 'es' ? 'Qué construir' : 'What to build'}</p>
                      <p className="mt-1 text-sm font-medium">{lang === 'es' ? 'Escenario + contexto + respuesta' : 'Scenario + context + response'}</p>
                    </Card>
                    <Card className="p-3">
                      <p className="text-xs text-slate-400">{lang === 'es' ? 'Resultado esperado' : 'Expected output'}</p>
                      <p className="mt-1 text-sm font-medium">{lang === 'es' ? 'KPIs, contagio y recomendaciones' : 'KPIs, contagion and recommendations'}</p>
                    </Card>
                  </div>
                </Card>

                <Card className="space-y-4 p-5">
                  <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
                    {wizardStepMeta.map((stepMeta, idx) => {
                      const n = idx + 1
                      const active = simStep === n
                      const done = simStep > n
                      return (
                        <div
                          key={stepMeta.title}
                          title={stepMeta.rationale}
                          className={`group relative rounded-xl border p-3 text-xs transition ${
                            active ? 'border-primary bg-primary/10 shadow-[0_10px_22px_rgba(59,130,246,0.20)]' : 'border-border'
                          } ${done ? 'opacity-95' : ''}`}
                        >
                          <div className="mb-2 flex items-center gap-2">
                            <div className={`flex h-7 w-7 items-center justify-center rounded-full text-[11px] font-semibold ${active || done ? 'bg-primary text-white' : 'bg-muted'}`}>{n}</div>
                            <p className="font-medium">{stepMeta.title}</p>
                          </div>
                          <p className="text-[11px] text-slate-500 dark:text-slate-400">{stepMeta.short}</p>
                          <div className="pointer-events-none absolute left-2 right-2 top-full z-20 mt-2 rounded-lg border border-blue-500/20 bg-slate-950/95 p-2 text-[11px] text-slate-200 opacity-100 shadow-xl transition md:opacity-0 md:group-hover:opacity-100">
                            <p className="font-medium text-blue-300">{lang === 'es' ? 'Racional del paso' : 'Step rationale'}</p>
                            <p className="mt-1">{stepMeta.rationale}</p>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                  <div className="flex items-center justify-between">
                    <Button variant="outline" onClick={() => setSimStep((s) => Math.max(1, s - 1))} disabled={simStep === 1}>
                      {lang === 'es' ? 'Anterior' : 'Previous'}
                    </Button>
                    <Badge>{lang === 'es' ? 'Paso actual' : 'Current step'}: {wizardSteps[simStep - 1]}</Badge>
                    <Button variant="outline" onClick={goNextStep} disabled={simStep === 8 || !canAdvanceFromContextStep}>
                      {lang === 'es' ? 'Siguiente' : 'Next'}
                    </Button>
                  </div>
                  {simStep === 2 && !canAdvanceFromContextStep ? (
                    <p className="text-xs text-amber-600 dark:text-amber-300">
                      {lang === 'es'
                        ? 'Bloqueado: aplicá el escenario hipotético seleccionado para poder continuar.'
                        : 'Blocked: apply the selected hypothetical scenario to continue.'}
                    </p>
                  ) : null}
                </Card>

                {simStep === 1 ? (
                  <>
                    <StepIntro
                      title={lang === 'es' ? 'Objetivo del paso' : 'Step goal'}
                      description={
                        lang === 'es'
                          ? 'Cargar automáticamente señales en vivo (X + noticias), fusionarlas y decidir qué señales aplicar antes de continuar.'
                          : 'Auto-load live signals (X + news), fuse them, and decide which signals to apply before continuing.'
                      }
                    />
                    <RealWorldSignals
                      lang={lang}
                      autoLoadOnMount
                      syncOnChange
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
                  </>
                ) : null}

                {simStep === 2 ? (
                  <div className="space-y-4">
                    <StepIntro
                      title={lang === 'es' ? 'Objetivo del paso' : 'Step goal'}
                      description={
                        lang === 'es'
                          ? 'Separar base actual vs hipótesis: primero seleccionás el contexto fijo, luego aplicás el escenario hipotético que querés testear.'
                          : 'Separate current baseline vs hypothesis: first select fixed context, then apply the hypothetical scenario to test.'
                      }
                    />
                    <div className="grid gap-4 xl:grid-cols-2">
                      <Card className="space-y-3 border-emerald-500/30 bg-emerald-500/5">
                        <SectionTitle
                          title={lang === 'es' ? 'Base actual (fijo editable)' : 'Current baseline (editable fixed)'}
                          subtitle={
                            lang === 'es'
                              ? 'Representa condiciones actuales del país. Queda fijo hasta que lo cambies.'
                              : 'Represents current country conditions. Stays fixed until you change it.'
                          }
                        />
                        <div className="grid gap-3 md:grid-cols-[1fr_auto] md:items-end">
                          <div>
                            <label className="mb-1 block text-xs text-slate-400">{lang === 'es' ? 'Contexto base seleccionado' : 'Selected baseline context'}</label>
                            <Select
                              value={selectedContext?.id || ''}
                              onChange={(e) => {
                                const id = e.target.value
                                setSelectedContextId(id)
                                const ctx = contextProfiles.find((c) => c.id === id)
                                if (!ctx) return
                                setBaselineContextTitle(ctx.title)
                                setSim((prev) => ({ ...prev, country_context: copy(ctx.country_context) }))
                              }}
                            >
                              {contextProfiles.map((c) => (
                                <option key={c.id} value={c.id}>
                                  {c.title}
                                </option>
                              ))}
                            </Select>
                          </div>
                          <Button variant="outline" onClick={() => setTab('contexts')}>
                            {lang === 'es' ? 'Editar base' : 'Edit baseline'}
                          </Button>
                        </div>
                        <p className="text-xs text-slate-400">
                          {lang === 'es'
                            ? 'Este bloque define el estado actual del país y no debería variar entre tests, salvo que decidas actualizarlo.'
                            : 'This block defines the current country state and should remain stable across tests unless you intentionally update it.'}
                        </p>
                      </Card>

                      <Card className="space-y-3 border-indigo-500/30 bg-indigo-500/5">
                        <SectionTitle
                          title={lang === 'es' ? 'Escenario hipotético (a testear)' : 'Hypothetical scenario (to test)'}
                          subtitle={
                            lang === 'es'
                              ? 'Evento que querés simular sobre la base actual. Puede impactar país, empresa o ambos.'
                              : 'Event you want to simulate over baseline. It can affect country, company, or both.'
                          }
                        />
                        <div className="grid gap-3 md:grid-cols-[1fr_auto] md:items-end">
                          <div>
                            <label className="mb-1 block text-xs text-slate-400">{lang === 'es' ? 'Escenario hipotético' : 'Hypothetical scenario'}</label>
                            <Select value={selectedScenario?.id || ''} onChange={(e) => setSelectedScenarioId(e.target.value)}>
                              {scenarios.map((s) => (
                                <option key={s.id} value={s.id}>
                                  {localizeScenarioNameById(s.id, s.name)}
                                </option>
                              ))}
                            </Select>
                          </div>
                          <Button variant="outline" onClick={() => setTab('scenarios')}>
                            {lang === 'es' ? 'Editar escenarios' : 'Edit scenarios'}
                          </Button>
                        </div>
                        <div className="flex flex-wrap gap-3 text-sm">
                          <label className="inline-flex items-center gap-2">
                            <input type="checkbox" checked={hypoAffectsCountry} onChange={(e) => setHypoAffectsCountry(e.target.checked)} />
                            <span>{lang === 'es' ? 'Impacta contexto país' : 'Affects country context'}</span>
                          </label>
                          <label className="inline-flex items-center gap-2">
                            <input type="checkbox" checked={hypoAffectsCompany} onChange={(e) => setHypoAffectsCompany(e.target.checked)} />
                            <span>{lang === 'es' ? 'Impacta contexto empresa' : 'Affects company context'}</span>
                          </label>
                        </div>
                        <div className="flex flex-wrap gap-2">
                          <Button variant="outline" onClick={validateHypotheticalWithLLM} disabled={llmReviewScenarioLoading}>
                            {llmReviewScenarioLoading
                              ? (lang === 'es' ? 'Validando con LLM...' : 'Validating with LLM...')
                              : (lang === 'es' ? 'Actualizar con LLM' : 'Update with LLM')}
                          </Button>
                          <Button onClick={applyHypotheticalScenarioToSimulation}>
                            {lang === 'es' ? 'Aplicar a simulación' : 'Apply to simulation'}
                          </Button>
                        </div>
                        {selectedScenario ? (
                          <p className="text-xs text-slate-400">
                            {localizeScenarioDescriptionById(selectedScenario.id, selectedScenario.description)}
                          </p>
                        ) : null}
                      </Card>
                    </div>

                    <Card>
                      <div className="grid gap-2 md:grid-cols-3">
                        <div className="rounded-xl border border-border p-3">
                          <p className="text-xs text-slate-400">{lang === 'es' ? 'Base actual' : 'Current baseline'}</p>
                          <p className="mt-1 text-sm font-medium">{baselineContextTitle || '-'}</p>
                        </div>
                        <div className="rounded-xl border border-border p-3">
                          <p className="text-xs text-slate-400">{lang === 'es' ? 'Hipótesis activa' : 'Active hypothesis'}</p>
                          <p className="mt-1 text-sm font-medium">
                            {sim.scenario_id ? localizeScenarioNameById(sim.scenario_id, sim.scenario_name) : (lang === 'es' ? 'Sin aplicar' : 'Not applied')}
                          </p>
                        </div>
                        <div className="rounded-xl border border-border p-3">
                          <p className="text-xs text-slate-400">{lang === 'es' ? 'Alcance del impacto' : 'Impact scope'}</p>
                          <p className="mt-1 text-sm font-medium">
                            {hypoAffectsCountry && hypoAffectsCompany
                              ? (lang === 'es' ? 'País + Empresa' : 'Country + Company')
                              : hypoAffectsCountry
                                ? (lang === 'es' ? 'Sólo País' : 'Country only')
                                : hypoAffectsCompany
                                  ? (lang === 'es' ? 'Sólo Empresa' : 'Company only')
                                  : (lang === 'es' ? 'Sin impacto' : 'No impact')}
                          </p>
                        </div>
                      </div>
                    </Card>

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
                    </div>
                  </div>
                ) : null}

                {simStep === 3 ? (
                  <div className="space-y-4">
                    <StepIntro
                      title={lang === 'es' ? 'Objetivo del paso' : 'Step goal'}
                      description={
                        lang === 'es'
                          ? 'Configurar palancas de compañía que pueden amortiguar o amplificar el comportamiento de usuarios.'
                          : 'Configure company levers that can dampen or amplify user behavior.'
                      }
                    />
                  <div className="grid gap-4 lg:grid-cols-2">
                    <ContextEditor
                      lang={lang}
                      title={lang === 'es' ? 'Retención y Yield' : 'Retention & Yield'}
                      data={pickContext(sim.company_context, ['wallet_yield_current', 'wallet_yield_new', 'competitor_yield', 'cashback_percent', 'cashback_cap'])}
                      onChange={(k, v) => setSim((p) => ({ ...p, company_context: { ...p.company_context, [k]: v } }))}
                    />
                    <ContextEditor
                      lang={lang}
                      title={lang === 'es' ? 'Fricción, Soporte y Liquidez' : 'Friction, Support & Liquidity'}
                      data={pickContext(sim.company_context, ['onboarding_friction', 'KYC_friction', 'app_stability', 'transfer_limits', 'withdrawal_delay_risk', 'support_quality', 'trust_baseline'])}
                      onChange={(k, v) => setSim((p) => ({ ...p, company_context: { ...p.company_context, [k]: v } }))}
                    />
                    <div className="lg:col-span-2">
                      <ContextEditor
                        lang={lang}
                        title={lang === 'es' ? 'Estrategia de Crédito' : 'Credit Strategy'}
                        data={pickContext(sim.company_context, ['credit_offer_aggressiveness', 'loan_rate_level'])}
                        onChange={(k, v) => setSim((p) => ({ ...p, company_context: { ...p.company_context, [k]: v } }))}
                      />
                    </div>
                  </div>
                  </div>
                ) : null}

                {simStep === 4 ? (
                  <div className="space-y-4">
                    <StepIntro
                      title={lang === 'es' ? 'Objetivo del paso' : 'Step goal'}
                      description={
                        lang === 'es'
                          ? 'Definir qué segmentos de usuarios participan y con qué peso relativo.'
                          : 'Define which user segments participate and their relative weights.'
                      }
                    />
                    <div className="grid gap-4 lg:grid-cols-3">
                      {archetypes.map((a) => {
                        const isExcluded = !!excludedArchetypes[a.id]
                        return (
                        <Card key={a.id} className={`space-y-2 ${isExcluded ? 'opacity-70' : ''}`}>
                          <div className="flex items-center justify-between">
                            <h4 className="font-semibold">{a.name}</h4>
                            <div className="flex items-center gap-2">
                              {isExcluded ? (
                                <Badge className="border-red-500/30 bg-red-500/10 text-red-300">
                                  {lang === 'es' ? 'Fuera de simulación' : 'Excluded'}
                                </Badge>
                              ) : null}
                              <Badge>{a.balance_bucket}</Badge>
                            </div>
                          </div>
                          <p className="text-sm text-slate-500 dark:text-slate-400">{a.description}</p>
                          <div className="flex items-center justify-between gap-2">
                            <p className="text-xs text-slate-400">
                              {isExcluded
                                ? (lang === 'es' ? 'Este arquetipo no participa en la corrida.' : 'This archetype is not participating in the run.')
                                : (lang === 'es' ? 'Activo en simulación.' : 'Active in simulation.')}
                            </p>
                            <Button variant="outline" onClick={() => toggleArchetypeInSimulation(a.id)}>
                              {isExcluded
                                ? (lang === 'es' ? 'Incluir' : 'Include')
                                : (lang === 'es' ? 'Excluir' : 'Exclude')}
                            </Button>
                          </div>
                          <div className="flex flex-wrap gap-1">
                            <Badge className={levelBadgeClass(a.trust_level)}>
                              {lang === 'es' ? 'confianza' : 'trust'} {qualLabel(a.trust_level)}
                            </Badge>
                            <Badge className={levelBadgeClass(a.liquidity_preference)}>
                              {lang === 'es' ? 'liq' : 'liq'} {qualLabel(a.liquidity_preference)}
                            </Badge>
                            <Badge className={levelBadgeClass(a.crypto_affinity)}>
                              crypto {qualLabel(a.crypto_affinity)}
                            </Badge>
                            <Badge className={levelBadgeClass(a.rumor_sensitivity)}>
                              {lang === 'es' ? 'rumor' : 'rumor'} {qualLabel(a.rumor_sensitivity)}
                            </Badge>
                          </div>
                          <Input
                            type="number"
                            min={0}
                            max={100}
                            value={sim.archetype_mix[a.id] ?? 0}
                            disabled={isExcluded}
                            onChange={(e) =>
                              setSim((prev) => ({
                                ...prev,
                                archetype_mix: { ...prev.archetype_mix, [a.id]: Number(e.target.value || 0) },
                              }))
                            }
                          />
                        </Card>
                      )})}
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
                    <StepIntro
                      title={lang === 'es' ? 'Objetivo del paso' : 'Step goal'}
                      description={
                        lang === 'es'
                          ? 'Validar parámetros finales y lanzar la simulación con claridad de alcance.'
                          : 'Validate final parameters and run the simulation with clear scope.'
                      }
                    />
                    <SectionTitle title={lang === 'es' ? 'Revisión Previa al Run' : 'Pre-Run Review'} subtitle={lang === 'es' ? 'Validá el contexto antes de simular.' : 'Validate context before simulation.'} />
                    <Card className="border-primary/30 bg-primary/10">
                      <h4 className="text-sm font-semibold text-primary">
                        {lang === 'es' ? 'Cómo leer esta sección' : 'How to read this section'}
                      </h4>
                      <div className="mt-2 grid gap-2 text-xs text-slate-300 md:grid-cols-2">
                        <p>
                          <span className="font-semibold">{lang === 'es' ? 'Objetivo:' : 'Goal:'}</span>{' '}
                          {lang === 'es'
                            ? 'ejecutar una corrida consistente y comparable con el contexto elegido.'
                            : 'run a consistent and comparable simulation with selected context.'}
                        </p>
                        <p>
                          <span className="font-semibold">{lang === 'es' ? 'Pasos:' : 'Steps:'}</span>{' '}
                          {lang === 'es'
                            ? 'cada paso es un período de reacción (más pasos = efectos de segunda ronda y contagio).'
                            : 'each step is a reaction period (more steps = second-order and contagion effects).'}
                        </p>
                        <p>
                          <span className="font-semibold">{lang === 'es' ? 'Agentes:' : 'Agents:'}</span>{' '}
                          {lang === 'es'
                            ? 'más agentes mejora estabilidad estadística pero aumenta costo/tiempo.'
                            : 'more agents improve statistical stability but increase cost/time.'}
                        </p>
                        <p>
                          <span className="font-semibold">{lang === 'es' ? 'Semilla:' : 'Seed:'}</span>{' '}
                          {lang === 'es'
                            ? 'fija aleatoriedad para reproducir escenarios equivalentes.'
                            : 'fixes randomness to reproduce equivalent scenarios.'}
                        </p>
                        <p>
                          <span className="font-semibold">{lang === 'es' ? 'Monte Carlo:' : 'Monte Carlo:'}</span>{' '}
                          {lang === 'es'
                            ? 'repite la simulación N veces para obtener promedio y rango.'
                            : 'repeats simulation N times to get average and range.'}
                        </p>
                        <p>
                          <span className="font-semibold">{lang === 'es' ? 'Qué cambia si ajustás:' : 'If you adjust:'}</span>{' '}
                          {lang === 'es'
                            ? 'agentes/pasos modifican robustez y dinámica; seed/MC modifican reproducibilidad y dispersión.'
                            : 'agents/steps change robustness and dynamics; seed/MC change reproducibility and dispersion.'}
                        </p>
                      </div>
                    </Card>
                    <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
                      <Field
                        label={lang === 'es' ? 'Agentes' : 'Agents'}
                        hint={lang === 'es' ? 'Cantidad de usuarios sintéticos a simular.' : 'Number of synthetic users to simulate.'}
                        value={sim.num_agents}
                        onChange={(v) => setSim((p) => ({ ...p, num_agents: Number(v) }))}
                      />
                      <Field
                        label={lang === 'es' ? 'Pasos' : 'Steps'}
                        hint={lang === 'es' ? 'Horizonte temporal de la simulación.' : 'Simulation time horizon.'}
                        value={sim.num_steps}
                        onChange={(v) => setSim((p) => ({ ...p, num_steps: Number(v) }))}
                      />
                      <Field
                        label={lang === 'es' ? 'Semilla' : 'Seed'}
                        hint={lang === 'es' ? 'Controla reproducibilidad del escenario.' : 'Controls scenario reproducibility.'}
                        value={sim.seed}
                        onChange={(v) => setSim((p) => ({ ...p, seed: Number(v) }))}
                      />
                      <Field
                        label={lang === 'es' ? 'Monte Carlo' : 'Monte Carlo'}
                        hint={lang === 'es' ? 'Cantidad de corridas para estimar rangos.' : 'Number of runs to estimate ranges.'}
                        value={sim.monte_carlo_runs}
                        onChange={(v) => setSim((p) => ({ ...p, monte_carlo_runs: Number(v) }))}
                      />
                    </div>
                    <div className="flex items-center justify-between">
                      <div className="flex flex-wrap items-center gap-2">
                        <Badge>
                          {lang === 'es' ? 'Base actual' : 'Current baseline'}: {baselineContextTitle || '-'}
                        </Badge>
                        <Badge>
                          {lang === 'es' ? 'Hipótesis aplicada' : 'Applied hypothesis'}:{' '}
                          {sim.scenario_id
                            ? localizeScenarioNameById(sim.scenario_id, sim.scenario_name)
                            : (lang === 'es' ? 'Ninguna' : 'None')}
                        </Badge>
                      </div>
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
                        <StepIntro
                          title={lang === 'es' ? 'Objetivo del paso' : 'Step goal'}
                          description={
                            lang === 'es'
                              ? 'Interpretar el riesgo total del sistema: fondos base, porción migrada y drivers conductuales.'
                              : 'Interpret total system risk: baseline funds, migrated share, and behavioral drivers.'
                          }
                        />
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <SectionTitle title={t.simulationResults} subtitle={`${lang === 'es' ? 'ID corrida' : 'Run ID'}: ${latestRun.id}`} />
                          <Button variant="outline" onClick={() => downloadReportPdf(latestRun.id)} disabled={downloadingPdf}>
                            {downloadingPdf
                              ? (lang === 'es' ? 'Generando PDF...' : 'Generating PDF...')
                              : (lang === 'es' ? 'Descargar Informe PDF' : 'Download PDF Report')}
                          </Button>
                        </div>
                        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-6">
                          <PanicMetricCard
                            lang={lang}
                            score={panicScore}
                            label={panicLabel}
                            mainDriver={panicMainDriver}
                            onOpen={() => setPanicOpen(true)}
                          />
                          <MetricCard
                            icon={Landmark}
                            label={lang === 'es' ? 'Fondos Totales (estimados)' : 'Total Funds (estimated)'}
                            value={num(currentMetrics?.estimated_total_system_funds)}
                            subtitle={
                              lang === 'es'
                                ? 'Base simulada al inicio (suma de balances de agentes)'
                                : 'Simulated baseline at start (sum of agent balances)'
                            }
                          />
                          <MetricCard icon={Landmark} label={lang === 'es' ? 'Migración de Fondos' : 'Migration Funds'} value={num(currentMetrics?.estimated_migration_of_funds)} />
                          <MetricCard
                            icon={BarChart3}
                            label={lang === 'es' ? '% Migrado sobre total' : '% Migrated vs total'}
                            value={pct(currentMetrics?.migration_vs_total_pct)}
                            subtitle={
                              lang === 'es'
                                ? 'Qué proporción del sistema terminó moviéndose'
                                : 'Share of the system that ended up moving'
                            }
                          />
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
                        <Card>
                          <SectionTitle
                            title={lang === 'es' ? 'Migración de Fondos (Sankey)' : 'Fund Migration (Sankey)'}
                            subtitle={
                              lang === 'es'
                                ? 'Arquetipos → acciones → destino de fondos. El grosor representa volumen migrado.'
                                : 'Archetypes → actions → fund destinations. Thickness represents migrated volume.'
                            }
                          />
                          <div className="h-[320px] w-full sm:h-[400px] lg:h-[440px]">
                            <ResponsiveContainer>
                              <Sankey
                                data={sankeyData}
                                nodePadding={20}
                                margin={{ left: 20, right: 70, top: 20, bottom: 20 }}
                                node={{ stroke: '#0ea5e9', strokeWidth: 1, fill: '#38bdf8' }}
                                link={{ stroke: 'rgba(56,189,248,0.6)' }}
                              >
                                <Tooltip />
                              </Sankey>
                            </ResponsiveContainer>
                          </div>
                        </Card>
                      </>
                    ) : null}

                    {simStep === 7 ? <BehaviorContagionMap archetypes={archetypes} run={latestRun} payload={sim} lang={lang} /> : null}

                    {simStep === 8 ? (
                      <div className="grid gap-4 lg:grid-cols-2">
                        <Card>
                          <SectionTitle
                            title={lang === 'es' ? 'Acciones Tácticas' : 'Tactical Actions'}
                            subtitle={lang === 'es' ? 'Mitigación de riesgo, retención y liquidez.' : 'Risk mitigation, retention and liquidity actions.'}
                          />
                          <p className="mb-2 text-xs text-slate-400">
                            {lang === 'es' ? 'Origen' : 'Source'}: {latestRun.tactical_recommendations?.source || 'n/a'}
                          </p>
                          <div className="space-y-2">
                            {(latestRun.tactical_recommendations?.tactical_actions || []).map((x, i) => (
                              <motion.div key={i} whileHover={{ y: -2 }} className="group rounded-xl border border-border p-3">
                                <div className="mb-2 flex items-center justify-between">
                                  <h4 className="font-medium">{x.title}</h4>
                                  <Badge>{x.category || (lang === 'es' ? 'Táctico' : 'Tactical')}</Badge>
                                </div>
                                <p className="text-sm text-slate-500 dark:text-slate-400">{x.why}</p>
                                {(() => {
                                  const ctx = tacticalRecommendationContext(
                                    x as { title: string; why?: string; category?: string },
                                    latestRun,
                                    lang
                                  )
                                  return (
                                    <div className="mt-2 overflow-hidden rounded-lg border border-blue-500/20 bg-blue-500/5 p-2 text-xs opacity-0 transition-all duration-200 group-hover:opacity-100">
                                      <p className="font-medium text-blue-700 dark:text-blue-300">
                                        {lang === 'es' ? 'Racional' : 'Rationale'}
                                      </p>
                                      <p className="mt-1 text-slate-600 dark:text-slate-300">{ctx.rationale}</p>
                                      <p className="mt-1 text-slate-500 dark:text-slate-400">
                                        {lang === 'es' ? 'Drivers' : 'Drivers'}: {ctx.drivers.join(' • ')}
                                      </p>
                                      <p className="mt-1 text-slate-500 dark:text-slate-400">
                                        {lang === 'es' ? 'Motivo' : 'Why now'}: {ctx.whyNow}
                                      </p>
                                    </div>
                                  )
                                })()}
                              </motion.div>
                            ))}
                            {(latestRun.tactical_recommendations?.tactical_actions || []).length === 0 ? (
                              <p className="text-sm text-slate-400">
                                {lang === 'es' ? 'Sin datos de recomendaciones tácticas.' : 'No tactical recommendation data.'}
                              </p>
                            ) : null}
                          </div>
                        </Card>
                        <Card>
                          <SectionTitle title={lang === 'es' ? 'Laboratorio de Innovación' : 'Innovation Lab'} subtitle={lang === 'es' ? 'Ideas disruptivas para nuevos productos.' : 'Disruptive ideas for new products.'} />
                          <p className="mb-2 text-xs text-slate-400">
                            {lang === 'es' ? 'Origen' : 'Source'}: {latestRun.disruptive_recommendations?.source || 'n/a'}
                          </p>
                          <div className="space-y-2">
                            {(latestRun.disruptive_recommendations?.innovation_lab || []).map((x, i) => (
                              <motion.div key={i} whileHover={{ scale: 1.01 }} className="group rounded-xl border border-border p-3">
                                <div className="mb-1 flex items-center justify-between gap-2">
                                  <h4 className="font-medium">{x.idea}</h4>
                                  <Lightbulb className="h-4 w-4 text-amber-500" />
                                </div>
                                <p className="text-sm text-slate-500 dark:text-slate-400">{x.fit}</p>
                                <p className="mt-2 text-xs">{lang === 'es' ? 'Inspiración' : 'Inspiration'}: {x.inspiration}</p>
                                {x.disruptiveness ? <p className="mt-1 text-xs">{lang === 'es' ? 'Nivel' : 'Level'}: {x.disruptiveness}</p> : null}
                                {(() => {
                                  const ctx = innovationRecommendationContext(
                                    x as { idea: string; fit?: string; inspiration?: string; disruptiveness?: string },
                                    latestRun,
                                    lang
                                  )
                                  return (
                                    <div className="mt-2 overflow-hidden rounded-lg border border-purple-500/20 bg-purple-500/5 p-2 text-xs opacity-0 transition-all duration-200 group-hover:opacity-100">
                                      <p className="font-medium text-purple-700 dark:text-purple-300">
                                        {lang === 'es' ? 'Contexto de propuesta' : 'Proposal context'}
                                      </p>
                                      <p className="mt-1 text-slate-600 dark:text-slate-300">{ctx.rationale}</p>
                                      <p className="mt-1 text-slate-500 dark:text-slate-400">
                                        {lang === 'es' ? 'Se apoya en' : 'Built on'}: {ctx.drivers.join(' • ')}
                                      </p>
                                      <p className="mt-1 text-slate-500 dark:text-slate-400">
                                        {lang === 'es' ? 'Objetivo de impacto' : 'Impact goal'}: {ctx.impactGoal}
                                      </p>
                                    </div>
                                  )
                                })()}
                              </motion.div>
                            ))}
                            {(latestRun.disruptive_recommendations?.innovation_lab || []).length === 0 ? (
                              <p className="text-sm text-slate-400">
                                {lang === 'es' ? 'Sin datos de laboratorio de innovación.' : 'No innovation lab data.'}
                              </p>
                            ) : null}
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
                    subtitle={
                      lang === 'es'
                        ? 'Vista enfocada: 1 perfil principal con detalle + lista lateral de segmentos.'
                        : 'Focused view: 1 primary profile with detail + side list of segments.'
                    }
                  />
                  <div className="flex gap-2">
                    <Button
                      onClick={() => {
                        if (!archetypes[0]) return
                        const base = copy(archetypes[0])
                        base.id = `${base.id}_copy_${Math.floor(Math.random() * 9999)}`
                        base.name = lang === 'es' ? `${base.name} copia` : `${base.name} copy`
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

                <div className="grid gap-4 xl:grid-cols-[1.1fr_0.9fr]">
                  <Card className="space-y-4">
                    {!selectedArchetype ? (
                      <p className="text-sm text-slate-400">{lang === 'es' ? 'No hay arquetipos cargados.' : 'No archetypes loaded.'}</p>
                    ) : (
                      <>
                        <div className="flex flex-wrap items-start justify-between gap-3">
                          <div className="flex items-center gap-3">
                            <div className="relative h-20 w-20">
                              <div className="absolute inset-0 rounded-full bg-gradient-to-br from-amber-100 to-amber-300 shadow-[0_0_40px_rgba(250,204,21,0.35)]" />
                              <div className="absolute inset-3 rounded-full bg-slate-950/10" />
                              <div className="absolute -bottom-2 left-1/2 h-10 w-14 -translate-x-1/2 rounded-[999px] bg-gradient-to-b from-emerald-200 to-emerald-500 shadow-[0_10px_26px_rgba(16,185,129,0.35)]" />
                              <Users className="absolute left-1/2 top-1/2 h-7 w-7 -translate-x-1/2 -translate-y-1/2 text-slate-700" />
                            </div>
                            <div>
                              <h3 className="text-2xl font-semibold">{selectedArchetype.name}</h3>
                              <p className="max-w-2xl text-sm text-slate-400">{selectedArchetype.description}</p>
                            </div>
                          </div>
                          <div className="flex flex-wrap gap-2">
                            <Badge>{selectedArchetype.balance_bucket}</Badge>
                            <Badge>
                              {(() => {
                                const origin = getArchetypeOrigin(selectedArchetype)
                                if (origin === 'default') return lang === 'es' ? 'Base' : 'Default'
                                if (origin === 'x') return lang === 'es' ? 'Generado por X' : 'Generated from X'
                                return lang === 'es' ? 'Personalizado' : 'Custom'
                              })()}
                            </Badge>
                          </div>
                        </div>

                        <div className="grid gap-2 md:grid-cols-2">
                          {(
                            [
                              ['trust_level', selectedArchetype.trust_level],
                              ['liquidity_preference', selectedArchetype.liquidity_preference],
                              ['crypto_affinity', selectedArchetype.crypto_affinity],
                              ['rumor_sensitivity', selectedArchetype.rumor_sensitivity],
                              ['macro_anxiety', selectedArchetype.macro_anxiety],
                              ['risk_aversion', selectedArchetype.risk_aversion],
                            ] as Array<[string, QualLevel]>
                          ).map(([key, value]) => {
                            const detail = lang === 'es' ? ARCHETYPE_PROP_META_ES[key] : ARCHETYPE_PROP_META_EN[key]
                            const label = key.replaceAll('_', ' ')
                            return (
                              <div key={key} className="group relative rounded-xl border border-border p-3">
                                <div className="flex items-center justify-between gap-2">
                                  <span className="text-xs uppercase tracking-wide text-slate-400">{label}</span>
                                  <Badge>{value}</Badge>
                                </div>
                                <div className="pointer-events-none absolute left-2 right-2 top-full z-20 mt-1 rounded-lg border border-border bg-card p-2 text-xs text-slate-300 opacity-0 shadow-xl transition group-hover:opacity-100">
                                  {detail}
                                </div>
                              </div>
                            )
                          })}
                        </div>

                        <div className="flex gap-2">
                          <Button variant="outline" onClick={() => setEditingArchetype(copy(selectedArchetype))}>
                            {lang === 'es' ? 'Editar arquetipo' : 'Edit archetype'}
                          </Button>
                          <Button variant="danger" onClick={() => removeArchetype(selectedArchetype.id)}>
                            {lang === 'es' ? 'Eliminar arquetipo' : 'Delete archetype'}
                          </Button>
                        </div>
                      </>
                    )}
                  </Card>

                  <Card className="space-y-3">
                    <SectionTitle
                      title={lang === 'es' ? 'Resto de Arquetipos' : 'Other Archetypes'}
                      subtitle={
                        lang === 'es'
                          ? 'Incluye segmentos base y detectados desde señales de X.'
                          : 'Includes base segments and those detected from X signals.'
                      }
                    />
                    <div className="max-h-[420px] space-y-2 overflow-auto pr-1">
                      {otherArchetypes.map((a) => {
                        const origin = getArchetypeOrigin(a)
                        return (
                          <button
                            key={a.id}
                            onClick={() => setSelectedArchetypeId(a.id)}
                            className="w-full rounded-xl border border-border bg-background/40 p-3 text-left transition hover:border-primary/60 hover:bg-primary/10"
                          >
                            <div className="mb-1 flex items-center justify-between gap-2">
                              <p className="font-medium">{a.name}</p>
                              <Badge>
                                {origin === 'default'
                                  ? lang === 'es'
                                    ? 'Base'
                                    : 'Default'
                                  : origin === 'x'
                                    ? lang === 'es'
                                      ? 'X detectado'
                                      : 'X detected'
                                    : lang === 'es'
                                      ? 'Personalizado'
                                      : 'Custom'}
                              </Badge>
                            </div>
                            <p className="line-clamp-2 text-xs text-slate-400">{a.description}</p>
                          </button>
                        )
                      })}
                    </div>
                  </Card>
                </div>

                <Card>
                  <SectionTitle
                    title={lang === 'es' ? 'Mapa de Arquetipos' : 'Archetype Map'}
                    subtitle={
                      lang === 'es'
                        ? 'X confianza, Y aversión al riesgo, tamaño por mix poblacional.'
                        : 'X trust, Y risk aversion, size by population mix.'
                    }
                  />
                  <div className="h-72">
                    <ResponsiveContainer>
                      <ScatterChart>
                        <XAxis
                          type="number"
                          dataKey="x"
                          domain={[1, 5]}
                          name={lang === 'es' ? 'Confianza' : 'Trust'}
                          ticks={[1, 2, 3, 4, 5]}
                        />
                        <YAxis
                          type="number"
                          dataKey="y"
                          domain={[1, 5]}
                          name={lang === 'es' ? 'Aversión al Riesgo' : 'Risk Aversion'}
                          ticks={[1, 2, 3, 4, 5]}
                        />
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
              </section>
            ) : null}

            {tab === 'scenarios' ? (
              <section className="space-y-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <SectionTitle
                    title={lang === 'es' ? 'Gestor de Escenarios' : 'Scenario Manager'}
                    subtitle={
                      lang === 'es'
                        ? 'Vista enfocada: un escenario principal editable + listado lateral.'
                        : 'Focused view: one editable primary scenario + side list.'
                    }
                  />
                  <Button
                    onClick={() => {
                      const id = `scenario_${Math.floor(Math.random() * 9999)}`
                      const newScenario = {
                        id,
                        name: lang === 'es' ? `Nuevo escenario ${id}` : `New Scenario ${id}`,
                        description: lang === 'es' ? 'Escenario editable.' : 'Editable scenario.',
                        default_country_context: copy(DEFAULT_COUNTRY_CONTEXT),
                        default_company_context: copy(DEFAULT_COMPANY_CONTEXT),
                        notes: '',
                        event_timeline: [],
                      }
                      setSelectedScenarioId(id)
                      saveScenario(newScenario)
                    }}
                  >
                    {lang === 'es' ? 'Nuevo Escenario' : 'New Scenario'}
                  </Button>
                </div>

                <Card className="space-y-3 border-primary/30 bg-primary/10">
                  <SectionTitle
                    title={lang === 'es' ? 'Generador de Escenario Hipotético con LLM' : 'LLM Hypothetical Scenario Generator'}
                    subtitle={
                      lang === 'es'
                        ? 'Escribí una hipótesis de negocio o macro y el LLM crea nombre, descripción y contexto país/empresa.'
                        : 'Write a business or macro hypothesis and the LLM creates name, description, and country/company context.'
                    }
                  />
                  <TextArea
                    rows={3}
                    value={llmScenarioPrompt}
                    onChange={(e) => setLlmScenarioPrompt(e.target.value)}
                    placeholder={
                      lang === 'es'
                        ? 'Ej: Lanzar producto de ahorro en USD sintético con retiro inmediato'
                        : 'E.g. Launch instant-withdraw synthetic USD savings product'
                    }
                  />
                  <div className="flex flex-wrap gap-2">
                    <Button variant="outline" onClick={generateScenarioFromLLM} disabled={llmScenarioLoading}>
                      {llmScenarioLoading
                        ? (lang === 'es' ? 'Generando escenario...' : 'Generating scenario...')
                        : (lang === 'es' ? 'Generar escenario con LLM' : 'Generate scenario with LLM')}
                    </Button>
                    <Button variant="outline" onClick={() => setLlmScenarioPrompt('')}>
                      {lang === 'es' ? 'Limpiar' : 'Clear'}
                    </Button>
                  </div>
                </Card>

                <div className="grid gap-4 xl:grid-cols-[1.1fr_0.9fr]">
                  <Card className="space-y-3">
                    {!selectedScenario ? (
                      <p className="text-sm text-slate-400">{lang === 'es' ? 'No hay escenarios cargados.' : 'No scenarios loaded.'}</p>
                    ) : (
                      <>
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <Badge>
                            {getScenarioOrigin(selectedScenario) === 'default'
                              ? lang === 'es'
                                ? 'Escenario base'
                                : 'Default scenario'
                              : lang === 'es'
                                ? 'Escenario personalizado'
                                : 'Custom scenario'}
                          </Badge>
                          <Badge>{selectedScenario.id}</Badge>
                        </div>
                        <Input
                          value={localizeScenarioNameById(selectedScenario.id, selectedScenario.name)}
                          onChange={(e) =>
                            setScenarios((prev) =>
                              prev.map((x) => (x.id === selectedScenario.id ? { ...x, name: e.target.value } : x))
                            )
                          }
                        />
                        <TextArea
                          rows={5}
                          value={localizeScenarioDescriptionById(selectedScenario.id, selectedScenario.description)}
                          onChange={(e) =>
                            setScenarios((prev) =>
                              prev.map((x) => (x.id === selectedScenario.id ? { ...x, description: e.target.value } : x))
                            )
                          }
                        />
                        <div className="grid gap-3 md:grid-cols-2">
                          <ContextEditor
                            lang={lang}
                            title={lang === 'es' ? 'Contexto País (resumen)' : 'Country Context (summary)'}
                            data={pickContext(selectedScenario.default_country_context, [
                              'inflation_expectation',
                              'usd_volatility',
                              'country_risk_pressure',
                              'bank_trust_index',
                              'social_panic_level',
                            ])}
                            onChange={(k, v) =>
                              setScenarios((prev) =>
                                prev.map((x) =>
                                  x.id === selectedScenario.id
                                    ? {
                                        ...x,
                                        default_country_context: { ...x.default_country_context, [k]: v },
                                      }
                                    : x
                                )
                              )
                            }
                          />
                          <ContextEditor
                            lang={lang}
                            title={lang === 'es' ? 'Contexto Compañía (resumen)' : 'Company Context (summary)'}
                            data={pickContext(selectedScenario.default_company_context, [
                              'wallet_yield_current',
                              'wallet_yield_new',
                              'competitor_yield',
                              'cashback_percent',
                              'app_stability',
                              'trust_baseline',
                            ])}
                            onChange={(k, v) =>
                              setScenarios((prev) =>
                                prev.map((x) =>
                                  x.id === selectedScenario.id
                                    ? {
                                        ...x,
                                        default_company_context: { ...x.default_company_context, [k]: v },
                                      }
                                    : x
                                )
                              )
                            }
                          />
                        </div>
                        <div className="flex flex-wrap gap-2">
                          <Button variant="outline" onClick={updateSelectedScenarioWithLLM} disabled={llmReviewScenarioLoading}>
                            {llmReviewScenarioLoading
                              ? (lang === 'es' ? 'Actualizando con LLM...' : 'Updating with LLM...')
                              : (lang === 'es' ? 'Actualizar con LLM' : 'Update with LLM')}
                          </Button>
                          <Button variant="outline" onClick={() => saveScenario(selectedScenario)}>
                            {lang === 'es' ? 'Guardar' : 'Save'}
                          </Button>
                          <Button
                            variant="outline"
                            onClick={() => {
                              const dupe = copy(selectedScenario)
                              dupe.id = `${selectedScenario.id}_copy_${Math.floor(Math.random() * 9999)}`
                              dupe.name = lang === 'es' ? `${selectedScenario.name} copia` : `${selectedScenario.name} copy`
                              setSelectedScenarioId(dupe.id)
                              saveScenario(dupe)
                            }}
                          >
                            {lang === 'es' ? 'Duplicar' : 'Duplicate'}
                          </Button>
                          <Button
                            variant="danger"
                            onClick={async () => {
                              const currentId = selectedScenario.id
                              const fallback = scenarios.find((x) => x.id !== currentId)?.id || null
                              setSelectedScenarioId(fallback)
                              await removeScenario(currentId)
                            }}
                          >
                            {lang === 'es' ? 'Eliminar' : 'Delete'}
                          </Button>
                        </div>
                      </>
                    )}
                  </Card>

                  <Card className="space-y-3">
                    <SectionTitle
                      title={lang === 'es' ? 'Listado de Escenarios' : 'Scenario List'}
                      subtitle={
                        lang === 'es'
                          ? 'Seleccioná uno para verlo y editarlo en detalle.'
                          : 'Select one to view and edit in detail.'
                      }
                    />
                    <div className="max-h-[620px] space-y-2 overflow-auto pr-1">
                      {(selectedScenario ? [selectedScenario, ...otherScenarios] : scenarios).map((s) => {
                        const active = s.id === selectedScenario?.id
                        return (
                          <button
                            key={s.id}
                            onClick={() => setSelectedScenarioId(s.id)}
                            className={`w-full rounded-xl border p-3 text-left transition ${
                              active
                                ? 'border-primary bg-primary/15'
                                : 'border-border bg-background/40 hover:border-primary/60 hover:bg-primary/10'
                            }`}
                          >
                            <div className="mb-1 flex items-center justify-between gap-2">
                              <p className="font-medium">{localizeScenarioNameById(s.id, s.name)}</p>
                              <Badge>
                                {getScenarioOrigin(s) === 'default'
                                  ? lang === 'es'
                                    ? 'Base'
                                    : 'Default'
                                  : lang === 'es'
                                    ? 'Custom'
                                    : 'Custom'}
                              </Badge>
                            </div>
                            <p className="line-clamp-2 text-xs text-slate-400">{localizeScenarioDescriptionById(s.id, s.description)}</p>
                            <div className="mt-2 flex flex-wrap gap-1">
                              <Badge className={levelBadgeClass(s.default_country_context.social_panic_level)}>
                                {lang === 'es' ? 'pánico' : 'panic'} {qualLabel(s.default_country_context.social_panic_level)}
                              </Badge>
                              <Badge className={levelBadgeClass(s.default_company_context.withdrawal_delay_risk)}>
                                {lang === 'es' ? 'retiro' : 'withdraw'} {qualLabel(s.default_company_context.withdrawal_delay_risk)}
                              </Badge>
                            </div>
                          </button>
                        )
                      })}
                    </div>
                  </Card>
                </div>
              </section>
            ) : null}

            {tab === 'contexts' ? (
              <section className="space-y-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <SectionTitle
                    title={lang === 'es' ? 'Gestor de Contextos' : 'Context Manager'}
                    subtitle={
                      lang === 'es'
                        ? 'Creá y editá perfiles de contexto país para reutilizar en simulaciones.'
                        : 'Create and edit reusable country context profiles.'
                    }
                  />
                  <Button
                    onClick={() => {
                      const id = `ctx_${Math.floor(Math.random() * 9999)}`
                      const next: ContextProfile = {
                        id,
                        title: lang === 'es' ? `Nuevo contexto ${id}` : `New context ${id}`,
                        description: lang === 'es' ? 'Contexto editable.' : 'Editable context.',
                        country_context: copy(DEFAULT_COUNTRY_CONTEXT),
                      }
                      const updated = [next, ...contextProfiles]
                      setSelectedContextId(id)
                      saveContextProfiles(updated)
                    }}
                  >
                    {lang === 'es' ? 'Nuevo Contexto' : 'New Context'}
                  </Button>
                </div>

                <Card className="space-y-3 border-primary/30 bg-primary/10">
                  <SectionTitle
                    title={lang === 'es' ? 'Generador de Contexto con LLM' : 'LLM Context Generator'}
                    subtitle={
                      lang === 'es'
                        ? 'Escribí un evento global/futuro y generá un nuevo contexto con nombre, descripción y variables precompletadas.'
                        : 'Describe a global/future event and generate a new context with prefilled title, description and variables.'
                    }
                  />
                  <TextArea
                    rows={3}
                    value={llmContextPrompt}
                    onChange={(e) => setLlmContextPrompt(e.target.value)}
                    placeholder={
                      lang === 'es'
                        ? 'Ej: Tercera guerra mundial con shock energético y aversión global al riesgo'
                        : 'E.g. Global war with energy shock and risk-off sentiment'
                    }
                  />
                  <div className="grid gap-2 md:grid-cols-2">
                    <Input
                      value={llmContextTitle}
                      onChange={(e) => setLlmContextTitle(e.target.value)}
                      placeholder={lang === 'es' ? 'Nombre del contexto' : 'Context title'}
                    />
                    <Input
                      value={llmContextDescription}
                      onChange={(e) => setLlmContextDescription(e.target.value)}
                      placeholder={lang === 'es' ? 'Descripción corta' : 'Short description'}
                    />
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <Button variant="outline" onClick={generateContextFromLLM} disabled={llmContextLoading}>
                      {llmContextLoading ? (lang === 'es' ? 'Generando...' : 'Generating...') : (lang === 'es' ? 'Generar con LLM' : 'Generate with LLM')}
                    </Button>
                    <Button onClick={saveGeneratedContextAsNew} disabled={!llmGeneratedCountryContext}>
                      {lang === 'es' ? 'Crear contexto nuevo' : 'Create new context'}
                    </Button>
                  </div>
                  {llmGeneratedCountryContext ? (
                    <div className="grid gap-2 sm:grid-cols-3">
                      {Object.entries(llmGeneratedCountryContext).slice(0, 9).map(([k, v]) => (
                        <div key={k} className="rounded-lg border border-border bg-background/40 px-3 py-2 text-xs">
                          <div className="text-slate-400">{k}</div>
                          <div className="mt-1 font-medium">{v}</div>
                        </div>
                      ))}
                    </div>
                  ) : null}
                </Card>

                <div className="grid gap-4 xl:grid-cols-[1.1fr_0.9fr]">
                  <Card className="space-y-3">
                    {!selectedContext ? (
                      <p className="text-sm text-slate-400">{lang === 'es' ? 'No hay contextos cargados.' : 'No contexts loaded.'}</p>
                    ) : (
                      <>
                        <Input
                          value={selectedContext.title}
                          onChange={(e) =>
                            setContextProfiles((prev) =>
                              prev.map((x) => (x.id === selectedContext.id ? { ...x, title: e.target.value } : x))
                            )
                          }
                        />
                        <TextArea
                          rows={3}
                          value={selectedContext.description}
                          onChange={(e) =>
                            setContextProfiles((prev) =>
                              prev.map((x) => (x.id === selectedContext.id ? { ...x, description: e.target.value } : x))
                            )
                          }
                        />
                        <ContextEditor
                          lang={lang}
                          title={lang === 'es' ? 'Editar Contexto Argentina (Avanzado)' : 'Edit Argentina Context (Advanced)'}
                          data={selectedContext.country_context}
                          onChange={(k, v) =>
                            setContextProfiles((prev) =>
                              prev.map((x) =>
                                x.id === selectedContext.id
                                  ? { ...x, country_context: { ...x.country_context, [k]: v } }
                                  : x
                              )
                            )
                          }
                        />
                        <div className="flex flex-wrap gap-2">
                          <Button variant="outline" onClick={updateSelectedContextWithLLM} disabled={llmReviewContextLoading}>
                            {llmReviewContextLoading
                              ? (lang === 'es' ? 'Actualizando con LLM...' : 'Updating with LLM...')
                              : (lang === 'es' ? 'Actualizar con LLM' : 'Update with LLM')}
                          </Button>
                          <Button variant="outline" onClick={() => saveContextProfiles(contextProfiles)}>
                            {lang === 'es' ? 'Guardar Contextos' : 'Save Contexts'}
                          </Button>
                          <Button
                            variant="outline"
                            onClick={() => {
                              if (!selectedContext) return
                              const dupe = copy(selectedContext)
                              dupe.id = `${selectedContext.id}_copy_${Math.floor(Math.random() * 9999)}`
                              dupe.title = lang === 'es' ? `${selectedContext.title} copia` : `${selectedContext.title} copy`
                              const updated = [dupe, ...contextProfiles]
                              setSelectedContextId(dupe.id)
                              saveContextProfiles(updated)
                            }}
                          >
                            {lang === 'es' ? 'Duplicar' : 'Duplicate'}
                          </Button>
                          <Button
                            variant="danger"
                            onClick={() => {
                              if (!selectedContext) return
                              const updated = contextProfiles.filter((x) => x.id !== selectedContext.id)
                              saveContextProfiles(updated)
                            }}
                          >
                            {lang === 'es' ? 'Eliminar' : 'Delete'}
                          </Button>
                        </div>
                      </>
                    )}
                  </Card>

                  <Card className="space-y-3">
                    <SectionTitle
                      title={lang === 'es' ? 'Listado de Contextos' : 'Context List'}
                      subtitle={
                        lang === 'es'
                          ? 'Seleccioná un perfil para editarlo o aplicarlo en Nueva Simulación.'
                          : 'Select a profile to edit or apply in New Simulation.'
                      }
                    />
                    <div className="max-h-[700px] space-y-2 overflow-auto pr-1">
                      {(selectedContext ? [selectedContext, ...otherContexts] : contextProfiles).map((c) => (
                        <button
                          key={c.id}
                          onClick={() => setSelectedContextId(c.id)}
                          className={`w-full rounded-xl border p-3 text-left transition ${
                            c.id === selectedContext?.id
                              ? 'border-primary bg-primary/15'
                              : 'border-border bg-background/40 hover:border-primary/60 hover:bg-primary/10'
                          }`}
                        >
                          <p className="font-medium">{c.title}</p>
                          <p className="line-clamp-2 text-xs text-slate-400">{c.description}</p>
                          <div className="mt-2 flex flex-wrap gap-1">
                            <Badge className={levelBadgeClass(c.country_context.social_panic_level)}>
                              {lang === 'es' ? 'pánico' : 'panic'} {qualLabel(c.country_context.social_panic_level)}
                            </Badge>
                            <Badge className={levelBadgeClass(c.country_context.inflation_expectation)}>
                              {lang === 'es' ? 'inflación' : 'inflation'} {qualLabel(c.country_context.inflation_expectation)}
                            </Badge>
                          </div>
                        </button>
                      ))}
                    </div>
                  </Card>
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
                          {new Date(r.created_at).toLocaleString()} • {localizeScenarioNameLoose(r.config.scenario_name)}
                        </p>
                        <p className="mt-1 text-xs text-slate-400">
                          Panic Index: {Number(r.outputs?.single_run?.panic_index_score || 0).toFixed(1)} ({r.outputs?.single_run?.panic_index_label || 'Normal'})
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
        {panicOpen && currentMetrics ? (
          <motion.aside
            className="fixed inset-0 z-50 bg-black/45"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setPanicOpen(false)}
          >
            <motion.div
              className="absolute right-0 top-0 h-full w-full max-w-2xl overflow-auto border-l border-border bg-background p-5"
              initial={{ x: 340 }}
              animate={{ x: 0 }}
              exit={{ x: 340 }}
              onClick={(e) => e.stopPropagation()}
            >
              <SectionTitle
                title={lang === 'es' ? 'Panic Index - Explicabilidad' : 'Panic Index - Explainability'}
                subtitle={`${panicScore.toFixed(1)} / 100 • ${panicLabel}`}
              />
              <Card className="mb-4">
                <p className="text-sm text-slate-300">
                  {lang === 'es'
                    ? `El Panic Index está impulsado principalmente por ${panicDriverLabel(panicMainDriver, 'es')}.`
                    : `Panic Index is mainly driven by ${panicDriverLabel(panicMainDriver, 'en')}.`}
                </p>
              </Card>

              <div className="grid gap-4 md:grid-cols-2">
                <Card>
                  <SectionTitle title={lang === 'es' ? 'Componentes' : 'Components'} />
                  <div className="space-y-2 text-sm">
                    {Object.entries((currentMetrics.panic_index_components as Record<string, unknown>) || {})
                      .filter(([k]) => k !== 'weighted_contribution')
                      .map(([k, v]) => (
                        <div key={k} className="flex items-center justify-between rounded-lg border border-border px-3 py-2">
                          <span className="text-slate-400">{k}</span>
                          <span className="font-medium">{typeof v === 'number' ? v.toFixed(4) : String(v)}</span>
                        </div>
                      ))}
                  </div>
                </Card>
                <Card>
                  <SectionTitle title={lang === 'es' ? 'Aportes ponderados' : 'Weighted contributions'} />
                  <div className="space-y-2 text-sm">
                    {Object.entries(
                      ((currentMetrics.panic_index_components as Record<string, unknown>)?.weighted_contribution as
                        | Record<string, number>
                        | undefined) || {}
                    ).map(([k, v]) => (
                      <div key={k} className="rounded-lg border border-border px-3 py-2">
                        <div className="mb-1 flex items-center justify-between">
                          <span className="text-slate-400">{k}</span>
                          <span className="font-medium">{v.toFixed(4)}</span>
                        </div>
                        <div className="h-2 rounded-full bg-muted">
                          <div className="h-2 rounded-full bg-primary" style={{ width: `${Math.min(100, v * 400)}%` }} />
                        </div>
                      </div>
                    ))}
                  </div>
                </Card>
                <Card>
                  <SectionTitle title={lang === 'es' ? 'Acciones dominantes' : 'Dominant actions'} />
                  <div className="space-y-2 text-sm">
                    {Object.entries(currentMetrics.final_action_distribution || {})
                      .sort((a, b) => b[1] - a[1])
                      .slice(0, 6)
                      .map(([k, v]) => (
                        <div key={k} className="flex items-center justify-between rounded-lg border border-border px-3 py-2">
                          <span>{k}</span>
                          <span className="font-medium">{v}</span>
                        </div>
                      ))}
                  </div>
                </Card>
                <Card>
                  <SectionTitle title={lang === 'es' ? 'Arquetipos más activos' : 'Top active archetypes'} />
                  <div className="space-y-2 text-sm">
                    {Object.entries(currentMetrics.archetype_level_breakdown || {})
                      .map(([k, actions]) => [k, Object.values(actions).reduce((a, b) => a + Number(b || 0), 0)] as const)
                      .sort((a, b) => b[1] - a[1])
                      .slice(0, 6)
                      .map(([k, v]) => (
                        <div key={k} className="flex items-center justify-between rounded-lg border border-border px-3 py-2">
                          <span>{k}</span>
                          <span className="font-medium">{v}</span>
                        </div>
                      ))}
                  </div>
                </Card>
              </div>
            </motion.div>
          </motion.aside>
        ) : null}
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
              <SectionTitle title={lang === 'es' ? 'Editar Arquetipo' : 'Edit Archetype'} subtitle={editingArchetype.id} />
              <div className="space-y-3">
                <Input
                  value={editingArchetype.name}
                  onChange={(e) => setEditingArchetype({ ...editingArchetype, name: e.target.value })}
                  placeholder={lang === 'es' ? 'Nombre' : 'Name'}
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
                  <Button onClick={() => saveArchetype(editingArchetype)}>{lang === 'es' ? 'Guardar' : 'Save'}</Button>
                  <Button variant="outline" onClick={() => setEditingArchetype(null)}>
                    {lang === 'es' ? 'Cancelar' : 'Cancel'}
                  </Button>
                </div>
              </div>
            </motion.div>
          </motion.aside>
        ) : null}
      </AnimatePresence>
        </section>
      </div>
    </div>
  )
}

function Field({
  label,
  hint,
  value,
  onChange,
}: {
  label: string
  hint?: string
  value: number
  onChange: (v: string) => void
}) {
  return (
    <div>
      <label className="mb-1 block text-xs" title={hint || ''}>
        {label}
        {hint ? <span className="ml-1 text-slate-400">ⓘ</span> : null}
      </label>
      <Input type="number" value={value} onChange={(e) => onChange(e.target.value)} />
    </div>
  )
}

function ContextEditor({
  lang,
  title,
  data,
  onChange,
}: {
  lang: 'es' | 'en'
  title: string
  data: Record<string, QualLevel>
  onChange: (key: string, value: QualLevel) => void
}) {
  const qualText = (q: QualLevel) => {
    if (lang === 'es') {
      if (q === 'very_low') return 'muy_bajo'
      if (q === 'low') return 'bajo'
      if (q === 'medium') return 'medio'
      if (q === 'high') return 'alto'
      return 'muy_alto'
    }
    return q
  }
  const qualClass: Record<QualLevel, string> = {
    very_low: 'border-emerald-500/40 bg-emerald-500/15 text-emerald-300',
    low: 'border-blue-500/40 bg-blue-500/15 text-blue-300',
    medium: 'border-amber-500/40 bg-amber-500/15 text-amber-200',
    high: 'border-orange-500/40 bg-orange-500/15 text-orange-300',
    very_high: 'border-red-500/40 bg-red-500/15 text-red-300',
  }
  const qualMeaning = (q: QualLevel) => {
    if (lang === 'es') {
      if (q === 'very_low') return 'Impacto mínimo o fricción muy baja en este factor.'
      if (q === 'low') return 'Impacto bajo, se espera efecto moderado.'
      if (q === 'medium') return 'Nivel intermedio/base de referencia para este factor.'
      if (q === 'high') return 'Impacto alto, cambia de forma visible el comportamiento.'
      return 'Impacto muy alto, factor dominante en la dinámica simulada.'
    }
    if (q === 'very_low') return 'Minimal impact or very low friction for this factor.'
    if (q === 'low') return 'Low impact; moderate behavioral effect expected.'
    if (q === 'medium') return 'Baseline/intermediate level for this factor.'
    if (q === 'high') return 'High impact; visibly shifts behavior.'
    return 'Very high impact; dominant driver in simulated dynamics.'
  }
  const docFor = (key: string) => {
    const d = COMPANY_FIELD_DOC[key]
    if (!d) return null
    return d[lang]
  }
  const labelFor = (key: string) => docFor(key)?.label || key
  const helpFor = (key: string) =>
    docFor(key)?.help ||
    (lang === 'es'
      ? 'Variable cualitativa que afecta la reacción de usuarios en la simulación.'
      : 'Qualitative variable that affects user reaction in simulation.')
  return (
    <Card>
      <SectionTitle title={title} />
      <div className="grid gap-2 sm:grid-cols-2">
        {Object.keys(data).map((key) => (
          <div key={key}>
            <div className="mb-1 flex items-center justify-between gap-2">
              <label className="block text-xs" title={helpFor(key)}>
                {labelFor(key)}
              </label>
              <Badge className={qualClass[data[key] || 'medium']} title={qualMeaning(data[key] || 'medium')}>
                {qualText(data[key] || 'medium')}
              </Badge>
            </div>
            <p className="mb-1 text-[11px] text-slate-500 dark:text-slate-400">{helpFor(key)}</p>
            <Select value={data[key]} onChange={(e) => onChange(key, e.target.value as QualLevel)}>
              {QUAL_LEVELS.map((q) => (
                <option key={q} value={q} title={qualMeaning(q)}>
                  {qualText(q)}
                </option>
              ))}
            </Select>
            <p className="mt-1 text-[11px] text-slate-500 dark:text-slate-400">
              {lang === 'es' ? 'Nivel actual' : 'Current level'}: {qualText(data[key] || 'medium')} — {qualMeaning(data[key] || 'medium')}
            </p>
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
  const qualText = (q: QualLevel) => {
    if (lang === 'es') {
      if (q === 'very_low') return 'muy_bajo'
      if (q === 'low') return 'bajo'
      if (q === 'medium') return 'medio'
      if (q === 'high') return 'alto'
      return 'muy_alto'
    }
    return q
  }
  const colorByQual: Record<QualLevel, string> = {
    very_low: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40',
    low: 'bg-blue-500/20 text-blue-300 border-blue-500/40',
    medium: 'bg-amber-500/20 text-amber-200 border-amber-500/40',
    high: 'bg-orange-500/20 text-orange-300 border-orange-500/40',
    very_high: 'bg-red-500/20 text-red-300 border-red-500/40',
  }
  return (
    <Card>
      <SectionTitle title={title} />
      <div className="space-y-2">
        {fields.map((key) => (
          <div key={key} className="rounded-xl border border-border p-3">
            <div className="text-xs text-slate-500">{key}</div>
            <div className="mt-1 flex items-center justify-between">
              <span className="text-sm font-medium">{qualText(data[key] || 'medium')}</span>
              <Badge className={colorByQual[data[key] || 'medium']}>{lang === 'es' ? 'impacto' : 'impact'}</Badge>
            </div>
          </div>
        ))}
      </div>
    </Card>
  )
}

function StepIntro({ title, description }: { title: string; description: string }) {
  return (
    <Card className="border-primary/30 bg-primary/10">
      <h4 className="text-sm font-semibold text-primary">{title}</h4>
      <p className="mt-1 text-sm text-slate-300">{description}</p>
    </Card>
  )
}

function MetricCard({
  icon: Icon,
  label,
  value,
  subtitle,
}: {
  icon: React.ComponentType<{ className?: string }>
  label: string
  value: string
  subtitle?: string
}) {
  return (
    <Card>
      <div className="mb-2 flex items-center justify-between">
        <p className="text-sm text-slate-500 dark:text-slate-400">{label}</p>
        <Icon className="h-4 w-4 text-primary" />
      </div>
      <p className="text-xl font-semibold sm:text-2xl">{value}</p>
      {subtitle ? <p className="mt-1 text-[11px] leading-4 text-slate-500 dark:text-slate-400">{subtitle}</p> : null}
      <div className="mt-3 flex gap-1">
        {[28, 46, 40, 62, 57, 71, 66].map((h, i) => (
          <div key={i} className="h-8 flex-1 rounded-full bg-primary/15">
            <div className="w-full rounded-full bg-gradient-to-t from-primary/20 to-primary/70" style={{ height: `${h}%` }} />
          </div>
        ))}
      </div>
    </Card>
  )
}

function PanicMetricCard({
  lang,
  score,
  label,
  mainDriver,
  onOpen,
}: {
  lang: Lang
  score: number
  label: string
  mainDriver: string
  onOpen: () => void
}) {
  const severity = panicSeverityStyle(score)
  const gaugeColor = panicGaugeColor(score)
  const clamped = Math.min(100, Math.max(0, score))
  return (
    <Card className={`cursor-pointer border-2 ${severity.border}`} onClick={onOpen}>
      <div className="mb-2 flex items-center justify-between">
        <p className="text-sm text-slate-400">{lang === 'es' ? 'Panic Index' : 'Panic Index'}</p>
        <AlertTriangle className={`h-4 w-4 ${severity.text}`} />
      </div>

      <div className="mb-2 flex items-center justify-between gap-3">
        <div
          className="relative h-20 w-20 rounded-full"
          style={{
            background: `conic-gradient(${gaugeColor} ${clamped * 3.6}deg, rgba(148,163,184,0.18) 0deg)`,
          }}
        >
          <div className="absolute inset-[8px] flex items-center justify-center rounded-full bg-slate-950/90">
            <span className="text-sm font-semibold">{score.toFixed(0)}</span>
          </div>
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-2xl font-bold leading-none sm:text-3xl">{score.toFixed(1)}</p>
          <p className="mt-1 text-xs text-slate-400">/ 100</p>
        </div>
        <Badge className={`${severity.badge}`}>{label}</Badge>
      </div>

      <div className="mt-1 h-2 rounded-full bg-muted">
        <div className={`h-2 rounded-full ${severity.bar}`} style={{ width: `${Math.min(100, Math.max(0, score))}%` }} />
      </div>
      <p className="mt-3 text-xs text-slate-400">
        {lang === 'es' ? 'Driver principal' : 'Main driver'}: {panicDriverLabel(mainDriver, lang)}
      </p>
    </Card>
  )
}

function buildSankeyData(
  metrics:
    | {
        estimated_migration_of_funds?: number
        archetype_level_breakdown?: Record<string, Record<string, number>>
      }
    | undefined
) {
  const breakdown = metrics?.archetype_level_breakdown || {}
  const archetypeNames = Object.keys(breakdown)
  if (!archetypeNames.length) return { nodes: [], links: [] }

  const actionWeight: Record<string, number> = {
    withdraw_fast: 1.0,
    move_funds: 1.0,
    buy_crypto: 0.9,
    reduce_balance: 0.6,
    exploit_promo: 0.35,
    wait_and_see: 0.2,
    stay: 0.05,
    increase_usage: 0.05,
  }
  const actionDestination: Record<string, string> = {
    withdraw_fast: 'cash_out',
    move_funds: 'competitor_wallet',
    buy_crypto: 'crypto_assets',
    reduce_balance: 'bank_or_cash',
    exploit_promo: 'promo_loop',
    wait_and_see: 'in_app_wait',
    stay: 'in_app_stable',
    increase_usage: 'in_app_growth',
  }

  const actionTotals: Record<string, number> = {}
  let weightedTotal = 0

  for (const archetype of archetypeNames) {
    const actions = breakdown[archetype] || {}
    for (const [action, count] of Object.entries(actions)) {
      const weighted = Math.max(0, count) * (actionWeight[action] || 0.2)
      actionTotals[action] = (actionTotals[action] || 0) + weighted
      weightedTotal += weighted
    }
  }

  const migrationBase = Math.max(1, metrics?.estimated_migration_of_funds || weightedTotal || 1)
  const factor = weightedTotal > 0 ? migrationBase / weightedTotal : 1

  const linksRaw: Array<{ source: string; target: string; value: number }> = []

  for (const archetype of archetypeNames) {
    const actions = breakdown[archetype] || {}
    for (const [action, count] of Object.entries(actions)) {
      const weighted = Math.max(0, count) * (actionWeight[action] || 0.2) * factor
      if (weighted <= 0) continue
      linksRaw.push({ source: archetype, target: action, value: weighted })
    }
  }

  for (const [action, weightedCount] of Object.entries(actionTotals)) {
    const destination = actionDestination[action] || 'other_destination'
    const value = weightedCount * factor
    if (value <= 0) continue
    linksRaw.push({ source: action, target: destination, value })
  }

  const nodeNames = Array.from(new Set(linksRaw.flatMap((l) => [l.source, l.target])))
  const nodeIndex = Object.fromEntries(nodeNames.map((name, idx) => [name, idx]))

  return {
    nodes: nodeNames.map((name) => ({ name })),
    links: linksRaw.map((l) => ({
      source: nodeIndex[l.source],
      target: nodeIndex[l.target],
      value: Number(l.value.toFixed(2)),
    })),
  }
}

function num(v?: number) {
  if (v === undefined || v === null) return '-'
  return Intl.NumberFormat('en-US', { maximumFractionDigits: 0 }).format(v)
}

function panicSeverityStyle(score: number) {
  if (score <= 25) {
    return {
      border: 'border-emerald-500/40',
      text: 'text-emerald-400',
      badge: 'border-emerald-500/40 bg-emerald-500/15 text-emerald-300',
      bar: 'bg-emerald-500',
    }
  }
  if (score <= 50) {
    return {
      border: 'border-yellow-500/40',
      text: 'text-yellow-400',
      badge: 'border-yellow-500/40 bg-yellow-500/15 text-yellow-300',
      bar: 'bg-yellow-500',
    }
  }
  if (score <= 75) {
    return {
      border: 'border-orange-500/40',
      text: 'text-orange-400',
      badge: 'border-orange-500/40 bg-orange-500/15 text-orange-300',
      bar: 'bg-orange-500',
    }
  }
  return {
    border: 'border-red-500/40',
    text: 'text-red-400',
    badge: 'border-red-500/40 bg-red-500/15 text-red-300',
    bar: 'bg-red-500',
  }
}

function panicGaugeColor(score: number) {
  if (score <= 25) return '#22c55e'
  if (score <= 50) return '#eab308'
  if (score <= 75) return '#f97316'
  return '#ef4444'
}

function panicDriverLabel(driver: string, lang: Lang) {
  const labels: Record<string, { es: string; en: string }> = {
    trust_deterioration: { es: 'deterioro de confianza', en: 'trust deterioration' },
    liquidity_stress: { es: 'estrés de liquidez', en: 'liquidity stress' },
    withdraw_fast_share: { es: 'retiros acelerados', en: 'fast withdrawals' },
    move_funds_share: { es: 'migración de fondos', en: 'fund migration' },
    rumor_activation_score: { es: 'activación por rumores', en: 'rumor activation' },
    crypto_flight_score: { es: 'vuelo hacia cripto', en: 'crypto flight' },
  }
  return labels[driver]?.[lang] || driver
}

function tacticalRecommendationContext(
  item: { title: string; why?: string; category?: string },
  run: RunRecord,
  lang: Lang
) {
  const s = run.outputs?.single_run
  const panic = Number(s?.panic_index_score || 0)
  const churn = Number(s?.churn_proxy || 0)
  const liquidity = Number(s?.liquidity_stress_proxy || 0)
  const trust = Number(s?.trust_deterioration_proxy || 0)

  const drivers: string[] = []
  if (panic >= 60) drivers.push(lang === 'es' ? 'Panic Index elevado' : 'High Panic Index')
  if (liquidity >= 0.5) drivers.push(lang === 'es' ? 'estrés de liquidez' : 'liquidity stress')
  if (churn >= 0.35) drivers.push(lang === 'es' ? 'riesgo de churn' : 'churn risk')
  if (trust >= 0.45) drivers.push(lang === 'es' ? 'deterioro de confianza' : 'trust deterioration')
  if (!drivers.length) drivers.push(lang === 'es' ? 'señales preventivas tempranas' : 'early preventive signals')

  const category = item.category || 'risk_mitigation'
  const whyNowMap: Record<string, { es: string; en: string }> = {
    risk_mitigation: {
      es: 'Reduce riesgo sistémico antes de que se amplifique el contagio.',
      en: 'Reduces systemic risk before contagion amplifies.',
    },
    retention: {
      es: 'Protege base activa y evita migración silenciosa a competidores.',
      en: 'Protects active base and prevents silent migration to competitors.',
    },
    liquidity: {
      es: 'Contiene outflows y mejora visibilidad operativa de fondos.',
      en: 'Contains outflows and improves operational liquidity visibility.',
    },
    trust_recovery: {
      es: 'Recupera credibilidad para disminuir retiros preventivos.',
      en: 'Restores credibility to reduce preventive withdrawals.',
    },
    pricing: {
      es: 'Ajusta incentivos para sostener uso sin destruir margen.',
      en: 'Rebalances incentives to sustain usage without margin damage.',
    },
  }

  return {
    rationale:
      lang === 'es'
        ? `La recomendación se prioriza por el contexto actual del run (${item.title}) y su sensibilidad a los indicadores de riesgo.`
        : `This recommendation is prioritized based on current run conditions (${item.title}) and its risk sensitivity.`,
    drivers,
    whyNow: whyNowMap[category]?.[lang] || whyNowMap.risk_mitigation[lang],
  }
}

function innovationRecommendationContext(
  item: { idea: string; fit?: string; inspiration?: string; disruptiveness?: string },
  run: RunRecord,
  lang: Lang
) {
  const s = run.outputs?.single_run
  const panic = Number(s?.panic_index_score || 0)
  const promoRisk = Number(s?.promo_abuse_risk_proxy || 0)
  const liquidity = Number(s?.liquidity_stress_proxy || 0)

  const drivers: string[] = []
  if (panic >= 60) drivers.push(lang === 'es' ? 'vulnerabilidad de comportamiento' : 'behavioral vulnerability')
  if (liquidity >= 0.5) drivers.push(lang === 'es' ? 'tensión de liquidez' : 'liquidity tension')
  if (promoRisk >= 0.2) drivers.push(lang === 'es' ? 'presión de promos' : 'promo pressure')
  if (!drivers.length) drivers.push(lang === 'es' ? 'oportunidad de diferenciación' : 'differentiation opportunity')

  return {
    rationale:
      lang === 'es'
        ? `La idea "${item.idea}" busca crear una ventaja estructural, no sólo una respuesta táctica de corto plazo.`
        : `The idea "${item.idea}" aims to build structural advantage, not just a short-term tactical response.`,
    drivers,
    impactGoal:
      lang === 'es'
        ? 'Bajar sensibilidad al pánico y aumentar resiliencia de uso.'
        : 'Reduce panic sensitivity and improve usage resilience.',
  }
}

function pct(v?: number) {
  if (v === undefined || v === null) return '-'
  return `${(v * 100).toFixed(1)}%`
}
