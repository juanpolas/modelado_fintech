'use client'

import { useEffect, useMemo, useState } from 'react'
import {
  Background,
  Controls,
  Handle,
  MarkerType,
  MiniMap,
  Position,
  ReactFlow,
  ReactFlowProvider,
  type Edge,
  type Node,
  type NodeProps,
} from '@xyflow/react'
import '@xyflow/react/dist/style.css'
import { AlertTriangle, Gauge, Pause, Play, RotateCcw, SkipForward, TrendingUp, Waves } from 'lucide-react'
import { Card, Badge, Button, SectionTitle } from '@/components/ui/primitives'
import { QUAL_NUM } from '@/lib/constants'
import type { Archetype, RunRecord, SimulationPayload } from '@/types'

type ContagionState = 'stable' | 'alert' | 'panic' | 'crypto' | 'opportunity'

type ContagionNodeData = {
  label: string
  description: string
  state: ContagionState
  dominantAction: string
  fundsMoved: number
  activeAgents: number
  pulse: boolean
  size: number
}

type ContagionNode = Node<ContagionNodeData, 'contagionNode'>

const STATE_STYLES: Record<ContagionState, { ring: string; chip: string; gradient: string }> = {
  stable: {
    ring: 'rgba(59,130,246,0.65)',
    chip: 'bg-blue-500/15 text-blue-600 dark:text-blue-300',
    gradient: 'radial-gradient(circle at 30% 20%, #93c5fd, #2563eb 65%)',
  },
  alert: {
    ring: 'rgba(250,204,21,0.65)',
    chip: 'bg-yellow-500/15 text-yellow-700 dark:text-yellow-300',
    gradient: 'radial-gradient(circle at 30% 20%, #fde68a, #f59e0b 65%)',
  },
  panic: {
    ring: 'rgba(239,68,68,0.7)',
    chip: 'bg-red-500/15 text-red-600 dark:text-red-300',
    gradient: 'radial-gradient(circle at 30% 20%, #fca5a5, #dc2626 65%)',
  },
  crypto: {
    ring: 'rgba(168,85,247,0.72)',
    chip: 'bg-purple-500/15 text-purple-600 dark:text-purple-300',
    gradient: 'radial-gradient(circle at 30% 20%, #c4b5fd, #7c3aed 65%)',
  },
  opportunity: {
    ring: 'rgba(34,197,94,0.7)',
    chip: 'bg-green-500/15 text-green-700 dark:text-green-300',
    gradient: 'radial-gradient(circle at 30% 20%, #86efac, #16a34a 65%)',
  },
}

function CircularNode({ data }: NodeProps<ContagionNode>) {
  const style = STATE_STYLES[data.state]
  return (
    <div className="group relative flex items-center justify-center">
      <Handle type="target" position={Position.Left} style={{ opacity: 0 }} />
      <div
        className={data.pulse ? 'contagion-pulse' : ''}
        style={{
          width: data.size,
          height: data.size,
          borderRadius: '999px',
          background: style.gradient,
          boxShadow: `0 0 0 2px ${style.ring}, 0 10px 24px rgba(0,0,0,0.2)`,
          transition: 'all 420ms ease',
        }}
      />
      <div className="pointer-events-none absolute -bottom-7 left-1/2 -translate-x-1/2 whitespace-nowrap rounded-md bg-black/60 px-2 py-1 text-[10px] text-white opacity-0 transition group-hover:opacity-100">
        {data.label}
      </div>
      <Handle type="source" position={Position.Right} style={{ opacity: 0 }} />
    </div>
  )
}

const nodeTypes = { contagionNode: CircularNode }

export function BehaviorContagionMap({
  archetypes,
  run,
  payload,
  lang,
}: {
  archetypes: Archetype[]
  run: RunRecord
  payload: SimulationPayload
  lang: 'es' | 'en'
}) {
  const timeline = run.outputs.single_run.timeline || []
  const stepCount = Math.max(1, timeline.length)
  const [step, setStep] = useState(0)
  const [playing, setPlaying] = useState(true)
  const [hovered, setHovered] = useState<ContagionNodeData | null>(null)

  useEffect(() => {
    if (!playing) return
    const id = window.setInterval(() => {
      setStep((s) => (s >= stepCount - 1 ? s : s + 1))
    }, 900)
    return () => window.clearInterval(id)
  }, [playing, stepCount])

  useEffect(() => {
    if (step >= stepCount - 1) setPlaying(false)
  }, [step, stepCount])

  const { nodes, edges, analysis } = useMemo(() => {
    const thisStep = timeline[Math.min(step, timeline.length - 1)] || {
      churn_proxy: 0,
      trust_deterioration_proxy: 0,
      liquidity_stress_proxy: 0,
    }

    const breakdown = run.outputs.single_run.archetype_level_breakdown || {}
    const migrationTotal = run.outputs.single_run.estimated_migration_of_funds || 0

    const arranged = archetypes.map((a, idx) => {
      const ratio = (payload.archetype_mix[a.id] || 0) / 100
      const actionMap = breakdown[a.id] || {}
      const dominantAction =
        Object.entries(actionMap).sort((x, y) => Number(y[1]) - Number(x[1]))[0]?.[0] || 'stay'

      const stress = Number(thisStep.liquidity_stress_proxy || 0)
      const churn = Number(thisStep.churn_proxy || 0)
      let state: ContagionState = 'stable'

      if (dominantAction === 'buy_crypto' && (stress > 0.55 || payload.country_context.usd_volatility === 'very_high')) state = 'crypto'
      else if (stress > 0.72 && ['withdraw_fast', 'move_funds'].includes(dominantAction)) state = 'panic'
      else if (['increase_usage', 'exploit_promo'].includes(dominantAction) && churn < 0.38) state = 'opportunity'
      else if (stress > 0.45) state = 'alert'

      const influence = (QUAL_NUM[a.rumor_sensitivity] + QUAL_NUM[a.reaction_speed]) / 10
      const intensity = Math.min(1, 0.2 + ratio * 2 + influence * 0.3 + stress * 0.35)
      const size = 58 + intensity * 34
      const fundsMoved = migrationTotal * ratio * ((step + 1) / stepCount)
      const activeAgents = Math.round((payload.num_agents || 300) * ratio * (0.65 + stress * 0.5))

      const angle = (idx / Math.max(archetypes.length, 1)) * Math.PI * 2
      const radius = 240

      const data: ContagionNodeData = {
        label: a.name,
        description: a.description,
        state,
        dominantAction,
        fundsMoved,
        activeAgents,
        pulse: ['panic', 'crypto'].includes(state),
        size,
      }

      const node: Node<ContagionNodeData> = {
        id: a.id,
        type: 'contagionNode',
        position: {
          x: 310 + Math.cos(angle) * radius,
          y: 260 + Math.sin(angle) * radius,
        },
        data,
      }

      return { node, influence, state, dominantAction, archetype: a }
    })

    const trigger = [...arranged].sort((a, b) => b.influence - a.influence)[0]
    const affected = [...arranged]
      .filter((x) => x.state === 'panic' || x.state === 'crypto')
      .sort((a, b) => b.influence - a.influence)
      .slice(0, 3)

    const nodesOut = arranged.map((x) => x.node as ContagionNode)

    const edgesOut: Edge[] = []
    for (let i = 0; i < arranged.length; i += 1) {
      for (let j = 0; j < arranged.length; j += 1) {
        if (i === j) continue
        const source = arranged[i]
        const target = arranged[j]
        if ((i + j) % 3 !== 0 && source.archetype.id !== trigger.archetype.id) continue

        const strength = Math.min(1, source.influence * 0.65 + Number(thisStep.liquidity_stress_proxy || 0) * 0.35)
        const active = ['panic', 'crypto'].includes(source.state) && strength > 0.46
        const stroke = active ? (source.state === 'crypto' ? '#a855f7' : '#ef4444') : '#94a3b8'

        edgesOut.push({
          id: `${source.archetype.id}->${target.archetype.id}`,
          source: source.archetype.id,
          target: target.archetype.id,
          animated: active,
          markerEnd: {
            type: MarkerType.ArrowClosed,
            width: 18,
            height: 18,
            color: stroke,
          },
          style: {
            stroke,
            strokeWidth: 1 + strength * 4,
            opacity: active ? 0.95 : 0.34,
            transition: 'all 420ms ease',
            filter: active ? 'drop-shadow(0 0 4px rgba(248,113,113,0.6))' : 'none',
          },
        })
      }
    }

    const resistant = arranged
      .filter((x) => x.state === 'stable' || x.state === 'opportunity')
      .map((x) => x.archetype.name)
      .slice(0, 4)

    const dominantActions = arranged
      .map((x) => x.dominantAction)
      .reduce<Record<string, number>>((acc, action) => {
        acc[action] = (acc[action] || 0) + 1
        return acc
      }, {})

    const actionsSorted = Object.entries(dominantActions)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3)
      .map(([name]) => name)

    return {
      nodes: nodesOut,
      edges: edgesOut,
      analysis: {
        trigger: trigger?.archetype.name || '-',
        affected: affected.map((x) => x.archetype.name),
        dominantActions: actionsSorted,
        resistant,
      },
    }
  }, [archetypes, payload, run, step, stepCount, timeline])

  return (
    <Card className="overflow-hidden">
      <SectionTitle
        title={lang === 'es' ? 'Mapa de Contagio Conductual' : 'Behavior Contagion Map'}
        subtitle={
          lang === 'es'
            ? 'Cómo se propagan los comportamientos financieros entre arquetipos en cada paso.'
            : 'How financial behaviors spread between archetypes during simulation steps.'
        }
      />

      <div className="mb-4 flex flex-wrap items-center gap-2">
        <Button variant="outline" onClick={() => setPlaying((v) => !v)}>
          {playing ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />} {playing ? (lang === 'es' ? 'Pausar' : 'Pause') : lang === 'es' ? 'Play' : 'Play'}
        </Button>
        <Button variant="outline" onClick={() => setStep((s) => Math.min(stepCount - 1, s + 1))}>
          <SkipForward className="h-4 w-4" /> {lang === 'es' ? 'Paso' : 'Step'}
        </Button>
        <Button variant="outline" onClick={() => { setStep(0); setPlaying(false) }}>
          <RotateCcw className="h-4 w-4" /> {lang === 'es' ? 'Reiniciar' : 'Reset'}
        </Button>
        <Badge>{lang === 'es' ? 'Paso' : 'Step'} {Math.min(step + 1, stepCount)} / {stepCount}</Badge>
      </div>

      <div className="grid gap-4 xl:grid-cols-[1fr_330px]">
        <div className="relative h-[560px] rounded-2xl border border-border bg-slate-50/60 dark:bg-slate-900/30">
          <ReactFlowProvider>
            <ReactFlow
              nodes={nodes}
              edges={edges}
              nodeTypes={nodeTypes}
              fitView
              fitViewOptions={{ padding: 0.18 }}
              onNodeMouseEnter={(_, node) => setHovered(node.data)}
              onNodeMouseLeave={() => setHovered(null)}
              minZoom={0.35}
              maxZoom={1.5}
            >
              <Background gap={18} size={1.1} color="#64748b" />
              <MiniMap zoomable pannable nodeStrokeWidth={3} />
              <Controls />
            </ReactFlow>
          </ReactFlowProvider>

          {hovered ? (
            <div className="absolute left-4 top-4 w-72 rounded-xl border border-border bg-card/95 p-3 shadow-xl backdrop-blur">
              <div className="mb-2 flex items-center justify-between">
                <h4 className="font-semibold">{hovered.label}</h4>
                <Badge className={STATE_STYLES[hovered.state].chip}>{hovered.state}</Badge>
              </div>
              <p className="mb-2 text-xs text-slate-500 dark:text-slate-400">{hovered.description}</p>
              <div className="grid grid-cols-2 gap-2 text-xs">
                <div className="rounded-lg bg-muted p-2">
                  <div className="mb-1 text-[10px] text-slate-500">{lang === 'es' ? 'Acción dominante' : 'Dominant action'}</div>
                  <div className="font-medium">{hovered.dominantAction}</div>
                </div>
                <div className="rounded-lg bg-muted p-2">
                  <div className="mb-1 text-[10px] text-slate-500">{lang === 'es' ? 'Fondos movidos' : 'Funds moved'}</div>
                  <div className="font-medium">${Math.round(hovered.fundsMoved).toLocaleString()}</div>
                </div>
              </div>
            </div>
          ) : null}
        </div>

        <Card className="h-fit">
          <SectionTitle
            title={lang === 'es' ? 'Análisis de Contagio' : 'Contagion Analysis'}
            subtitle={lang === 'es' ? 'Interpretación en vivo del paso actual.' : 'Live interpretation for the current simulation step.'}
          />
          <div className="space-y-3 text-sm">
            <Insight icon={Waves} label={lang === 'es' ? 'Disparador inicial' : 'Initial trigger'} value={analysis.trigger} />
            <Insight icon={AlertTriangle} label={lang === 'es' ? 'Más afectados' : 'Most affected'} value={analysis.affected.join(', ') || '-'} />
            <Insight icon={Gauge} label={lang === 'es' ? 'Acciones dominantes' : 'Dominant actions'} value={analysis.dominantActions.join(', ') || '-'} />
            <Insight icon={TrendingUp} label={lang === 'es' ? 'Segmentos resilientes' : 'Resisting panic'} value={analysis.resistant.join(', ') || '-'} />
          </div>
        </Card>
      </div>
    </Card>
  )
}

function Insight({
  icon: Icon,
  label,
  value,
}: {
  icon: React.ComponentType<{ className?: string }>
  label: string
  value: string
}) {
  return (
    <div className="rounded-xl border border-border p-3">
      <div className="mb-1 inline-flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
        <Icon className="h-3.5 w-3.5" />
        {label}
      </div>
      <p className="font-medium">{value}</p>
    </div>
  )
}
