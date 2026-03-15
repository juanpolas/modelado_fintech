from __future__ import annotations

import uuid
from datetime import datetime, timezone
from typing import Any

from .signals import SCORE_TO_QUAL, QUAL_TO_SCORE, combine_vectors, utc_now


class SignalFusionEngine:
    def fuse(self, twitter_analysis: dict[str, Any], news_analysis: dict[str, Any], user_context: dict[str, Any] | None = None) -> dict[str, Any]:
        user_context = user_context or {}

        tw_country = twitter_analysis.get("country_context_adjustment", {})
        tw_company = twitter_analysis.get("company_context_adjustment", {})
        nw_country = news_analysis.get("country_context_adjustment", {})
        nw_company = news_analysis.get("company_context_adjustment", {})
        usr_country = user_context.get("country_context", {})
        usr_company = user_context.get("company_context", {})

        # Confirmed news weighted higher than social rumors
        weighted_country = self._weighted_merge([(tw_country, 1.0), (nw_country, 1.6), (usr_country, 1.2)])
        weighted_company = self._weighted_merge([(tw_company, 1.0), (nw_company, 1.4), (usr_company, 1.2)])

        tw_narr = twitter_analysis.get("dominant_narratives", [])
        nw_narr = news_analysis.get("dominant_narratives", [])
        narrative_map: dict[str, float] = {}

        for item in tw_narr:
            if isinstance(item, (list, tuple)) and len(item) >= 2:
                narrative_map[str(item[0])] = narrative_map.get(str(item[0]), 0.0) + float(item[1]) * 1.0
        for item in nw_narr:
            if isinstance(item, (list, tuple)) and len(item) >= 2:
                narrative_map[str(item[0])] = narrative_map.get(str(item[0]), 0.0) + float(item[1]) * 1.5

        dominant_narratives = sorted(narrative_map.items(), key=lambda x: x[1], reverse=True)[:8]

        affected = sorted(
            set(twitter_analysis.get("affected_archetypes", []))
            | set(news_analysis.get("affected_archetypes", []))
            | set(user_context.get("affected_archetypes", []))
        )

        severity = self._combine_severity([
            twitter_analysis.get("severity", "medium"),
            news_analysis.get("severity", "medium"),
        ])

        return {
            "id": f"fusion_{uuid.uuid4().hex[:10]}",
            "source_type": "fusion",
            "source_name": "twitter_news_user_fusion",
            "fetched_at": utc_now(),
            "severity": severity,
            "dominant_narratives": dominant_narratives,
            "affected_archetypes": affected,
            "country_context_adjustment": weighted_country,
            "company_context_adjustment": weighted_company,
            "review_required": True,
            "dedupe_policy": "news_weighted_over_rumor",
            "inputs": {
                "twitter_count": twitter_analysis.get("raw_count", 0),
                "news_count": news_analysis.get("raw_count", 0),
            },
        }

    def _weighted_merge(self, vectors: list[tuple[dict[str, str], float]]) -> dict[str, str]:
        keys = set()
        for vec, _ in vectors:
            keys.update(vec.keys())
        out: dict[str, str] = {}
        for key in keys:
            total_weight = 0.0
            total = 0.0
            for vec, w in vectors:
                if key in vec:
                    total += QUAL_TO_SCORE.get(vec.get(key, "medium"), 3) * w
                    total_weight += w
            if total_weight <= 0:
                continue
            out[key] = SCORE_TO_QUAL[round(total / total_weight)]
        return out

    def _combine_severity(self, values: list[str]) -> str:
        score = 0.0
        count = 0
        for v in values:
            if v in QUAL_TO_SCORE:
                score += QUAL_TO_SCORE[v]
                count += 1
        if count == 0:
            return "medium"
        return SCORE_TO_QUAL[round(score / count)]
