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
        fallback = heuristic_tactical_recommendations(payload)
        prompt = (
            "Given simulation outputs, propose at least 10 realistic tactical fintech actions for Argentina."
            " Keep them practical and tied to risk/retention/liquidity/trust/pricing."
            f"\nInput JSON: {json.dumps(payload, ensure_ascii=False)}"
            "\nReturn strict JSON with keys:"
            "\n- tactical_actions: array of objects {title, why, category}"
            "\n- risk_mitigation: array of strings."
        )
        out = self._chat_json(prompt, fallback)
        return normalize_tactical_output(out, payload)

    def innovation_recommend(self, payload: dict[str, Any]) -> dict[str, Any]:
        fallback = heuristic_innovation_recommendations(payload)
        prompt = (
            "Generate at least 10 disruptive yet plausible fintech ideas for Argentina from simulation data. "
            "Use inspirations from global fintech ecosystems and keep ideas implementable."
            f"\nInput JSON: {json.dumps(payload, ensure_ascii=False)}"
            "\nReturn strict JSON with key innovation_lab: array of objects {idea, inspiration, fit, disruptiveness}."
        )
        out = self._chat_json(prompt, fallback)
        return normalize_innovation_output(out, payload)

    def executive_summary(self, payload: dict[str, Any], lang: str = "es") -> str:
        fallback = heuristic_executive_summary(payload, lang=lang)
        prompt = (
            "Write an executive simulation summary in plain language."
            f" Language: {'Spanish' if lang == 'es' else 'English'}."
            " Include: scenario interpretation, key risks, agent behavior dynamics, and immediate priorities."
            f"\nInput JSON: {json.dumps(payload, ensure_ascii=False)}"
            "\nReturn strict JSON with key summary."
        )
        out = self._chat_json(prompt, {"summary": fallback})
        summary = str(out.get("summary", "")).strip()
        return summary if summary else fallback

    def review_context_profile(self, payload: dict[str, Any]) -> dict[str, Any]:
        profile = dict(payload.get("context_profile") or {})
        title = str(profile.get("title") or "Nuevo contexto")
        desc = str(profile.get("description") or "")
        country = dict(profile.get("country_context") or DEFAULT_COUNTRY_CONTEXT)
        fallback = {
            "title": title,
            "description": desc or "Contexto revisado automáticamente.",
            "country_context": normalize_country_context(country),
            "reasoning": [
                "Se revisó consistencia entre presión macro, confianza y comportamiento.",
                "Se mantuvieron valores cualitativos compatibles con simulación.",
            ],
            "needs_update": True,
        }
        prompt = (
            "Review this Argentina context profile and propose improvements if needed."
            " Keep only qualitative values: very_low/low/medium/high/very_high."
            f"\nInput JSON: {json.dumps(profile, ensure_ascii=False)}"
            "\nReturn strict JSON keys: title, description, country_context, reasoning (array), needs_update (bool)."
        )
        out = self._chat_json(prompt, fallback)
        return {
            "title": str(out.get("title", fallback["title"])),
            "description": str(out.get("description", fallback["description"])),
            "country_context": normalize_country_context(out.get("country_context") or fallback["country_context"]),
            "reasoning": list(out.get("reasoning", fallback["reasoning"]))[:6],
            "needs_update": bool(out.get("needs_update", True)),
        }

    def review_scenario(self, payload: dict[str, Any]) -> dict[str, Any]:
        scenario = dict(payload.get("scenario") or {})
        fallback = {
            "name": str(scenario.get("name") or "scenario"),
            "description": str(scenario.get("description") or "Scenario updated by AI review."),
            "default_country_context": normalize_country_context(
                scenario.get("default_country_context") or DEFAULT_COUNTRY_CONTEXT
            ),
            "default_company_context": normalize_company_context(
                scenario.get("default_company_context") or DEFAULT_COMPANY_CONTEXT
            ),
            "notes": str(scenario.get("notes") or "Revisión automática para mayor coherencia macro-producto."),
            "needs_update": True,
        }
        prompt = (
            "Review this fintech scenario and improve consistency between country and company context."
            " Use only qualitative values: very_low/low/medium/high/very_high."
            f"\nInput JSON: {json.dumps(scenario, ensure_ascii=False)}"
            "\nReturn strict JSON keys: name, description, default_country_context, default_company_context, notes, needs_update."
        )
        out = self._chat_json(prompt, fallback)
        return {
            "name": str(out.get("name", fallback["name"])),
            "description": str(out.get("description", fallback["description"])),
            "default_country_context": normalize_country_context(
                out.get("default_country_context") or fallback["default_country_context"]
            ),
            "default_company_context": normalize_company_context(
                out.get("default_company_context") or fallback["default_company_context"]
            ),
            "notes": str(out.get("notes", fallback["notes"])),
            "needs_update": bool(out.get("needs_update", True)),
        }

    def generate_hypothetical_scenario(self, payload: dict[str, Any]) -> dict[str, Any]:
        text = str(payload.get("text", "")).strip()
        lang = str(payload.get("lang", "es")).strip().lower()
        fallback_name = (
            f"Hipótesis: {text[:42]}{'...' if len(text) > 42 else ''}"
            if text
            else "Nuevo escenario hipotético"
        )
        fallback = {
            "name": fallback_name,
            "description": "Escenario hipotético generado para probar impacto en comportamiento de usuarios.",
            "default_country_context": normalize_country_context(DEFAULT_COUNTRY_CONTEXT),
            "default_company_context": normalize_company_context(DEFAULT_COMPANY_CONTEXT),
            "notes": "Generado automáticamente desde descripción narrativa.",
        }
        prompt = (
            "Generate a hypothetical Argentina fintech scenario from free text."
            " Return a practical scenario with concise name, description, and qualitative country/company context."
            f" Language: {'Spanish' if lang == 'es' else 'English'}."
            f"\nUser text: {text}"
            "\nReturn strict JSON keys: name, description, default_country_context, default_company_context, notes."
            "\nUse only very_low/low/medium/high/very_high for context values."
        )
        out = self._chat_json(prompt, fallback)
        return {
            "name": str(out.get("name", fallback["name"])),
            "description": str(out.get("description", fallback["description"])),
            "default_country_context": normalize_country_context(
                out.get("default_country_context") or fallback["default_country_context"]
            ),
            "default_company_context": normalize_company_context(
                out.get("default_company_context") or fallback["default_company_context"]
            ),
            "notes": str(out.get("notes", fallback["notes"])),
        }


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


def _extract_single_run(payload: dict[str, Any]) -> dict[str, Any]:
    sim = payload.get("simulation_results", {}) if isinstance(payload, dict) else {}
    if isinstance(sim, dict):
        if "single_run" in sim and isinstance(sim["single_run"], dict):
            return sim["single_run"]
        return sim
    return {}


def normalize_country_context(country: dict[str, Any]) -> dict[str, str]:
    cleaned = {}
    for k, default_v in DEFAULT_COUNTRY_CONTEXT.items():
        cleaned[k] = clamp_qual(str((country or {}).get(k, default_v)))
    return cleaned


def normalize_company_context(company: dict[str, Any]) -> dict[str, str]:
    cleaned = {}
    for k, default_v in DEFAULT_COMPANY_CONTEXT.items():
        cleaned[k] = clamp_qual(str((company or {}).get(k, default_v)))
    return cleaned


def _metric(single: dict[str, Any], key: str, default: float = 0.0) -> float:
    try:
        return float(single.get(key, default))
    except Exception:
        return default


def _top_actions(single: dict[str, Any]) -> list[tuple[str, int]]:
    dist = single.get("final_action_distribution", {})
    if not isinstance(dist, dict):
        return []
    pairs: list[tuple[str, int]] = []
    for k, v in dist.items():
        try:
            pairs.append((str(k), int(v)))
        except Exception:
            continue
    return sorted(pairs, key=lambda kv: kv[1], reverse=True)


def heuristic_tactical_recommendations(payload: dict[str, Any]) -> dict[str, Any]:
    single = _extract_single_run(payload)
    churn = _metric(single, "churn_proxy")
    liquidity = _metric(single, "liquidity_stress_proxy")
    promo_risk = _metric(single, "promo_abuse_risk_proxy")
    trust = _metric(single, "trust_deterioration_proxy")
    panic = _metric(single, "panic_index_score") / 100.0
    top_actions = _top_actions(single)
    top_action = top_actions[0][0] if top_actions else "stay"

    actions = [
        {
            "title": "Capa de comunicación de liquidez en tiempo real",
            "why": f"El estrés de liquidez ({liquidity:.2f}) requiere mensajes in-app y estado de transferencias en vivo para frenar retiros por rumor.",
            "category": "liquidity",
        },
        {
            "title": "Límite dinámico para retiros de alto riesgo",
            "why": "Aplicar fricción progresiva por comportamiento anómalo reduce salidas abruptas sin bloquear usuarios sanos.",
            "category": "risk_mitigation",
        },
        {
            "title": "Paquete de retención por segmento sensible a tasa",
            "why": "Ajustar beneficios por arquetipo mejora permanencia sin sobreremar costo financiero.",
            "category": "retention",
        },
        {
            "title": "Motor anti-abuso para promociones",
            "why": f"Riesgo de abuso promo ({promo_risk:.2f}) sugiere límites por frecuencia, monto y huella de dispositivo.",
            "category": "pricing",
        },
        {
            "title": "Runbook de crisis de confianza",
            "why": f"Deterioro de confianza ({trust:.2f}) exige protocolo de incidentes, vocería y SLA visibles.",
            "category": "trust_recovery",
        },
        {
            "title": "Oferta de estabilidad para balances ociosos",
            "why": "Crear producto defensivo de corto plazo evita migración a competidores en episodios de volatilidad.",
            "category": "retention",
        },
        {
            "title": "Detección temprana de contagio comportamental",
            "why": f"Con Panic Index {panic*100:.1f}, activar alertas por clúster de acciones {top_action} para intervenir antes del pico.",
            "category": "risk_mitigation",
        },
        {
            "title": "Soporte prioritario para segmentos de alto retiro",
            "why": "Canal dedicado reduce incertidumbre y corta cadenas de pánico en redes.",
            "category": "trust_recovery",
        },
        {
            "title": "Estrategia de pricing anticíclica",
            "why": "Recalibrar rendimiento/cashback por fase del ciclo evita pérdida de margen durante estrés.",
            "category": "pricing",
        },
        {
            "title": "Comité semanal de riesgo de comportamiento",
            "why": "Unificar producto, riesgo y data permite responder más rápido a cambios de narrativa externa.",
            "category": "risk_mitigation",
        },
    ]
    return {
        "tactical_actions": actions,
        "risk_mitigation": [
            "liquidity_buffer_uplift",
            "real_time_rumor_monitoring",
            "segmented_withdrawal_controls",
        ],
        "source": "heuristic",
    }


def heuristic_innovation_recommendations(payload: dict[str, Any]) -> dict[str, Any]:
    single = _extract_single_run(payload)
    panic = _metric(single, "panic_index_score")
    liquidity = _metric(single, "liquidity_stress_proxy")
    promo_risk = _metric(single, "promo_abuse_risk_proxy")

    ideas = [
        {
            "idea": "Modo Crisis Transparente",
            "inspiration": "Neobancos brasileños con status center operativo",
            "fit": f"Con Panic Index {panic:.1f}, mostrar liquidez y tiempos reales reduce retiro preventivo.",
            "disruptiveness": "medium",
        },
        {
            "idea": "Bóveda Dinámica de Estabilidad",
            "inspiration": "Savings vaults de superapps asiáticas",
            "fit": "Permite mover saldo entre liquidez y rendimiento según volatilidad sin fricción.",
            "disruptiveness": "high",
        },
        {
            "idea": "Recompensas Antipánico por Permanencia",
            "inspiration": "Programas de loyalty gamificado en SEA",
            "fit": f"Compensa saldos estables en episodios de estrés ({liquidity:.2f}) para bajar churn.",
            "disruptiveness": "high",
        },
        {
            "idea": "Cobertura ARS→USDt en 1 clic con guardrails",
            "inspiration": "Ramps cripto reguladas de mercados emergentes",
            "fit": "Canaliza demanda de cobertura dentro del producto en vez de perder al usuario.",
            "disruptiveness": "high",
        },
        {
            "idea": "Score de Confianza Comunitaria",
            "inspiration": "Modelos de reputación Web3",
            "fit": "Priorización de límites y soporte según estabilidad histórica de comportamiento.",
            "disruptiveness": "medium",
        },
        {
            "idea": "Transferencias con Confirmación Escalonada Inteligente",
            "inspiration": "Fraud/risk orchestration en pagos globales",
            "fit": "Sube fricción sólo en segmentos de alto riesgo sin penalizar al resto.",
            "disruptiveness": "medium",
        },
        {
            "idea": "Marketplace de Liquidez entre Usuarios",
            "inspiration": "Pool lending P2P adaptado a fintech",
            "fit": "Reduce tensión de salidas masivas con incentivos internos de fondeo temporal.",
            "disruptiveness": "high",
        },
        {
            "idea": "Asistente de Decisiones Macro Personalizado",
            "inspiration": "Copilots financieros en US/Asia",
            "fit": "Traduce señales macro a recomendaciones accionables para cada arquetipo.",
            "disruptiveness": "medium",
        },
        {
            "idea": "Promos de Valor Neto en lugar de cashback lineal",
            "inspiration": "Reward engines contextuales de e-commerce",
            "fit": f"Disminuye abuso promo ({promo_risk:.2f}) premiando comportamiento sano sostenido.",
            "disruptiveness": "medium",
        },
        {
            "idea": "Cuenta de Resiliencia con reglas automáticas",
            "inspiration": "Automation-first banking",
            "fit": "Automatiza movimientos defensivos por umbrales de riesgo y evita pánico reactivo.",
            "disruptiveness": "high",
        },
    ]
    return {"innovation_lab": ideas, "source": "heuristic"}


def normalize_tactical_output(out: dict[str, Any], payload: dict[str, Any]) -> dict[str, Any]:
    base = heuristic_tactical_recommendations(payload)
    raw = out.get("tactical_actions", []) if isinstance(out, dict) else []
    items: list[dict[str, str]] = []
    for r in raw:
        if not isinstance(r, dict):
            continue
        title = str(r.get("title", "")).strip()
        why = str(r.get("why", "")).strip()
        category = str(r.get("category", "")).strip() or "risk_mitigation"
        if title and why:
            items.append({"title": title, "why": why, "category": category})
    seen = {i["title"].lower() for i in items}
    for extra in base["tactical_actions"]:
        if len(items) >= 10:
            break
        key = str(extra.get("title", "")).lower()
        if key and key not in seen:
            items.append(extra)
            seen.add(key)

    if len(items) > 10:
        items = items[:10]
    return {
        "tactical_actions": items,
        "risk_mitigation": out.get("risk_mitigation", base.get("risk_mitigation", [])),
        "source": "llm" if items and isinstance(out, dict) and out.get("tactical_actions") else base.get("source", "heuristic"),
    }


def normalize_innovation_output(out: dict[str, Any], payload: dict[str, Any]) -> dict[str, Any]:
    base = heuristic_innovation_recommendations(payload)
    raw = out.get("innovation_lab", []) if isinstance(out, dict) else []
    items: list[dict[str, str]] = []
    for r in raw:
        if not isinstance(r, dict):
            continue
        idea = str(r.get("idea", "")).strip()
        inspiration = str(r.get("inspiration", "")).strip()
        fit = str(r.get("fit", "")).strip()
        disruptiveness = str(r.get("disruptiveness", "")).strip() or "medium"
        if idea and fit:
            items.append(
                {
                    "idea": idea,
                    "inspiration": inspiration or "global fintech patterns",
                    "fit": fit,
                    "disruptiveness": disruptiveness,
                }
            )
    seen = {i["idea"].lower() for i in items}
    for extra in base["innovation_lab"]:
        if len(items) >= 10:
            break
        key = str(extra.get("idea", "")).lower()
        if key and key not in seen:
            items.append(extra)
            seen.add(key)

    if len(items) > 10:
        items = items[:10]
    return {"innovation_lab": items, "source": "llm" if items and raw else base.get("source", "heuristic")}


def heuristic_executive_summary(payload: dict[str, Any], lang: str = "es") -> str:
    single = _extract_single_run(payload)
    churn = _metric(single, "churn_proxy")
    liquidity = _metric(single, "liquidity_stress_proxy")
    trust = _metric(single, "trust_deterioration_proxy")
    panic = _metric(single, "panic_index_score")
    top_actions = _top_actions(single)
    action_txt = ", ".join(a for a, _ in top_actions[:3]) if top_actions else "n/a"
    if lang == "es":
        return (
            f"La simulación muestra un riesgo agregado relevante (Panic Index {panic:.1f}/100), "
            f"con churn {churn*100:.1f}%, estrés de liquidez {liquidity*100:.1f}% y deterioro de confianza {trust*100:.1f}%. "
            f"Las acciones dominantes fueron: {action_txt}. "
            "La prioridad ejecutiva es estabilizar liquidez percibida, contener narrativas de pánico y proteger retención en segmentos sensibles."
        )
    return (
        f"The simulation shows meaningful aggregate risk (Panic Index {panic:.1f}/100), "
        f"with churn at {churn*100:.1f}%, liquidity stress at {liquidity*100:.1f}%, and trust deterioration at {trust*100:.1f}%. "
        f"Dominant actions were: {action_txt}. "
        "Executive priority should be to stabilize perceived liquidity, contain panic narratives, and protect retention in sensitive segments."
    )
