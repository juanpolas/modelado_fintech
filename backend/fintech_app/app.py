from __future__ import annotations

import os
import uuid
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

from flask import Flask, jsonify, request, session
from flask_cors import CORS

from .db import Database
from .defaults import DEFAULT_COMPANY_CONTEXT, DEFAULT_COUNTRY_CONTEXT
from .llm import LLMClient, LLMConfig
from .news_client import NewsSignalClient
from .models import Archetype, SimulationConfig, SimulationRun
from .signal_fusion import SignalFusionEngine
from .signal_jobs import SignalBackgroundJobs
from .simulation import SimulationEngine
from .twitter_client import TwitterSignalClient

ROOT = Path(__file__).resolve().parents[2]
DATA_DIR = ROOT / "data"
DB_PATH = os.getenv("DATABASE_PATH", str(DATA_DIR / "fintech_sim.db"))


def create_app() -> Flask:
    app = Flask(__name__)
    app.secret_key = os.getenv("SESSION_SECRET", "change-me")
    app.config["SESSION_COOKIE_HTTPONLY"] = True
    app.config["SESSION_COOKIE_SAMESITE"] = "Lax"
    app.config["JSON_AS_ASCII"] = False

    frontend_origin = os.getenv("FRONTEND_ORIGIN", "http://localhost:5173")
    CORS(app, supports_credentials=True, origins=[frontend_origin, "http://localhost:5173", "http://localhost:3000"])

    db = Database(DB_PATH)
    db.init()
    twitter_client = TwitterSignalClient()
    news_client = NewsSignalClient()
    fusion_engine = SignalFusionEngine()
    jobs = SignalBackgroundJobs(db, twitter_client, news_client, fusion_engine)
    jobs.start()

    def active_llm() -> LLMClient:
        settings = db.get_settings()
        cfg = LLMConfig(
            provider=str(settings.get("llm_provider", os.getenv("LLM_PROVIDER", "mock"))),
            base_url=str(settings.get("llm_base_url", os.getenv("LLM_BASE_URL", ""))),
            api_key=os.getenv("LLM_API_KEY", ""),
            model=str(settings.get("llm_model", os.getenv("LLM_MODEL", "qwen-plus"))),
        )
        return LLMClient(cfg)

    access_code = os.getenv("APP_ACCESS_CODE", "changeme")
    open_paths = {"/health", "/auth/login", "/auth/logout", "/auth/status"}

    @app.before_request
    def gate():
        if request.method == "OPTIONS":
            return None
        if request.path in open_paths:
            return None
        if session.get("authorized"):
            return None
        return jsonify({"detail": "Access code required"}), 401

    @app.get("/health")
    def health():
        return jsonify({"status": "ok", "service": "fintech-sim"})

    @app.post("/auth/login")
    def login():
        payload = request.get_json(silent=True) or {}
        if payload.get("code") != access_code:
            return jsonify({"detail": "Invalid code"}), 401
        session["authorized"] = True
        return jsonify({"ok": True})

    @app.post("/auth/logout")
    def logout():
        session.clear()
        return jsonify({"ok": True})

    @app.get("/auth/status")
    def auth_status():
        return jsonify({"authorized": bool(session.get("authorized"))})

    # Archetypes
    @app.get("/archetypes")
    def list_archetypes():
        return jsonify(db.list_items("archetypes"))

    @app.post("/archetypes")
    def create_archetype():
        payload = request.get_json(silent=True) or {}
        payload["id"] = payload.get("id") or f"archetype_{uuid.uuid4().hex[:8]}"
        Archetype.from_dict(payload)
        return jsonify(db.put_item("archetypes", payload["id"], payload))

    @app.put("/archetypes/<item_id>")
    def update_archetype(item_id: str):
        payload = request.get_json(silent=True) or {}
        payload["id"] = item_id
        Archetype.from_dict(payload)
        return jsonify(db.put_item("archetypes", item_id, payload))

    @app.delete("/archetypes/<item_id>")
    def delete_archetype(item_id: str):
        if not db.delete_item("archetypes", item_id):
            return jsonify({"detail": "not found"}), 404
        return jsonify({"deleted": True})

    # Scenarios
    @app.get("/scenarios")
    def list_scenarios():
        return jsonify(db.list_items("scenarios"))

    @app.post("/scenarios")
    def create_scenario():
        payload = request.get_json(silent=True) or {}
        payload["id"] = payload.get("id") or f"scenario_{uuid.uuid4().hex[:8]}"
        return jsonify(db.put_item("scenarios", payload["id"], payload))

    @app.put("/scenarios/<item_id>")
    def update_scenario(item_id: str):
        payload = request.get_json(silent=True) or {}
        payload["id"] = item_id
        return jsonify(db.put_item("scenarios", item_id, payload))

    @app.delete("/scenarios/<item_id>")
    def delete_scenario(item_id: str):
        if not db.delete_item("scenarios", item_id):
            return jsonify({"detail": "not found"}), 404
        return jsonify({"deleted": True})

    @app.post("/simulate")
    def simulate():
        llm = active_llm()
        engine = SimulationEngine(llm)
        payload = request.get_json(silent=True) or {}
        try:
            config = SimulationConfig.from_dict(payload)
        except ValueError as exc:
            return jsonify({"detail": str(exc)}), 400

        archetypes_raw = db.list_items("archetypes")
        included = [a for a in archetypes_raw if a["id"] in config.archetype_mix]
        if not included:
            return jsonify({"detail": "Archetype mix references unknown ids"}), 400

        archetypes = [Archetype.from_dict(a) for a in included]
        outputs = engine.run(config, archetypes)

        meta = {"id": config.scenario_id, "name": config.scenario_name}
        recommend_payload = {
            "simulation_results": outputs,
            "country_context": config.country_context,
            "company_context": config.company_context,
            "scenario_metadata": meta,
            "live_signals": db.latest_signal("fusion"),
        }
        tactical = llm.strategy_recommend(recommend_payload)
        disruptive = llm.innovation_recommend(recommend_payload)

        run_id = f"run_{uuid.uuid4().hex[:8]}"
        run = SimulationRun(
            id=run_id,
            created_at=datetime.now(timezone.utc),
            config=payload,
            outputs=outputs,
            tactical_recommendations=tactical,
            disruptive_recommendations=disruptive,
            generated_insights={"llm_provider": llm.cfg.provider},
        ).to_dict()
        db.create_run(run_id, run)
        return jsonify(run)

    @app.get("/runs")
    def list_runs():
        return jsonify(db.list_runs())

    @app.get("/runs/<run_id>")
    def get_run(run_id: str):
        run = db.get_run(run_id)
        if not run:
            return jsonify({"detail": "not found"}), 404
        return jsonify(run)

    @app.post("/runs/<run_id>/duplicate")
    def duplicate_run(run_id: str):
        new_id = f"run_{uuid.uuid4().hex[:8]}"
        dupe = db.duplicate_run(run_id, new_id)
        if not dupe:
            return jsonify({"detail": "not found"}), 404
        return jsonify(dupe)

    @app.post("/translate-scenario")
    def translate_scenario():
        llm = active_llm()
        payload = request.get_json(silent=True) or {}
        text = payload.get("text", "")
        translated = llm.translate_scenario(text)
        return jsonify(
            {
                "scenario_text": text,
                "country_context": translated["country_context"],
                "company_context": translated["company_context"],
                "notes": translated.get("notes", []),
            }
        )

    @app.post("/impact-translate")
    def impact_translate():
        llm = active_llm()
        payload = request.get_json(silent=True) or {}
        text = payload.get("text", "")
        translated = llm.impact_translate(text)
        return jsonify(
            {
                "global_event": text,
                "transmission_channels": translated.get("transmission_channels", []),
                "country_context": translated["country_context"],
                "company_context": translated["company_context"],
                "explanation": translated.get("explanation", ""),
            }
        )

    @app.post("/strategy-recommend")
    def strategy_recommend():
        llm = active_llm()
        payload = request.get_json(silent=True) or {}
        return jsonify(llm.strategy_recommend(payload))

    @app.post("/innovation-recommend")
    def innovation_recommend():
        llm = active_llm()
        payload = request.get_json(silent=True) or {}
        return jsonify(llm.innovation_recommend(payload))

    @app.get("/settings")
    def get_settings():
        llm = active_llm()
        defaults = {
            "llm_provider": llm.cfg.provider,
            "llm_base_url": llm.cfg.base_url,
            "llm_model": llm.cfg.model,
            "default_country_context": DEFAULT_COUNTRY_CONTEXT,
            "default_company_context": DEFAULT_COMPANY_CONTEXT,
        }
        return jsonify({**defaults, **db.get_settings()})

    @app.put("/settings")
    def put_settings():
        payload: dict[str, Any] = request.get_json(silent=True) or {}
        payload["updated_at"] = datetime.now(timezone.utc).isoformat()
        return jsonify(db.set_settings(payload))

    @app.errorhandler(ValueError)
    def value_error(exc: ValueError):
        return jsonify({"detail": str(exc)}), 400

    @app.post("/signals/twitter/fetch")
    def signals_twitter_fetch():
        payload = request.get_json(silent=True) or {}
        fetched = twitter_client.fetch(payload)
        signal_id = f"twitter_fetch_{uuid.uuid4().hex[:10]}"
        db.save_signal(signal_id, "twitter", "X", fetched)
        return jsonify(fetched)

    @app.post("/signals/twitter/analyze")
    def signals_twitter_analyze():
        payload = request.get_json(silent=True) or {}
        fetched = payload.get("fetched")
        if not fetched:
            fetched = twitter_client.fetch(payload)
        analyzed = twitter_client.analyze(fetched)
        signal_id = f"twitter_analysis_{uuid.uuid4().hex[:10]}"
        db.save_signal(signal_id, "twitter", "X", analyzed)
        return jsonify(analyzed)

    @app.post("/signals/news/fetch")
    def signals_news_fetch():
        payload = request.get_json(silent=True) or {}
        fetched = news_client.fetch(payload)
        signal_id = f"news_fetch_{uuid.uuid4().hex[:10]}"
        db.save_signal(signal_id, "news", "argentina_news_feeds", fetched)
        return jsonify(fetched)

    @app.post("/signals/news/analyze")
    def signals_news_analyze():
        payload = request.get_json(silent=True) or {}
        fetched = payload.get("fetched")
        if not fetched:
            fetched = news_client.fetch(payload)
        analyzed = news_client.analyze(fetched)
        signal_id = f"news_analysis_{uuid.uuid4().hex[:10]}"
        db.save_signal(signal_id, "news", "argentina_news_feeds", analyzed)
        return jsonify(analyzed)

    @app.post("/signals/fuse")
    def signals_fuse():
        payload = request.get_json(silent=True) or {}
        twitter_analysis = payload.get("twitter_analysis") or db.latest_signal("twitter") or {}
        news_analysis = payload.get("news_analysis") or db.latest_signal("news") or {}
        user_context = payload.get("user_context") or {}
        fused = fusion_engine.fuse(twitter_analysis, news_analysis, user_context)
        db.save_signal(fused["id"], "fusion", "twitter_news_user_fusion", fused)
        return jsonify(fused)

    @app.get("/signals/recent")
    def signals_recent():
        source_type = request.args.get("source_type") or None
        limit = int(request.args.get("limit") or 100)
        return jsonify(db.list_signals(source_type=source_type, limit=limit))

    @app.post("/signals/refresh")
    def signals_refresh():
        fused = jobs.run_once()
        return jsonify({"ok": True, "fused": fused})

    return app


app = create_app()
