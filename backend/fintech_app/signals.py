from __future__ import annotations

import os
import re
from collections import Counter
from datetime import datetime, timezone
from typing import Any

from .defaults import DEFAULT_COMPANY_CONTEXT, DEFAULT_COUNTRY_CONTEXT

QUAL_TO_SCORE = {"very_low": 1, "low": 2, "medium": 3, "high": 4, "very_high": 5}
SCORE_TO_QUAL = {1: "very_low", 2: "low", 3: "medium", 4: "high", 5: "very_high"}

DEFAULT_X_QUERY = os.getenv(
    "X_QUERY_DEFAULT",
    '"dólar blue" OR devaluación OR inflación OR bancos OR fintech OR "Mercado Pago" OR "Ualá" OR "Naranja X" OR corralito OR stablecoins OR bitcoin OR cashback OR promos OR BCRA lang:es -is:retweet',
)

TWITTER_PRESETS = [
    "dólar blue",
    "devaluación",
    "inflación",
    "bancos",
    "fintech",
    "Ualá",
    "Mercado Pago",
    "Naranja X",
    "corralito",
    "retiro de fondos",
    "stablecoins",
    "bitcoin argentina",
    "cashback",
    "promos",
    "BCRA",
]

NARRATIVE_RULES: dict[str, list[str]] = {
    "rumor": ["rumor", "dicen", "supuesto", "trascendió", "se comenta"],
    "panic": ["pánico", "corrida", "retirar", "quiebra", "colapso", "corralito"],
    "trust_recovery": ["mejora", "estabilidad", "recupera confianza", "tranquilidad"],
    "promo_excitement": ["promo", "cashback", "descuento", "2x1", "beneficio"],
    "dollarization_anxiety": ["dólar", "devaluación", "blue", "cepo", "tipo de cambio"],
    "crypto_migration": ["bitcoin", "crypto", "stablecoin", "usdt", "usdc"],
    "anti_bank_sentiment": ["banco no", "anti banco", "no confío en bancos", "bancos"],
    "fintech_loyalty": ["me quedo", "confío en", "mi billetera", "fintech"],
    "macro_anxiety": ["inflación", "recesión", "desempleo", "riesgo país"],
    "political_noise": ["elecciones", "gobierno", "congreso", "presidencia", "política"],
}

NEWS_EVENT_RULES: dict[str, list[str]] = {
    "inflation": ["inflación", "ipc", "precios"],
    "fx": ["dólar", "devaluación", "tipo de cambio", "cepo"],
    "bcra_measures": ["bcra", "banco central", "tasa", "encajes"],
    "banking_stress": ["bancos", "liquidez", "corrida", "retiro de fondos", "corralito"],
    "fintech_regulation": ["fintech", "regulación", "normativa", "cnv"],
    "elections": ["elecciones", "ballotage", "voto"],
    "political_instability": ["crisis política", "renuncia", "inestabilidad"],
    "labor_unrest": ["paro", "huelga", "conflicto laboral"],
    "unemployment": ["desempleo", "empleo"],
    "taxes": ["impuesto", "tributaria", "retenciones"],
    "crypto_regulation": ["cripto", "stablecoin", "bitcoin", "regulación cripto"],
    "energy_shock": ["energía", "gas", "petróleo", "tarifa"],
    "confidence_issue": ["confianza", "solvencia", "default"],
}


def utc_now() -> str:
    return datetime.now(timezone.utc).isoformat()


def normalize_text(value: str) -> str:
    return re.sub(r"\s+", " ", (value or "").strip().lower())


def classify_narratives(texts: list[str]) -> dict[str, int]:
    counts: Counter[str] = Counter()
    for text in texts:
        n = normalize_text(text)
        for narrative, keywords in NARRATIVE_RULES.items():
            if any(k in n for k in keywords):
                counts[narrative] += 1
    return dict(counts)


def classify_news_event(text: str) -> str:
    n = normalize_text(text)
    for event_type, keys in NEWS_EVENT_RULES.items():
        if any(k in n for k in keys):
            return event_type
    return "general_macro"


def severity_from_counts(total: int, panic_hits: int, rumor_hits: int) -> str:
    score = 1
    if total > 15:
        score += 1
    if total > 30:
        score += 1
    if panic_hits > 5:
        score += 1
    if rumor_hits > 5:
        score += 1
    return SCORE_TO_QUAL[min(5, score)]


def impact_vector_from_narratives(narratives: dict[str, int], base: dict[str, str] | None = None) -> dict[str, str]:
    out = dict(base or DEFAULT_COUNTRY_CONTEXT)

    def lift(key: str, delta: int):
        s = QUAL_TO_SCORE.get(out.get(key, "medium"), 3)
        out[key] = SCORE_TO_QUAL[max(1, min(5, s + delta))]

    if narratives.get("panic", 0) > 0 or narratives.get("rumor", 0) > 2:
        lift("social_panic_level", 1)
        lift("bank_trust_index", -1)
        lift("liquidity_preference_shift", 1)

    if narratives.get("dollarization_anxiety", 0) > 0:
        lift("usd_volatility", 1)
        lift("inflation_expectation", 1)

    if narratives.get("crypto_migration", 0) > 0:
        lift("crypto_volatility", 1)

    if narratives.get("macro_anxiety", 0) > 0:
        lift("consumer_confidence", -1)
        lift("policy_uncertainty", 1)

    if narratives.get("political_noise", 0) > 0:
        lift("political_noise", 1)

    return out


def company_impact_from_narratives(narratives: dict[str, int], base: dict[str, str] | None = None) -> dict[str, str]:
    out = dict(base or DEFAULT_COMPANY_CONTEXT)

    def lift(key: str, delta: int):
        s = QUAL_TO_SCORE.get(out.get(key, "medium"), 3)
        out[key] = SCORE_TO_QUAL[max(1, min(5, s + delta))]

    if narratives.get("panic", 0) > 0:
        lift("withdrawal_delay_risk", 1)
        lift("trust_baseline", -1)

    if narratives.get("promo_excitement", 0) > 0:
        lift("cashback_percent", 1)

    if narratives.get("trust_recovery", 0) > 0:
        lift("trust_baseline", 1)
        lift("support_quality", 1)

    if narratives.get("crypto_migration", 0) > 0:
        lift("wallet_yield_new", -1)

    return out


def affected_archetypes_from_narratives(narratives: dict[str, int]) -> list[str]:
    affected = set()
    if narratives.get("promo_excitement", 0):
        affected.add("promo_hunter")
    if narratives.get("crypto_migration", 0):
        affected.add("crypto_opportunist")
    if narratives.get("panic", 0) or narratives.get("rumor", 0):
        affected.add("low_trust_fast_withdrawer")
        affected.add("anti_bank_user")
    if narratives.get("dollarization_anxiety", 0):
        affected.add("inflation_defensive_saver")
    if narratives.get("trust_recovery", 0):
        affected.add("conservative_salaried")
    if not affected:
        affected.add("everyday_transactional")
    return sorted(affected)


def combine_vectors(vectors: list[dict[str, str]]) -> dict[str, str]:
    if not vectors:
        return {}
    keys = set().union(*vectors)
    out: dict[str, str] = {}
    for key in keys:
        scores = [QUAL_TO_SCORE.get(v.get(key, "medium"), 3) for v in vectors]
        out[key] = SCORE_TO_QUAL[round(sum(scores) / len(scores))]
    return out


def dedupe_by_key(items: list[dict[str, Any]], key: str) -> list[dict[str, Any]]:
    seen = set()
    out = []
    for item in items:
        v = normalize_text(str(item.get(key, "")))
        if not v or v in seen:
            continue
        seen.add(v)
        out.append(item)
    return out
