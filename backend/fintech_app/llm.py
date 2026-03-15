from __future__ import annotations

import json
import os
import random
import re
from dataclasses import dataclass
from typing import Any

from openai import OpenAI

from .defaults import ACTION_SET, DEFAULT_COMPANY_CONTEXT, DEFAULT_COUNTRY_CONTEXT

QUAL = ["very_low", "low", "medium", "high", "very_high"]


@dataclass
class LLMConfig:
    provider: str = os.getenv("LLM_PROVIDER", "mock")
    base_url: str = os.getenv("LLM_BASE_URL", "")
    api_key: str = os.getenv("LLM_API_KEY", "")
    model: str = os.getenv("LLM_MODEL", "gpt-4o-mini")


class SafeJSON:
    @staticmethod
    def parse(text: str, fallback: dict[str, Any]) -> dict[str, Any]:
        if not text:
            return fallback
        text = text.strip()
        try:
            return json.loads(text)
        except json.JSONDecodeError:
            pass

        match = re.search(r"\{.*\}", text, re.S)
        if match:
            try:
                return json.loads(match.group(0))
            except json.JSONDecodeError:
                return fallback
        return fallback


class LLMClient:
    def __init__(self, cfg: LLMConfig | None = None):
        self.cfg = cfg or LLMConfig()
        self._client: OpenAI | None = None
        if self.cfg.provider != "mock" and self.cfg.api_key:
            kwargs: dict[str, Any] = {"api_key": self.cfg.api_key}
            if self.cfg.base_url:
                kwargs["base_url"] = self.cfg.base_url
            self._client = OpenAI(**kwargs)

    def enabled(self) -> bool:
        return self.cfg.provider != "mock" and self._client is not None

    def _chat_json(self, prompt: str, fallback: dict[str, Any]) -> dict[str, Any]:
        if not self.enabled():
            return fallback
        try:
            res = self._client.chat.completions.create(
                model=self.cfg.model,
                temperature=0.2,
                messages=[
                    {"role": "system", "content": "Return strict JSON only."},
                    {"role": "user", "content": prompt},
                ],
            )
            content = res.choices[0].message.content or ""
            return SafeJSON.parse(content, fallback)
        except Exception:
            return fallback

    def agent_reasoning(self, prompt: str, fallback_action: str) -> dict[str, Any]:
        fallback = {"action": fallback_action, "reason": "deterministic_fallback"}
        result = self._chat_json(prompt, fallback)
        action = result.get("action", fallback_action)
        if action not in ACTION_SET:
            result["action"] = fallback_action
        return result

    def translate_scenario(self, text: str) -> dict[str, Any]:
        fallback = {
            "country_context": DEFAULT_COUNTRY_CONTEXT,
            "company_context": DEFAULT_COMPANY_CONTEXT,
            "notes": ["Mock translation generated."],
        }
        prompt = (
            "Translate this future scenario into qualitative Argentina fintech context variables. "
            "Use only very_low/low/medium/high/very_high."
            f"\nScenario: {text}\n"
            "Return JSON with keys: country_context, company_context, notes."
        )
        result = self._chat_json(prompt, fallback)
        return normalize_context_payload(result, fallback)

    def impact_translate(self, text: str) -> dict[str, Any]:
        fallback = {
            "transmission_channels": ["global_risk_aversion", "fx_pressure"],
            "country_context": {
                **DEFAULT_COUNTRY_CONTEXT,
                "usd_volatility": "very_high",
                "country_risk_pressure": "high",
            },
            "company_context": DEFAULT_COMPANY_CONTEXT,
            "explanation": "Mock impact translation using conservative assumptions.",
        }
        prompt = (
            "Map this global event to Argentina fintech impact. "
            "Identify channels then map into qualitative variables only.\n"
            f"Global event: {text}\n"
            "Return JSON keys: transmission_channels, country_context, company_context, explanation."
        )
        result = self._chat_json(prompt, fallback)
        return normalize_context_payload(result, fallback)

    def strategy_recommend(self, payload: dict[str, Any]) -> dict[str, Any]:
        fallback = {
            "tactical_actions": [
                {"title": "Defensive yield tier", "why": "Retain rate seekers with cost cap."},
                {"title": "Trust recovery runbook", "why": "Contain rumor-driven withdrawals quickly."},
                {"title": "Promo abuse guardrails", "why": "Protect CAC efficiency during campaigns."},
            ],
            "risk_mitigation": ["raise liquidity buffers", "tighten anomaly monitoring"],
        }
        prompt = (
            "Given simulation outputs, propose realistic tactical fintech actions for Argentina."
            f"\nInput JSON: {json.dumps(payload, ensure_ascii=False)}"
            "\nReturn strict JSON with tactical_actions and risk_mitigation."
        )
        return self._chat_json(prompt, fallback)

    def innovation_recommend(self, payload: dict[str, Any]) -> dict[str, Any]:
        fallback = {
            "innovation_lab": [
                {
                    "idea": "Adaptive crisis wallet mode",
                    "inspiration": "Brazilian neobank incident mode",
                    "fit": "Shifts UX and limits dynamically during panic events.",
                },
                {
                    "idea": "Community yield pool",
                    "inspiration": "DeFi pooled treasury mechanics",
                    "fit": "Improves trust through transparent liquidity buckets.",
                },
                {
                    "idea": "Geo-merchant liquidity rewards",
                    "inspiration": "Asian superapp growth loops",
                    "fit": "Incentivizes daily transactions while smoothing outflows.",
                },
            ]
        }
        prompt = (
            "Generate 3-6 disruptive yet plausible fintech ideas for Argentina from the simulation data. "
            "Include global inspiration source and local fit."
            f"\nInput JSON: {json.dumps(payload, ensure_ascii=False)}"
            "\nReturn strict JSON with key innovation_lab (array)."
        )
        return self._chat_json(prompt, fallback)


def clamp_qual(v: str) -> str:
    return v if v in QUAL else "medium"


def normalize_context_payload(result: dict[str, Any], fallback: dict[str, Any]) -> dict[str, Any]:
    out = dict(result or {})
    if "country_context" not in out:
        out["country_context"] = fallback["country_context"]
    if "company_context" not in out:
        out["company_context"] = fallback["company_context"]

    out["country_context"] = {
        k: clamp_qual(str(v)) for k, v in out["country_context"].items() if k in DEFAULT_COUNTRY_CONTEXT
    }
    for k, default_v in DEFAULT_COUNTRY_CONTEXT.items():
        out["country_context"].setdefault(k, default_v)

    out["company_context"] = {
        k: clamp_qual(str(v)) for k, v in out["company_context"].items() if k in DEFAULT_COMPANY_CONTEXT
    }
    for k, default_v in DEFAULT_COMPANY_CONTEXT.items():
        out["company_context"].setdefault(k, default_v)

    return out


def render_template(template: str, variables: dict[str, Any]) -> str:
    rendered = template
    for key, value in variables.items():
        rendered = rendered.replace("{{" + key + "}}", str(value))
    return rendered


def mock_action(seed: int, archetype_id: str, step: int) -> str:
    rng = random.Random(f"{seed}-{archetype_id}-{step}")
    return ACTION_SET[rng.randint(0, len(ACTION_SET) - 1)]
