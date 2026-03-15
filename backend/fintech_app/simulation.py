from __future__ import annotations

import random
from collections import Counter, defaultdict
from dataclasses import dataclass
from datetime import datetime, timezone
from statistics import mean
from typing import Any

from .defaults import ACTION_SET
from .funds_at_risk import build_funds_at_risk_breakdown
from .llm import LLMClient, mock_action, render_template
from .models import Archetype, SimulationConfig

QUAL_SCORE = {
    "very_low": 0.1,
    "low": 0.3,
    "medium": 0.5,
    "high": 0.75,
    "very_high": 0.95,
}
BALANCE_BUCKET = {"low": 500, "mid": 2500, "high": 10000}


@dataclass
class Agent:
    id: str
    archetype_id: str
    archetype_name: str
    balance_bucket: str
    trust_level: str
    interest_rate_sensitivity: str
    promotion_sensitivity: str
    crypto_affinity: str
    rumor_sensitivity: str
    risk_aversion: str
    reaction_speed: str
    liquidity_preference: str
    income_stability: str
    macro_anxiety: str
    prompt_template: str
    memory: list[dict[str, Any]]
    current_state: dict[str, Any]
    last_action: str


class SimulationEngine:
    def __init__(self, llm: LLMClient):
        self.llm = llm

    def run(self, config: SimulationConfig, archetypes: list[Archetype]) -> dict[str, Any]:
        mc_outputs = []
        for i in range(config.monte_carlo_runs):
            mc_outputs.append(self._single_run(config, archetypes, config.seed + i))
        return self._aggregate_runs(mc_outputs)

    def _single_run(self, config: SimulationConfig, archetypes: list[Archetype], seed: int) -> dict[str, Any]:
        rng = random.Random(seed)
        agents = self._build_agents(config, archetypes, rng)

        timeline = []
        archetype_action_breakdown: dict[str, Counter] = defaultdict(Counter)
        final_actions = Counter()

        cumulative_migration = 0.0
        cumulative_crypto = 0.0

        for step in range(1, config.num_steps + 1):
            step_actions = Counter()
            trust_losses = []
            withdraw_count = 0
            move_count = 0
            promo_abuse_count = 0
            crypto_count = 0
            loan_stress_points = 0

            for agent in agents:
                action = self._decide_action(agent, config, step, seed)
                step_actions[action] += 1
                archetype_action_breakdown[agent.archetype_id][action] += 1
                agent.last_action = action
                agent.memory.append({"step": step, "action": action})

                trust_drop = self._trust_decay(action, config)
                trust_losses.append(trust_drop)

                if action in ("withdraw_fast", "move_funds", "reduce_balance"):
                    withdraw_count += 1
                if action == "move_funds":
                    move_count += 1
                if action == "exploit_promo":
                    promo_abuse_count += 1
                if action == "buy_crypto":
                    crypto_count += 1
                if action in ("wait_and_see", "reduce_balance"):
                    loan_stress_points += 1

            for k, v in step_actions.items():
                final_actions[k] += v

            avg_balance = mean(BALANCE_BUCKET[a.balance_bucket] for a in agents)
            migration_funds = move_count * avg_balance * 0.35
            cumulative_migration += migration_funds
            cumulative_crypto += crypto_count * avg_balance * 0.12

            churn_proxy = withdraw_count / len(agents)
            promo_abuse_risk = promo_abuse_count / len(agents)
            trust_deterioration = mean(trust_losses)
            liquidity_stress = (
                churn_proxy * 0.6
                + score(config.country_context.get("social_panic_level", "medium")) * 0.2
                + score(config.company_context.get("withdrawal_delay_risk", "medium")) * 0.2
            )
            crypto_migration_proxy = crypto_count / len(agents)
            loan_demand_stress_proxy = (
                score(config.company_context.get("loan_rate_level", "medium")) * 0.5
                + score(config.country_context.get("labor_market_stress", "medium")) * 0.3
                + (loan_stress_points / len(agents)) * 0.2
            )

            timeline.append(
                {
                    "step": step,
                    "migration_funds": round(migration_funds, 2),
                    "retention_proxy": round(1 - churn_proxy, 4),
                    "churn_proxy": round(churn_proxy, 4),
                    "promo_abuse_risk_proxy": round(promo_abuse_risk, 4),
                    "trust_deterioration_proxy": round(trust_deterioration, 4),
                    "liquidity_stress_proxy": round(liquidity_stress, 4),
                    "crypto_migration_proxy": round(crypto_migration_proxy, 4),
                    "loan_demand_stress_proxy": round(loan_demand_stress_proxy, 4),
                    "action_distribution": dict(step_actions),
                }
            )

        final = timeline[-1]
        panic = self._panic_index(config, final_actions, archetype_action_breakdown, len(agents), final)
        result = {
            "run_at": datetime.now(timezone.utc).isoformat(),
            "seed": seed,
            "num_agents": len(agents),
            "num_steps": config.num_steps,
            "estimated_migration_of_funds": round(cumulative_migration, 2),
            "retention_proxy": final["retention_proxy"],
            "churn_proxy": final["churn_proxy"],
            "promo_abuse_risk_proxy": final["promo_abuse_risk_proxy"],
            "trust_deterioration_proxy": final["trust_deterioration_proxy"],
            "liquidity_stress_proxy": final["liquidity_stress_proxy"],
            "crypto_migration_proxy": round(cumulative_crypto / max(cumulative_migration + 1, 1), 4),
            "loan_demand_stress_proxy": final["loan_demand_stress_proxy"],
            "panic_index_score": panic["score"],
            "panic_index_label": panic["label"],
            "panic_index_components": panic["components"],
            "panic_index_main_driver": panic["main_driver"],
            "archetype_level_breakdown": {
                k: dict(v) for k, v in sorted(archetype_action_breakdown.items())
            },
            "timeline": timeline,
            "final_action_distribution": dict(final_actions),
        }
        result["funds_at_risk_breakdown"] = build_funds_at_risk_breakdown(
            result,
            source="stored",
            derived_from_v1=False,
            confidence_level="high",
        )
        return result

    def _panic_index(
        self,
        config: SimulationConfig,
        final_actions: Counter,
        archetype_action_breakdown: dict[str, Counter],
        num_agents: int,
        final: dict[str, Any],
    ) -> dict[str, Any]:
        total = max(1, num_agents)
        withdraw_fast_share = final_actions.get("withdraw_fast", 0) / total
        move_funds_share = final_actions.get("move_funds", 0) / total
        crypto_flight_score = min(
            1.0,
            final_actions.get("buy_crypto", 0) / total * 0.7
            + float(final.get("crypto_migration_proxy", 0.0)) * 0.3,
        )
        rumor_activation_score = min(
            1.0,
            score(config.country_context.get("political_noise", "medium")) * 0.6
            + score(config.country_context.get("social_panic_level", "medium")) * 0.4,
        )
        trust_deterioration = min(1.0, max(0.0, float(final.get("trust_deterioration_proxy", 0.0))))
        liquidity_stress = min(1.0, max(0.0, float(final.get("liquidity_stress_proxy", 0.0))))

        components = {
            "trust_deterioration": round(trust_deterioration, 4),
            "liquidity_stress": round(liquidity_stress, 4),
            "withdraw_fast_share": round(withdraw_fast_share, 4),
            "move_funds_share": round(move_funds_share, 4),
            "rumor_activation_score": round(rumor_activation_score, 4),
            "crypto_flight_score": round(crypto_flight_score, 4),
        }
        weights = {
            "trust_deterioration": 0.30,
            "liquidity_stress": 0.25,
            "withdraw_fast_share": 0.20,
            "move_funds_share": 0.10,
            "rumor_activation_score": 0.10,
            "crypto_flight_score": 0.05,
        }
        base_score = sum(components[k] * w for k, w in weights.items())

        critical_ids = {
            "low_trust_fast_withdrawer",
            "panic_rumormonger",
            "corralito_survivor",
            "classic_dolarizador",
        }
        critical_actions = 0
        total_actions = 0
        for archetype_id, actions in archetype_action_breakdown.items():
            total_actions += sum(actions.values())
            if archetype_id in critical_ids:
                critical_actions += sum(actions.values())
        critical_activation = (critical_actions / max(1, total_actions))
        archetype_multiplier = min(1.15, 1.0 + critical_activation * 0.10)

        weighted_contrib = {k: components[k] * weights[k] for k in components}
        main_driver = max(weighted_contrib.items(), key=lambda kv: kv[1])[0]

        score_0_1 = min(1.0, max(0.0, base_score * archetype_multiplier))
        score_0_100 = round(score_0_1 * 100, 1)
        if score_0_100 <= 25:
            label = "Normal"
        elif score_0_100 <= 50:
            label = "Alert"
        elif score_0_100 <= 75:
            label = "Stressed"
        else:
            label = "Panic"

        return {
            "score": score_0_100,
            "label": label,
            "main_driver": main_driver,
            "components": {
                **components,
                "archetype_multiplier": round(archetype_multiplier, 4),
                "critical_archetype_activation": round(critical_activation, 4),
                "weighted_contribution": {k: round(v, 4) for k, v in weighted_contrib.items()},
            },
        }

    def _aggregate_runs(self, runs: list[dict[str, Any]]) -> dict[str, Any]:
        if len(runs) == 1:
            return {"single_run": runs[0], "monte_carlo": None}

        def values(key: str) -> list[float]:
            return [float(r[key]) for r in runs]

        metrics = [
            "estimated_migration_of_funds",
            "retention_proxy",
            "churn_proxy",
            "promo_abuse_risk_proxy",
            "trust_deterioration_proxy",
            "liquidity_stress_proxy",
            "crypto_migration_proxy",
            "loan_demand_stress_proxy",
        ]

        monte = {}
        for m in metrics:
            arr = values(m)
            monte[m] = {
                "average": round(mean(arr), 4),
                "min": round(min(arr), 4),
                "max": round(max(arr), 4),
                "band": [round(min(arr), 4), round(max(arr), 4)],
            }

        return {
            "single_run": runs[0],
            "monte_carlo": {
                "runs": len(runs),
                "summary": monte,
            },
            "all_runs": runs,
        }

    def _build_agents(self, config: SimulationConfig, archetypes: list[Archetype], rng: random.Random) -> list[Agent]:
        archetype_map = {a.id: a for a in archetypes}
        pool = []
        for archetype_id, pct in config.archetype_mix.items():
            count = max(1, round(config.num_agents * pct / 100))
            pool.extend([archetype_id] * count)
        while len(pool) < config.num_agents:
            pool.append(next(iter(archetype_map.keys())))
        pool = pool[: config.num_agents]
        rng.shuffle(pool)

        agents: list[Agent] = []
        for i, archetype_id in enumerate(pool, start=1):
            a = archetype_map[archetype_id]
            agents.append(
                Agent(
                    id=f"agent_{i}",
                    archetype_id=a.id,
                    archetype_name=a.name,
                    balance_bucket=a.balance_bucket,
                    trust_level=a.trust_level,
                    interest_rate_sensitivity=a.interest_rate_sensitivity,
                    promotion_sensitivity=a.promotion_sensitivity,
                    crypto_affinity=a.crypto_affinity,
                    rumor_sensitivity=a.rumor_sensitivity,
                    risk_aversion=a.risk_aversion,
                    reaction_speed=a.reaction_speed,
                    liquidity_preference=a.liquidity_preference,
                    income_stability=a.income_stability,
                    macro_anxiety=a.macro_anxiety,
                    prompt_template=a.behavioral_prompt_template,
                    memory=[],
                    current_state={"balance": BALANCE_BUCKET[a.balance_bucket]},
                    last_action="stay",
                )
            )
        return agents

    def _decide_action(self, agent: Agent, config: SimulationConfig, step: int, seed: int) -> str:
        fallback = self._deterministic_action(agent, config, step)
        llm_probability = 0.12 if self.llm.enabled() else 0.0
        gate = random.Random(f"llm-{seed}-{agent.id}-{step}").random()
        if gate > llm_probability:
            return fallback

        prompt = render_template(
            agent.prompt_template,
            {
                "trust_level": agent.trust_level,
                "interest_rate_sensitivity": agent.interest_rate_sensitivity,
                "promotion_sensitivity": agent.promotion_sensitivity,
                "crypto_affinity": agent.crypto_affinity,
                "rumor_sensitivity": agent.rumor_sensitivity,
                "liquidity_preference": agent.liquidity_preference,
                "macro_anxiety": agent.macro_anxiety,
                "country_context": config.country_context,
                "company_context": config.company_context,
            },
        )
        return self.llm.agent_reasoning(prompt, fallback).get("action", fallback)

    def _deterministic_action(self, agent: Agent, config: SimulationConfig, step: int) -> str:
        stress = (
            score(config.country_context.get("social_panic_level", "medium")) * 0.25
            + score(config.country_context.get("usd_volatility", "medium")) * 0.20
            + score(config.company_context.get("withdrawal_delay_risk", "medium")) * 0.20
            + score(config.company_context.get("app_stability", "medium"), invert=True) * 0.20
            + score(agent.macro_anxiety) * 0.15
        )
        yield_gap = score(config.company_context.get("wallet_yield_new", "medium")) - score(
            config.company_context.get("competitor_yield", "medium")
        )
        promo_drive = score(config.company_context.get("cashback_percent", "medium")) * score(agent.promotion_sensitivity)

        if stress > 0.72 and score(agent.liquidity_preference) > 0.6:
            return "withdraw_fast"
        if yield_gap < -0.2 and score(agent.interest_rate_sensitivity) > 0.6:
            return "move_funds"
        if promo_drive > 0.55:
            return "exploit_promo"
        if score(agent.crypto_affinity) > 0.75 and score(config.country_context.get("usd_volatility", "medium")) > 0.7:
            return "buy_crypto"
        if score(config.company_context.get("app_stability", "medium"), invert=True) > 0.65:
            return "reduce_balance"
        if stress > 0.55:
            return "wait_and_see"
        if score(config.company_context.get("support_quality", "medium")) > 0.7 and yield_gap >= 0:
            return "increase_usage"
        return mock_action(config.seed, agent.archetype_id, step)

    def _trust_decay(self, action: str, config: SimulationConfig) -> float:
        base = score(config.country_context.get("social_panic_level", "medium")) * 0.25
        app_risk = score(config.company_context.get("app_stability", "medium"), invert=True) * 0.35
        rumor = score(config.country_context.get("political_noise", "medium")) * 0.15
        action_penalty = {
            "withdraw_fast": 0.30,
            "move_funds": 0.22,
            "reduce_balance": 0.18,
            "wait_and_see": 0.12,
            "stay": 0.05,
            "increase_usage": 0.03,
            "exploit_promo": 0.09,
            "buy_crypto": 0.13,
        }[action]
        return min(1.0, base + app_risk + rumor + action_penalty)


def score(label: str, invert: bool = False) -> float:
    value = QUAL_SCORE.get(label, 0.5)
    return 1 - value if invert else value
