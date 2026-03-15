from __future__ import annotations

import os
import tempfile
from pathlib import Path
import sys

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))


def build_client():
    temp_db = tempfile.NamedTemporaryFile(suffix=".db", delete=False)
    temp_db.close()
    os.environ["DATABASE_PATH"] = temp_db.name
    os.environ["APP_ACCESS_CODE"] = "test-code"
    os.environ["SESSION_SECRET"] = "test-secret"
    os.environ["LLM_PROVIDER"] = "mock"
    os.environ["X_BEARER_TOKEN"] = ""
    os.environ["SIGNALS_BACKGROUND_ENABLED"] = "false"

    from fintech_app.app import create_app

    app = create_app()
    app.config["TESTING"] = True
    return app.test_client()


def auth(client):
    r = client.post("/auth/login", json={"code": "test-code"})
    assert r.status_code == 200


def test_twitter_fetch_fallback_without_credentials():
    client = build_client()
    auth(client)

    r = client.post("/signals/twitter/fetch", json={"query": "dolar blue argentina"})
    assert r.status_code == 200
    body = r.get_json()
    assert body["source_type"] == "twitter"
    assert isinstance(body["tweets"], list)
    assert "warning" in body


def test_twitter_analyze_maps_to_behavioral_vector():
    client = build_client()
    auth(client)

    fetched = {
        "source_type": "twitter",
        "source_name": "X",
        "fetched_at": "2026-03-15T10:00:00Z",
        "query": "inflacion devaluacion bancos",
        "tweets": [
            {"text": "Rumor de corralito y retiro de fondos ya", "id": "1"},
            {"text": "Compre bitcoin y stablecoins por devaluacion", "id": "2"},
            {"text": "Bancos no responden, panico total", "id": "3"},
        ],
    }
    r = client.post("/signals/twitter/analyze", json={"fetched": fetched})
    assert r.status_code == 200
    body = r.get_json()
    assert body["source_type"] == "twitter"
    assert body["raw_count"] == 3
    assert "dominant_narratives" in body
    assert "behavioral_impact_vector" in body
    assert body["behavioral_impact_vector"]["social_panic_level"] in {"very_low", "low", "medium", "high", "very_high"}


def test_news_fetch_and_analyze_with_inline_articles():
    client = build_client()
    auth(client)

    fetched = {
        "source_type": "news",
        "source_name": "argentina_news_feeds",
        "fetched_at": "2026-03-15T10:00:00Z",
        "articles": [
            {
                "source": "Ámbito Financiero",
                "title": "Sube el dolar blue y crece la tension financiera",
                "summary": "Mercado en alerta por devaluacion e inflacion.",
                "url": "https://example.com/a",
                "published_at": "2026-03-15T09:00:00Z",
                "category": "economy",
                "raw_text_excerpt": "Sube el dolar blue",
            },
            {
                "source": "Infobae",
                "title": "Nuevas medidas del BCRA para bancos y billeteras",
                "summary": "Aumenta la incertidumbre regulatoria en fintech.",
                "url": "https://example.com/b",
                "published_at": "2026-03-15T09:20:00Z",
                "category": "mass_media",
                "raw_text_excerpt": "Nuevas medidas del BCRA",
            },
        ],
        "raw_count": 2,
    }

    r = client.post("/signals/news/analyze", json={"fetched": fetched})
    assert r.status_code == 200
    body = r.get_json()
    assert body["source_type"] == "news"
    assert body["raw_count"] == 2
    assert len(body["articles"]) == 2
    assert "recognized_sources" in body
    assert "country_context_adjustment" in body


def test_fusion_endpoint_combines_sources_and_persists():
    client = build_client()
    auth(client)

    twitter_analysis = {
        "source_type": "twitter",
        "raw_count": 10,
        "severity": "high",
        "dominant_narratives": [["panic", 6], ["rumor", 4]],
        "affected_archetypes": ["low-trust-fast-withdrawer", "crypto-opportunist"],
        "country_context_adjustment": {"social_panic_level": "high", "bank_trust_index": "low"},
        "company_context_adjustment": {"trust_baseline": "low"},
    }
    news_analysis = {
        "source_type": "news",
        "raw_count": 6,
        "severity": "very_high",
        "dominant_narratives": [["panic", 2], ["macro_anxiety", 5]],
        "affected_archetypes": ["conservative-salaried-user"],
        "country_context_adjustment": {"social_panic_level": "very_high", "policy_uncertainty": "very_high"},
        "company_context_adjustment": {"withdrawal_delay_risk": "high"},
    }
    user_context = {
        "country_context": {"consumer_confidence": "low"},
        "company_context": {"support_quality": "high"},
    }

    r = client.post(
        "/signals/fuse",
        json={
            "twitter_analysis": twitter_analysis,
            "news_analysis": news_analysis,
            "user_context": user_context,
        },
    )
    assert r.status_code == 200
    body = r.get_json()
    assert body["source_type"] == "fusion"
    assert body["review_required"] is True
    assert "country_context_adjustment" in body
    assert "company_context_adjustment" in body
    assert len(body["affected_archetypes"]) >= 2

    recents = client.get("/signals/recent?source_type=fusion&limit=5")
    assert recents.status_code == 200
    assert len(recents.get_json()) >= 1
