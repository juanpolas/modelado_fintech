<template>
  <div class="app-shell">
    <header>
      <h1>MiroFish AR Fintech Simulator</h1>
      <div v-if="authorized" class="header-actions">
        <button @click="activeTab = 'new'">New Simulation</button>
        <button @click="activeTab = 'archetypes'">Archetype Manager</button>
        <button @click="activeTab = 'scenarios'">Scenario Manager</button>
        <button @click="activeTab = 'runs'">Past Runs</button>
        <button @click="activeTab = 'settings'">Settings</button>
        <button class="danger" @click="logout">Logout</button>
      </div>
    </header>

    <section v-if="!authorized" class="gate">
      <h2>Access Code Required</h2>
      <input v-model="accessCode" placeholder="Enter APP_ACCESS_CODE" @keyup.enter="login" />
      <button @click="login">Enter</button>
      <p class="error" v-if="error">{{ error }}</p>
    </section>

    <main v-else>
      <section v-if="activeTab === 'new'">
        <h2>New Simulation</h2>
        <div class="grid-2">
          <div class="card">
            <h3>Basic Settings</h3>
            <label>Scenario
              <select v-model="simForm.scenario_id">
                <option :value="null">custom</option>
                <option v-for="s in scenarios" :key="s.id" :value="s.id">{{ s.name }}</option>
              </select>
            </label>
            <label>Scenario Name <input v-model="simForm.scenario_name" /></label>
            <label>Agents <input type="number" v-model.number="simForm.num_agents" /></label>
            <label>Steps <input type="number" v-model.number="simForm.num_steps" /></label>
            <label>Seed <input type="number" v-model.number="simForm.seed" /></label>
            <label>Monte Carlo Runs <input type="number" v-model.number="simForm.monte_carlo_runs" /></label>
          </div>
          <div class="card">
            <h3>Archetype Mix (%)</h3>
            <label v-for="a in archetypes" :key="a.id">{{ a.name }}
              <input type="number" min="0" max="100" v-model.number="simForm.archetype_mix[a.id]" />
            </label>
            <p>Total: {{ mixTotal }}%</p>
          </div>
        </div>

        <div class="grid-2">
          <div class="card">
            <h3>Country Context</h3>
            <label v-for="k in Object.keys(simForm.country_context)" :key="k">{{ k }}
              <select v-model="simForm.country_context[k]"><option v-for="q in qual" :key="q" :value="q">{{ q }}</option></select>
            </label>
          </div>
          <div class="card">
            <h3>Company Context</h3>
            <label v-for="k in Object.keys(simForm.company_context)" :key="k">{{ k }}
              <select v-model="simForm.company_context[k]"><option v-for="q in qual" :key="q" :value="q">{{ q }}</option></select>
            </label>
          </div>
        </div>

        <div class="card">
          <h3>AI-assisted Context Inputs</h3>
          <textarea v-model="futureText" placeholder="Future scenario text"></textarea>
          <button @click="translateScenario">Translate Scenario</button>
          <textarea v-model="eventText" placeholder="Global event text"></textarea>
          <button @click="translateImpact">Translate Global Event Impact</button>
          <p class="hint">Preview is applied directly to editable context fields above.</p>
        </div>

        <button class="primary" @click="runSimulation">Run Simulation</button>

        <section v-if="latestRun" class="results">
          <h3>Results</h3>
          <div class="cards">
            <div class="mini-card">Migration Funds: {{ currentMetrics.estimated_migration_of_funds }}</div>
            <div class="mini-card">Churn Proxy: {{ currentMetrics.churn_proxy }}</div>
            <div class="mini-card">Liquidity Stress: {{ currentMetrics.liquidity_stress_proxy }}</div>
            <div class="mini-card">Promo Abuse Risk: {{ currentMetrics.promo_abuse_risk_proxy }}</div>
          </div>
          <div class="grid-2">
            <div class="card">
              <h4>Timeline (churn, trust, liquidity)</h4>
              <svg viewBox="0 0 400 180" class="chart">
                <polyline :points="chartPoints('churn_proxy')" stroke="#ca3a2b" fill="none"/>
                <polyline :points="chartPoints('trust_deterioration_proxy')" stroke="#194f90" fill="none"/>
                <polyline :points="chartPoints('liquidity_stress_proxy')" stroke="#2b8a3e" fill="none"/>
              </svg>
            </div>
            <div class="card">
              <h4>Final Action Distribution</h4>
              <pre>{{ currentMetrics.final_action_distribution }}</pre>
              <button @click="duplicateRun(latestRun.id)">Duplicate Run</button>
              <button @click="exportJson(latestRun, `run-${latestRun.id}.json`)">Export Run</button>
            </div>
          </div>
          <div class="grid-2">
            <div class="card">
              <h4>Tactical Recommendations</h4>
              <pre>{{ latestRun.tactical_recommendations }}</pre>
            </div>
            <div class="card">
              <h4>Innovation Lab</h4>
              <pre>{{ latestRun.disruptive_recommendations }}</pre>
            </div>
          </div>
        </section>
      </section>

      <section v-if="activeTab === 'archetypes'">
        <h2>Archetype Manager</h2>
        <button @click="newArchetype">New</button>
        <button @click="exportJson(archetypes, 'archetypes.json')">Export JSON</button>
        <input type="file" accept="application/json" @change="importArchetypes" />
        <div class="list">
          <div class="card" v-for="a in archetypes" :key="a.id">
            <h4>{{ a.name }} ({{ a.id }})</h4>
            <textarea v-model="a.description"></textarea>
            <label>trust_level <select v-model="a.trust_level"><option v-for="q in qual" :key="q" :value="q">{{ q }}</option></select></label>
            <label>interest_rate_sensitivity <select v-model="a.interest_rate_sensitivity"><option v-for="q in qual" :key="q" :value="q">{{ q }}</option></select></label>
            <label>promotion_sensitivity <select v-model="a.promotion_sensitivity"><option v-for="q in qual" :key="q" :value="q">{{ q }}</option></select></label>
            <label>crypto_affinity <select v-model="a.crypto_affinity"><option v-for="q in qual" :key="q" :value="q">{{ q }}</option></select></label>
            <label>rumor_sensitivity <select v-model="a.rumor_sensitivity"><option v-for="q in qual" :key="q" :value="q">{{ q }}</option></select></label>
            <label>reaction_speed <select v-model="a.reaction_speed"><option v-for="q in qual" :key="q" :value="q">{{ q }}</option></select></label>
            <label>liquidity_preference <select v-model="a.liquidity_preference"><option v-for="q in qual" :key="q" :value="q">{{ q }}</option></select></label>
            <label>risk_aversion <select v-model="a.risk_aversion"><option v-for="q in qual" :key="q" :value="q">{{ q }}</option></select></label>
            <label>income_stability <select v-model="a.income_stability"><option v-for="q in qual" :key="q" :value="q">{{ q }}</option></select></label>
            <label>macro_anxiety <select v-model="a.macro_anxiety"><option v-for="q in qual" :key="q" :value="q">{{ q }}</option></select></label>
            <label>balance_bucket
              <select v-model="a.balance_bucket"><option value="low">low</option><option value="mid">mid</option><option value="high">high</option></select>
            </label>
            <label>Prompt template <textarea v-model="a.behavioral_prompt_template"></textarea></label>
            <button @click="saveArchetype(a)">Save</button>
            <button @click="duplicateArchetype(a)">Duplicate</button>
            <button class="danger" @click="removeArchetype(a.id)">Delete</button>
          </div>
        </div>
      </section>

      <section v-if="activeTab === 'scenarios'">
        <h2>Scenario Manager</h2>
        <button @click="newScenario">New</button>
        <button @click="exportJson(scenarios, 'scenarios.json')">Export JSON</button>
        <input type="file" accept="application/json" @change="importScenarios" />
        <div class="list">
          <div class="card" v-for="s in scenarios" :key="s.id">
            <h4>{{ s.name }} ({{ s.id }})</h4>
            <textarea v-model="s.description"></textarea>
            <label>Notes <textarea v-model="s.notes"></textarea></label>
            <button @click="saveScenario(s)">Save</button>
            <button @click="duplicateScenario(s)">Duplicate</button>
            <button class="danger" @click="removeScenario(s.id)">Delete</button>
          </div>
        </div>
      </section>

      <section v-if="activeTab === 'runs'">
        <h2>Past Runs</h2>
        <div class="list">
          <div class="card" v-for="r in runs" :key="r.id">
            <h4>{{ r.id }} - {{ r.created_at }}</h4>
            <p>{{ r.config.scenario_name }}</p>
            <button @click="latestRun = r; activeTab = 'new'">Open</button>
            <button @click="duplicateRun(r.id)">Duplicate</button>
            <button @click="exportJson(r, `run-${r.id}.json`)">Export</button>
          </div>
        </div>
      </section>

      <section v-if="activeTab === 'settings'">
        <h2>Settings</h2>
        <label>LLM Provider
          <select v-model="settings.llm_provider">
            <option value="mock">mock</option>
            <option value="deepseek">deepseek</option>
            <option value="qwen">qwen</option>
          </select>
        </label>
        <label>LLM Base URL <input v-model="settings.llm_base_url" /></label>
        <label>LLM Model <input v-model="settings.llm_model" /></label>
        <button @click="saveSettings">Save Settings</button>
      </section>
    </main>
  </div>
</template>

<script setup>
import { computed, onMounted, reactive, ref } from 'vue'
import api from './api'

const qual = ['very_low', 'low', 'medium', 'high', 'very_high']
const activeTab = ref('new')
const authorized = ref(false)
const accessCode = ref('')
const error = ref('')
const archetypes = ref([])
const scenarios = ref([])
const runs = ref([])
const latestRun = ref(null)
const futureText = ref('')
const eventText = ref('')
const settings = reactive({ llm_provider: 'mock', llm_base_url: '', llm_model: 'gpt-4o-mini' })

const simForm = reactive({
  scenario_id: null,
  scenario_name: 'custom',
  num_agents: 300,
  num_steps: 12,
  seed: 42,
  monte_carlo_runs: 1,
  archetype_mix: {},
  country_context: {
    inflation_expectation: 'high', usd_volatility: 'high', country_risk_pressure: 'high', bank_trust_index: 'medium',
    social_panic_level: 'medium', liquidity_preference_shift: 'high', crypto_volatility: 'high', energy_cost_pressure: 'high',
    consumer_confidence: 'low', policy_uncertainty: 'high', labor_market_stress: 'medium', political_noise: 'high'
  },
  company_context: {
    wallet_yield_current: 'medium', wallet_yield_new: 'medium', competitor_yield: 'medium', cashback_percent: 'medium',
    cashback_cap: 'medium', onboarding_friction: 'low', KYC_friction: 'medium', app_stability: 'high', transfer_limits: 'medium',
    withdrawal_delay_risk: 'low', support_quality: 'medium', trust_baseline: 'medium', credit_offer_aggressiveness: 'medium', loan_rate_level: 'high'
  },
})

const mixTotal = computed(() => Object.values(simForm.archetype_mix).reduce((a, b) => a + (Number(b) || 0), 0))
const currentMetrics = computed(() => latestRun.value?.outputs?.single_run || {})

const chartPoints = (key) => {
  const timeline = currentMetrics.value.timeline || []
  if (!timeline.length) return ''
  return timeline.map((p, i) => `${(i / Math.max(timeline.length - 1, 1)) * 390},${170 - (Number(p[key] || 0) * 150)}`).join(' ')
}

const refreshAll = async () => {
  await Promise.all([loadArchetypes(), loadScenarios(), loadRuns(), loadSettings()])
}

const loadArchetypes = async () => {
  const { data } = await api.get('/archetypes')
  archetypes.value = data
  if (!Object.keys(simForm.archetype_mix).length) {
    const even = Number((100 / Math.max(1, data.length)).toFixed(2))
    for (const a of data) simForm.archetype_mix[a.id] = even
  }
}
const loadScenarios = async () => { scenarios.value = (await api.get('/scenarios')).data }
const loadRuns = async () => { runs.value = (await api.get('/runs')).data }
const loadSettings = async () => { Object.assign(settings, (await api.get('/settings')).data) }

const login = async () => {
  error.value = ''
  try {
    await api.post('/auth/login', { code: accessCode.value })
    authorized.value = true
    await refreshAll()
  } catch (e) {
    error.value = e?.response?.data?.detail || 'Login failed'
  }
}

const logout = async () => {
  await api.post('/auth/logout')
  authorized.value = false
  latestRun.value = null
}

const runSimulation = async () => {
  if (Math.abs(mixTotal.value - 100) > 0.01) {
    error.value = 'Archetype mix must total 100'
    return
  }
  const payload = JSON.parse(JSON.stringify(simForm))
  const { data } = await api.post('/simulate', payload)
  latestRun.value = data
  await loadRuns()
}

const translateScenario = async () => {
  if (!futureText.value) return
  const { data } = await api.post('/translate-scenario', { text: futureText.value })
  Object.assign(simForm.country_context, data.country_context)
  Object.assign(simForm.company_context, data.company_context)
}

const translateImpact = async () => {
  if (!eventText.value) return
  const { data } = await api.post('/impact-translate', { text: eventText.value })
  Object.assign(simForm.country_context, data.country_context)
  Object.assign(simForm.company_context, data.company_context)
}

const saveArchetype = async (a) => {
  if (a._new) {
    delete a._new
    await api.post('/archetypes', a)
  } else {
    await api.put(`/archetypes/${a.id}`, a)
  }
  await loadArchetypes()
}
const removeArchetype = async (id) => { await api.delete(`/archetypes/${id}`); await loadArchetypes() }
const duplicateArchetype = (a) => {
  const copy = JSON.parse(JSON.stringify(a))
  copy.id = `${a.id}_copy_${Math.floor(Math.random() * 9999)}`
  copy.name = `${a.name} copy`
  copy._new = true
  archetypes.value.unshift(copy)
}
const newArchetype = () => {
  const base = archetypes.value[0]
  if (!base) return
  duplicateArchetype(base)
}

const saveScenario = async (s) => {
  if (s._new) {
    delete s._new
    await api.post('/scenarios', s)
  } else {
    await api.put(`/scenarios/${s.id}`, s)
  }
  await loadScenarios()
}
const removeScenario = async (id) => { await api.delete(`/scenarios/${id}`); await loadScenarios() }
const duplicateScenario = (s) => {
  const copy = JSON.parse(JSON.stringify(s))
  copy.id = `${s.id}_copy_${Math.floor(Math.random() * 9999)}`
  copy.name = `${s.name} copy`
  copy._new = true
  scenarios.value.unshift(copy)
}
const newScenario = () => {
  const base = scenarios.value[0]
  if (!base) return
  duplicateScenario(base)
}

const duplicateRun = async (id) => {
  const { data } = await api.post(`/runs/${id}/duplicate`)
  latestRun.value = data
  await loadRuns()
}

const saveSettings = async () => {
  await api.put('/settings', settings)
  await loadSettings()
}

const exportJson = (obj, filename) => {
  const blob = new Blob([JSON.stringify(obj, null, 2)], { type: 'application/json' })
  const a = document.createElement('a')
  a.href = URL.createObjectURL(blob)
  a.download = filename
  a.click()
  URL.revokeObjectURL(a.href)
}

const importArchetypes = async (event) => {
  const file = event.target.files[0]
  if (!file) return
  const rows = JSON.parse(await file.text())
  for (const row of rows) {
    await api.post('/archetypes', row)
  }
  await loadArchetypes()
}
const importScenarios = async (event) => {
  const file = event.target.files[0]
  if (!file) return
  const rows = JSON.parse(await file.text())
  for (const row of rows) {
    await api.post('/scenarios', row)
  }
  await loadScenarios()
}

onMounted(async () => {
  try {
    const { data } = await api.get('/auth/status')
    authorized.value = !!data.authorized
    if (authorized.value) await refreshAll()
  } catch {
    authorized.value = false
  }
})
</script>

<style>
:root {
  --bg: #f6f7f9;
  --card: #ffffff;
  --text: #1f2937;
  --accent: #194f90;
  --danger: #b42318;
}
* { box-sizing: border-box; }
body { margin: 0; font-family: 'IBM Plex Sans', sans-serif; background: var(--bg); color: var(--text); }
.app-shell { max-width: 1200px; margin: 0 auto; padding: 1rem; }
header { display: flex; justify-content: space-between; align-items: center; gap: 1rem; flex-wrap: wrap; }
.header-actions { display: flex; gap: .4rem; flex-wrap: wrap; }
button { background: #e5e7eb; border: 0; padding: .5rem .8rem; border-radius: 6px; cursor: pointer; }
button.primary { background: var(--accent); color: #fff; margin-top: 1rem; }
button.danger { background: var(--danger); color: #fff; }
.card { background: var(--card); border-radius: 8px; padding: .8rem; box-shadow: 0 1px 3px rgba(0,0,0,.08); }
.grid-2 { display: grid; grid-template-columns: 1fr 1fr; gap: 1rem; }
@media (max-width: 900px) { .grid-2 { grid-template-columns: 1fr; } }
label { display: flex; justify-content: space-between; gap: .5rem; margin: .4rem 0; align-items: center; }
input, textarea, select { width: 55%; padding: .35rem; }
textarea { min-height: 70px; }
.gate { max-width: 450px; margin: 5rem auto; background: var(--card); padding: 1rem; border-radius: 8px; }
.error { color: var(--danger); }
.hint { color: #616a74; font-size: .9rem; }
.cards { display: grid; grid-template-columns: repeat(4,1fr); gap: .6rem; }
@media (max-width: 900px) { .cards { grid-template-columns: 1fr 1fr; } }
.mini-card { background: var(--card); padding: .6rem; border-radius: 8px; }
.chart { width: 100%; height: 200px; background: #f2f5fb; border-radius: 6px; }
.list { display: grid; grid-template-columns: repeat(auto-fill,minmax(300px,1fr)); gap: .8rem; }
pre { white-space: pre-wrap; word-break: break-word; background: #f2f4f6; padding: .6rem; border-radius: 6px; max-height: 280px; overflow: auto; }
</style>
