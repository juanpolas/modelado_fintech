from __future__ import annotations

from dataclasses import dataclass, field
from datetime import datetime
from typing import Any

QUAL_VALUES = {"very_low", "low", "medium", "high", "very_high"}
BALANCE_BUCKETS = {"low", "mid", "high"}


@dataclass
class Archetype:
    id: str
    name: str
    description: str
    trust_level: str
    interest_rate_sensitivity: str
    promotion_sensitivity: str
    crypto_affinity: str
    rumor_sensitivity: str
    reaction_speed: str
    balance_bucket: str
    liquidity_preference: str
    risk_aversion: str
    income_stability: str
    macro_anxiety: str
    behavioral_prompt_template: str
    reaction_patterns: dict[str, str] = field(default_factory=dict)

    @classmethod
    def from_dict(cls, raw: dict[str, Any]) -> "Archetype":
        item = cls(**raw)
        item.validate()
        return item

    def validate(self) -> None:
        for name in (
            "trust_level",
            "interest_rate_sensitivity",
            "promotion_sensitivity",
            "crypto_affinity",
            "rumor_sensitivity",
            "reaction_speed",
            "liquidity_preference",
            "risk_aversion",
            "income_stability",
            "macro_anxiety",
        ):
            if getattr(self, name) not in QUAL_VALUES:
                raise ValueError(f"{name} must be one of {sorted(QUAL_VALUES)}")
        if self.balance_bucket not in BALANCE_BUCKETS:
            raise ValueError("balance_bucket must be low|mid|high")


@dataclass
class SimulationConfig:
    scenario_id: str | None
    scenario_name: str
    num_agents: int
    num_steps: int
    seed: int
    monte_carlo_runs: int
    archetype_mix: dict[str, float]
    country_context: dict[str, str]
    company_context: dict[str, str]

    @classmethod
    def from_dict(cls, raw: dict[str, Any]) -> "SimulationConfig":
        cfg = cls(
            scenario_id=raw.get("scenario_id"),
            scenario_name=raw.get("scenario_name", "custom"),
            num_agents=int(raw.get("num_agents", 300)),
            num_steps=int(raw.get("num_steps", 12)),
            seed=int(raw.get("seed", 42)),
            monte_carlo_runs=int(raw.get("monte_carlo_runs", 1)),
            archetype_mix={k: float(v) for k, v in (raw.get("archetype_mix") or {}).items()},
            country_context=dict(raw.get("country_context") or {}),
            company_context=dict(raw.get("company_context") or {}),
        )
        cfg.validate()
        return cfg

    def validate(self) -> None:
        if not (10 <= self.num_agents <= 5000):
            raise ValueError("num_agents must be between 10 and 5000")
        if not (1 <= self.num_steps <= 120):
            raise ValueError("num_steps must be between 1 and 120")
        if not (1 <= self.monte_carlo_runs <= 50):
            raise ValueError("monte_carlo_runs must be between 1 and 50")
        total = sum(self.archetype_mix.values())
        if abs(total - 100.0) > 0.01:
            raise ValueError(f"Archetype mix must total 100. Current total: {total}")


@dataclass
class SimulationRun:
    id: str
    created_at: datetime
    config: dict[str, Any]
    outputs: dict[str, Any]
    tactical_recommendations: dict[str, Any]
    disruptive_recommendations: dict[str, Any]
    generated_insights: dict[str, Any]

    def to_dict(self) -> dict[str, Any]:
        return {
            "id": self.id,
            "created_at": self.created_at.isoformat(),
            "config": self.config,
            "outputs": self.outputs,
            "tactical_recommendations": self.tactical_recommendations,
            "disruptive_recommendations": self.disruptive_recommendations,
            "generated_insights": self.generated_insights,
        }
