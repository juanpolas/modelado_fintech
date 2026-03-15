from __future__ import annotations

import os
from collections import defaultdict
from typing import Any


ACTION_TO_DESTINATION = {
    "withdraw_fast": "cash_withdrawal",
    "move_funds": "competitor_fintech",
    "buy_crypto": "crypto_stablecoins",
    "reduce_balance": "reduced_balance_retained",
    "exploit_promo": "internal_usage",
    "increase_usage": "internal_usage",
    "stay": "idle_balance",
    "wait_and_see": "idle_balance",
}

DESTINATION_TO_MIGRATION_TYPE = {
    "cash_withdrawal": "liquidity_outflow",
    "competitor_fintech": "liquidity_outflow",
    "bank_transfer": "liquidity_outflow",
    "crypto_stablecoins": "asset_migration",
    "crypto_btc": "asset_migration",
    "reduced_balance_retained": "behavior_shift",
    "internal_usage": "retained_activity",
    "idle_balance": "retained_activity",
}

ACTION_RISK_WEIGHT = {
    "withdraw_fast": 1.00,
    "move_funds": 1.00,
    "buy_crypto": 0.90,
    "reduce_balance": 0.60,
    "exploit_promo": 0.35,
    "increase_usage": 0.20,
    "wait_and_see": 0.15,
    "stay": 0.05,
}

EXIT_ACTIONS = {"withdraw_fast", "move_funds", "buy_crypto"}
METHODOLOGY_VERSION = "far_v1.0"


def _round(v: float) -> float:
    return round(float(v), 2)


def _pct(part: float, total: float) -> float:
    if total <= 0:
        return 0.0
    return round((part / total) * 100, 2)


def _build_sankey(by_archetype: list[dict[str, Any]], by_action: list[dict[str, Any]]) -> dict[str, Any]:
    nodes: list[dict[str, str]] = []
    node_index: dict[str, int] = {}
    links: list[dict[str, Any]] = []

    def ensure_node(name: str, node_type: str) -> int:
        if name in node_index:
            return node_index[name]
        idx = len(nodes)
        nodes.append({"name": name, "type": node_type})
        node_index[name] = idx
        return idx

    # archetype -> action
    for arch in by_archetype:
        a_name = arch.get("archetype_id", "unknown_archetype")
        s = ensure_node(a_name, "archetype")
        for top in arch.get("top_actions", []):
            action = top.get("action", "unknown_action")
            value = float(top.get("amount", 0.0) or 0.0)
            if value <= 0:
                continue
            t = ensure_node(action, "action")
            links.append({"source": s, "target": t, "value": _round(value)})

    # action -> destination
    for action_item in by_action:
        action = action_item.get("action", "unknown_action")
        src = ensure_node(action, "action")
        for d in action_item.get("primary_destinations", []):
            dest = d.get("destination", "other_destination")
            value = float(d.get("amount", 0.0) or 0.0)
            if value <= 0:
                continue
            tgt = ensure_node(dest, "destination")
            links.append({"source": src, "target": tgt, "value": _round(value)})

    return {"nodes": nodes, "links": links}


def _estimate_totals(single_run: dict[str, Any]) -> tuple[float, float, float, dict[str, float], float]:
    final_actions = dict(single_run.get("final_action_distribution") or {})
    estimated_migration = float(single_run.get("estimated_migration_of_funds") or 0.0)

    weighted_by_action: dict[str, float] = {}
    raw_total = 0.0
    raw_exit = 0.0

    for action, count in final_actions.items():
        weight = ACTION_RISK_WEIGHT.get(action, 0.20)
        raw = max(0.0, float(count or 0.0)) * weight
        weighted_by_action[action] = raw
        raw_total += raw
        if action in EXIT_ACTIONS:
            raw_exit += raw

    if raw_total <= 0 and estimated_migration <= 0:
        return 0.0, 0.0, 0.0, {}, 0.0

    # Use current migration metric as the best known exited capital for new runs.
    exited_funds = estimated_migration if estimated_migration > 0 else raw_exit * 1000.0
    if raw_exit <= 0:
        retained_funds = exited_funds * 0.35
    else:
        retained_funds = (raw_total - raw_exit) * (exited_funds / raw_exit) * 0.35
    retained_funds = max(0.0, retained_funds)
    total_funds_at_risk = exited_funds + retained_funds
    compromised_funds = total_funds_at_risk

    return total_funds_at_risk, exited_funds, retained_funds, weighted_by_action, raw_total


def build_funds_at_risk_breakdown(
    single_run: dict[str, Any],
    *,
    source: str,
    derived_from_v1: bool,
    confidence_level: str,
) -> dict[str, Any]:
    total_funds_at_risk, exited_funds, retained_funds, weighted_by_action, raw_total = _estimate_totals(single_run)

    if total_funds_at_risk <= 0:
        return {
            "total_funds_at_risk": 0.0,
            "methodology_version": METHODOLOGY_VERSION,
            "assumptions": {
                "action_risk_weights": ACTION_RISK_WEIGHT,
                "action_destination_mapping_version": "v1",
                "reserve_buffer_ratio": float(os.getenv("FUNDS_AVAILABLE_LIQUIDITY_RATIO", "0.60")),
            },
            "by_archetype": [],
            "by_action": [],
            "by_destination": [],
            "by_migration_type": [],
            "retained_funds": 0.0,
            "exited_funds": 0.0,
            "compromised_funds": 0.0,
            "optional_liquidity_gap": {
                "available_liquidity": None,
                "stressed_outflow": None,
                "gap": None,
                "assumption_used": True,
            },
            "sankey_ready": {"nodes": [], "links": []},
            "explainability_summary": {
                "es": "No hay suficientes datos para estimar fondos en riesgo.",
                "en": "There is not enough data to estimate funds at risk.",
            },
            "source": source,
            "derived_from_v1": derived_from_v1,
            "confidence_level": "low",
        }

    # by_action
    by_action: list[dict[str, Any]] = []
    destination_totals: dict[str, float] = defaultdict(float)
    migration_totals: dict[str, float] = defaultdict(float)

    for action, raw in sorted(weighted_by_action.items(), key=lambda kv: kv[1], reverse=True):
        if raw <= 0:
            continue
        amount = (raw / raw_total) * total_funds_at_risk if raw_total > 0 else 0.0
        destination = ACTION_TO_DESTINATION.get(action, "idle_balance")
        mtype = DESTINATION_TO_MIGRATION_TYPE.get(destination, "retained_activity")
        destination_totals[destination] += amount
        migration_totals[mtype] += amount
        by_action.append(
            {
                "action": action,
                "funds_at_risk": _round(amount),
                "share_pct": _pct(amount, total_funds_at_risk),
                "primary_destinations": [
                    {
                        "destination": destination,
                        "amount": _round(amount),
                    }
                ],
            }
        )

    # by_archetype using archetype_level_breakdown
    by_archetype: list[dict[str, Any]] = []
    arch_map = dict(single_run.get("archetype_level_breakdown") or {})
    arch_raw_totals: dict[str, float] = {}
    total_arch_raw = 0.0
    for archetype_id, actions in arch_map.items():
        raw = 0.0
        for action, count in dict(actions or {}).items():
            raw += max(0.0, float(count or 0.0)) * ACTION_RISK_WEIGHT.get(action, 0.20)
        if raw > 0:
            arch_raw_totals[archetype_id] = raw
            total_arch_raw += raw

    for archetype_id, raw in sorted(arch_raw_totals.items(), key=lambda kv: kv[1], reverse=True):
        amount = (raw / total_arch_raw) * total_funds_at_risk if total_arch_raw > 0 else 0.0
        action_amounts = []
        actions = dict(arch_map.get(archetype_id) or {})
        for action, count in actions.items():
            contrib_raw = max(0.0, float(count or 0.0)) * ACTION_RISK_WEIGHT.get(action, 0.20)
            if raw <= 0 or contrib_raw <= 0:
                continue
            contrib_amount = (contrib_raw / raw) * amount
            action_amounts.append({"action": action, "amount": _round(contrib_amount)})
        action_amounts.sort(key=lambda x: x["amount"], reverse=True)
        by_archetype.append(
            {
                "archetype_id": archetype_id,
                "funds_at_risk": _round(amount),
                "share_pct": _pct(amount, total_funds_at_risk),
                "top_actions": action_amounts[:3],
            }
        )

    # by_destination
    by_destination = []
    for destination, amount in sorted(destination_totals.items(), key=lambda kv: kv[1], reverse=True):
        by_destination.append(
            {
                "destination": destination,
                "funds_at_risk": _round(amount),
                "share_pct": _pct(amount, total_funds_at_risk),
                "migration_type": DESTINATION_TO_MIGRATION_TYPE.get(destination, "retained_activity"),
            }
        )

    # by_migration_type
    by_migration_type = []
    for mtype, amount in sorted(migration_totals.items(), key=lambda kv: kv[1], reverse=True):
        by_migration_type.append(
            {
                "migration_type": mtype,
                "funds_at_risk": _round(amount),
                "share_pct": _pct(amount, total_funds_at_risk),
            }
        )

    reserve_ratio = float(os.getenv("FUNDS_AVAILABLE_LIQUIDITY_RATIO", "0.60"))
    stressed_outflow = exited_funds
    available_liquidity = total_funds_at_risk * reserve_ratio
    gap = stressed_outflow - available_liquidity

    main_destination = by_destination[0]["destination"] if by_destination else "idle_balance"
    main_archetype = by_archetype[0]["archetype_id"] if by_archetype else "unknown"

    breakdown = {
        "total_funds_at_risk": _round(total_funds_at_risk),
        "methodology_version": METHODOLOGY_VERSION,
        "assumptions": {
            "action_risk_weights": ACTION_RISK_WEIGHT,
            "action_destination_mapping_version": "v1",
            "reserve_buffer_ratio": reserve_ratio,
            "derived_scale_hint": "Uses v1 migration fields when direct capital accounting is unavailable.",
        },
        "by_archetype": by_archetype,
        "by_action": by_action,
        "by_destination": by_destination,
        "by_migration_type": by_migration_type,
        "retained_funds": _round(retained_funds),
        "exited_funds": _round(exited_funds),
        "compromised_funds": _round(total_funds_at_risk),
        "optional_liquidity_gap": {
            "available_liquidity": _round(available_liquidity),
            "stressed_outflow": _round(stressed_outflow),
            "gap": _round(gap),
            "assumption_used": True,
        },
        "sankey_ready": _build_sankey(by_archetype, by_action),
        "explainability_summary": {
            "es": f"El riesgo se concentra en {main_destination} y es impulsado principalmente por el arquetipo {main_archetype}.",
            "en": f"Risk is concentrated in {main_destination}, mainly driven by archetype {main_archetype}.",
        },
        "source": source,
        "derived_from_v1": derived_from_v1,
        "confidence_level": confidence_level,
    }
    return breakdown


def derive_funds_at_risk_from_run(run: dict[str, Any]) -> dict[str, Any]:
    outputs = dict(run.get("outputs") or {})
    single_run = dict(outputs.get("single_run") or {})

    confidence = "medium"
    if not single_run.get("final_action_distribution"):
        confidence = "low"

    return build_funds_at_risk_breakdown(
        single_run,
        source="derived",
        derived_from_v1=True,
        confidence_level=confidence,
    )


def get_stored_funds_at_risk(run: dict[str, Any]) -> dict[str, Any] | None:
    outputs = dict(run.get("outputs") or {})
    single_run = dict(outputs.get("single_run") or {})
    breakdown = single_run.get("funds_at_risk_breakdown")
    if not isinstance(breakdown, dict):
        return None
    out = dict(breakdown)
    out.setdefault("source", "stored")
    out.setdefault("derived_from_v1", False)
    out.setdefault("confidence_level", "high")
    return out

