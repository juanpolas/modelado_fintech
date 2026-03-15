from __future__ import annotations

from copy import deepcopy

QUALITATIVE_MEDIUM = "medium"

DEFAULT_COUNTRY_CONTEXT = {
    "inflation_expectation": "high",
    "usd_volatility": "high",
    "country_risk_pressure": "high",
    "bank_trust_index": "medium",
    "social_panic_level": "medium",
    "liquidity_preference_shift": "high",
    "crypto_volatility": "high",
    "energy_cost_pressure": "high",
    "consumer_confidence": "low",
    "policy_uncertainty": "high",
    "labor_market_stress": "medium",
    "political_noise": "high",
}

DEFAULT_COMPANY_CONTEXT = {
    "wallet_yield_current": "medium",
    "wallet_yield_new": "medium",
    "competitor_yield": "medium",
    "cashback_percent": "medium",
    "cashback_cap": "medium",
    "onboarding_friction": "low",
    "KYC_friction": "medium",
    "app_stability": "high",
    "transfer_limits": "medium",
    "withdrawal_delay_risk": "low",
    "support_quality": "medium",
    "trust_baseline": "medium",
    "credit_offer_aggressiveness": "medium",
    "loan_rate_level": "high",
}

ACTION_SET = [
    "stay",
    "move_funds",
    "reduce_balance",
    "withdraw_fast",
    "increase_usage",
    "exploit_promo",
    "buy_crypto",
    "wait_and_see",
]

ARCHETYPE_PROMPT_TEMPLATE = (
    "You are an Argentine fintech user with the following profile:\n"
    "Trust level: {{trust_level}}\n"
    "Interest rate sensitivity: {{interest_rate_sensitivity}}\n"
    "Promotion sensitivity: {{promotion_sensitivity}}\n"
    "Crypto affinity: {{crypto_affinity}}\n"
    "Rumor sensitivity: {{rumor_sensitivity}}\n"
    "Liquidity preference: {{liquidity_preference}}\n"
    "Macro anxiety: {{macro_anxiety}}\n\n"
    "Current country context:\n{{country_context}}\n\n"
    "Current company context:\n{{company_context}}\n\n"
    "Choose one action from:\n"
    "stay\nmove_funds\nreduce_balance\nwithdraw_fast\n"
    "increase_usage\nexploit_promo\nbuy_crypto\nwait_and_see\n\n"
    "Return strict JSON only in format: {\"action\": \"...\", \"reason\": \"...\"}."
)

DEFAULT_ARCHETYPES = [
    {
        "id": "rate_seeker",
        "name": "rate seeker",
        "description": "Moves balances quickly toward better yield offers.",
        "trust_level": "medium",
        "interest_rate_sensitivity": "very_high",
        "promotion_sensitivity": "medium",
        "crypto_affinity": "low",
        "rumor_sensitivity": "medium",
        "reaction_speed": "high",
        "balance_bucket": "mid",
        "liquidity_preference": "high",
        "risk_aversion": "medium",
        "income_stability": "medium",
        "macro_anxiety": "high",
        "behavioral_prompt_template": ARCHETYPE_PROMPT_TEMPLATE,
        "reaction_patterns": {
            "interest_rate_changes": "rapid migration to best yield",
            "cashback_changes": "secondary effect",
            "bad_rumors": "holds if yield compensates",
            "fx_shock": "reduces peso exposure",
            "competitor_launch": "tests competitor quickly",
            "app_instability": "withdraws partially",
            "stricter_kyc_friction": "tolerates moderate friction",
        },
    },
    {
        "id": "promo_hunter",
        "name": "promo hunter",
        "description": "Optimizes around cashback and short promotions.",
        "trust_level": "low",
        "interest_rate_sensitivity": "medium",
        "promotion_sensitivity": "very_high",
        "crypto_affinity": "low",
        "rumor_sensitivity": "medium",
        "reaction_speed": "very_high",
        "balance_bucket": "low",
        "liquidity_preference": "very_high",
        "risk_aversion": "low",
        "income_stability": "low",
        "macro_anxiety": "medium",
        "behavioral_prompt_template": ARCHETYPE_PROMPT_TEMPLATE,
        "reaction_patterns": {
            "interest_rate_changes": "reacts if promo absent",
            "cashback_changes": "strong usage spikes",
            "bad_rumors": "short pause then returns for promos",
            "fx_shock": "minor direct effect",
            "competitor_launch": "jumps for sign-up bonus",
            "app_instability": "switches instantly",
            "stricter_kyc_friction": "abandons if friction high",
        },
    },
    {
        "id": "anti_bank_user",
        "name": "anti-bank user",
        "description": "Prefers fintech alternatives due to low trust in banks.",
        "trust_level": "medium",
        "interest_rate_sensitivity": "high",
        "promotion_sensitivity": "medium",
        "crypto_affinity": "medium",
        "rumor_sensitivity": "high",
        "reaction_speed": "high",
        "balance_bucket": "mid",
        "liquidity_preference": "high",
        "risk_aversion": "medium",
        "income_stability": "medium",
        "macro_anxiety": "high",
        "behavioral_prompt_template": ARCHETYPE_PROMPT_TEMPLATE,
        "reaction_patterns": {
            "interest_rate_changes": "seeks non-bank yield",
            "cashback_changes": "moderate effect",
            "bad_rumors": "can panic-withdraw",
            "fx_shock": "moves to hard currency proxies",
            "competitor_launch": "open to migration",
            "app_instability": "rapid trust drop",
            "stricter_kyc_friction": "sees it as control risk",
        },
    },
    {
        "id": "conservative_salaried",
        "name": "conservative salaried user",
        "description": "Stable income, cautious behavior, values reliability.",
        "trust_level": "high",
        "interest_rate_sensitivity": "medium",
        "promotion_sensitivity": "low",
        "crypto_affinity": "very_low",
        "rumor_sensitivity": "low",
        "reaction_speed": "low",
        "balance_bucket": "mid",
        "liquidity_preference": "medium",
        "risk_aversion": "very_high",
        "income_stability": "high",
        "macro_anxiety": "medium",
        "behavioral_prompt_template": ARCHETYPE_PROMPT_TEMPLATE,
        "reaction_patterns": {
            "interest_rate_changes": "gradual reallocation",
            "cashback_changes": "minimal impact",
            "bad_rumors": "wait-and-see",
            "fx_shock": "small defensive move",
            "competitor_launch": "unlikely to move fast",
            "app_instability": "escalates through support",
            "stricter_kyc_friction": "accepts if secure",
        },
    },
    {
        "id": "crypto_opportunist",
        "name": "crypto opportunist",
        "description": "Moves between fintech and crypto based on momentum and FX fears.",
        "trust_level": "low",
        "interest_rate_sensitivity": "medium",
        "promotion_sensitivity": "low",
        "crypto_affinity": "very_high",
        "rumor_sensitivity": "medium",
        "reaction_speed": "high",
        "balance_bucket": "mid",
        "liquidity_preference": "high",
        "risk_aversion": "low",
        "income_stability": "medium",
        "macro_anxiety": "high",
        "behavioral_prompt_template": ARCHETYPE_PROMPT_TEMPLATE,
        "reaction_patterns": {
            "interest_rate_changes": "compares with crypto carry",
            "cashback_changes": "low impact",
            "bad_rumors": "moves to self-custody",
            "fx_shock": "strong crypto buy",
            "competitor_launch": "if better rails, migrates",
            "app_instability": "exits platform quickly",
            "stricter_kyc_friction": "reduces usage",
        },
    },
    {
        "id": "inflation_defensive_saver",
        "name": "inflation-defensive saver",
        "description": "Prioritizes preserving purchasing power over convenience.",
        "trust_level": "medium",
        "interest_rate_sensitivity": "high",
        "promotion_sensitivity": "low",
        "crypto_affinity": "medium",
        "rumor_sensitivity": "high",
        "reaction_speed": "medium",
        "balance_bucket": "high",
        "liquidity_preference": "high",
        "risk_aversion": "high",
        "income_stability": "medium",
        "macro_anxiety": "very_high",
        "behavioral_prompt_template": ARCHETYPE_PROMPT_TEMPLATE,
        "reaction_patterns": {
            "interest_rate_changes": "demands positive real return",
            "cashback_changes": "negligible",
            "bad_rumors": "defensive de-risking",
            "fx_shock": "moves to usd/crypto mix",
            "competitor_launch": "tests safer alternative",
            "app_instability": "withdraws proactively",
            "stricter_kyc_friction": "accepts if trust intact",
        },
    },
    {
        "id": "low_trust_fast_withdrawer",
        "name": "low-trust fast-withdrawer",
        "description": "Highly sensitive to rumors and friction, exits rapidly.",
        "trust_level": "very_low",
        "interest_rate_sensitivity": "medium",
        "promotion_sensitivity": "low",
        "crypto_affinity": "low",
        "rumor_sensitivity": "very_high",
        "reaction_speed": "very_high",
        "balance_bucket": "low",
        "liquidity_preference": "very_high",
        "risk_aversion": "high",
        "income_stability": "low",
        "macro_anxiety": "very_high",
        "behavioral_prompt_template": ARCHETYPE_PROMPT_TEMPLATE,
        "reaction_patterns": {
            "interest_rate_changes": "limited effect",
            "cashback_changes": "limited effect",
            "bad_rumors": "immediate withdrawal",
            "fx_shock": "panic conversions",
            "competitor_launch": "migrates if trusted by peers",
            "app_instability": "full exit",
            "stricter_kyc_friction": "abandons onboarding",
        },
    },
    {
        "id": "everyday_transactional",
        "name": "everyday transactional user",
        "description": "Uses wallet for daily transfers and payments.",
        "trust_level": "medium",
        "interest_rate_sensitivity": "low",
        "promotion_sensitivity": "medium",
        "crypto_affinity": "low",
        "rumor_sensitivity": "medium",
        "reaction_speed": "medium",
        "balance_bucket": "low",
        "liquidity_preference": "high",
        "risk_aversion": "medium",
        "income_stability": "medium",
        "macro_anxiety": "medium",
        "behavioral_prompt_template": ARCHETYPE_PROMPT_TEMPLATE,
        "reaction_patterns": {
            "interest_rate_changes": "low impact",
            "cashback_changes": "uses promoted merchants",
            "bad_rumors": "cuts activity",
            "fx_shock": "stores less balance",
            "competitor_launch": "dual-homes between apps",
            "app_instability": "immediate complaint and reduced usage",
            "stricter_kyc_friction": "moderate churn",
        },
    },
]

DEFAULT_SCENARIOS = [
    ("wallet_yield_increase", "wallet yield increase"),
    ("competitor_yield_increase", "competitor yield increase"),
    ("cashback_campaign_launch", "cashback campaign launch"),
    ("negative_rumor", "negative rumor on social media"),
    ("fx_devaluation_shock", "sudden FX move / devaluation shock"),
    ("stricter_kyc", "stricter KYC friction"),
    ("crypto_drawdown", "crypto drawdown event"),
    ("app_instability", "app instability incident"),
    ("trust_crisis", "trust crisis"),
    ("regulatory_tightening", "regulatory tightening"),
    ("loan_demand_stress", "loan demand stress event"),
    ("liquidity_panic", "liquidity panic event"),
]


def build_default_scenarios() -> list[dict]:
    scenarios = []
    for scenario_id, name in DEFAULT_SCENARIOS:
        scenarios.append(
            {
                "id": scenario_id,
                "name": name,
                "description": f"Default baseline for {name}.",
                "default_country_context": deepcopy(DEFAULT_COUNTRY_CONTEXT),
                "default_company_context": deepcopy(DEFAULT_COMPANY_CONTEXT),
                "notes": "Editable default scenario for Argentina fintech MVP.",
                "event_timeline": [
                    {"step": 1, "event": "signal appears"},
                    {"step": 3, "event": "user reaction amplifies"},
                    {"step": 5, "event": "management response"},
                ],
            }
        )

    shock_map = {
        "negative_rumor": ("social_panic_level", "high"),
        "fx_devaluation_shock": ("usd_volatility", "very_high"),
        "stricter_kyc": ("KYC_friction", "high"),
        "crypto_drawdown": ("crypto_volatility", "very_high"),
        "app_instability": ("app_stability", "low"),
        "trust_crisis": ("trust_baseline", "low"),
        "regulatory_tightening": ("policy_uncertainty", "very_high"),
        "loan_demand_stress": ("loan_rate_level", "very_high"),
        "liquidity_panic": ("withdrawal_delay_risk", "high"),
        "wallet_yield_increase": ("wallet_yield_new", "high"),
        "competitor_yield_increase": ("competitor_yield", "high"),
        "cashback_campaign_launch": ("cashback_percent", "high"),
    }

    for item in scenarios:
        key, value = shock_map[item["id"]]
        if key in item["default_country_context"]:
            item["default_country_context"][key] = value
        else:
            item["default_company_context"][key] = value
    return scenarios
