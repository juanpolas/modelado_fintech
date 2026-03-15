from __future__ import annotations

import json
import sqlite3
from contextlib import contextmanager
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

from .defaults import DEFAULT_ARCHETYPES, build_default_scenarios


class Database:
    def __init__(self, db_path: str):
        self.db_path = Path(db_path)
        self.db_path.parent.mkdir(parents=True, exist_ok=True)

    @contextmanager
    def conn(self):
        connection = sqlite3.connect(self.db_path)
        connection.row_factory = sqlite3.Row
        try:
            yield connection
            connection.commit()
        finally:
            connection.close()

    def init(self) -> None:
        with self.conn() as c:
            c.execute(
                """
                CREATE TABLE IF NOT EXISTS archetypes (
                    id TEXT PRIMARY KEY,
                    payload TEXT NOT NULL,
                    created_at TEXT NOT NULL,
                    updated_at TEXT NOT NULL
                )
                """
            )
            c.execute(
                """
                CREATE TABLE IF NOT EXISTS scenarios (
                    id TEXT PRIMARY KEY,
                    payload TEXT NOT NULL,
                    created_at TEXT NOT NULL,
                    updated_at TEXT NOT NULL
                )
                """
            )
            c.execute(
                """
                CREATE TABLE IF NOT EXISTS runs (
                    id TEXT PRIMARY KEY,
                    payload TEXT NOT NULL,
                    created_at TEXT NOT NULL
                )
                """
            )
            c.execute(
                """
                CREATE TABLE IF NOT EXISTS settings (
                    key TEXT PRIMARY KEY,
                    value TEXT NOT NULL,
                    updated_at TEXT NOT NULL
                )
                """
            )
            c.execute(
                """
                CREATE TABLE IF NOT EXISTS signals (
                    id TEXT PRIMARY KEY,
                    source_type TEXT NOT NULL,
                    source_name TEXT NOT NULL,
                    payload TEXT NOT NULL,
                    fetched_at TEXT NOT NULL
                )
                """
            )

        self.seed_defaults_if_empty()

    @staticmethod
    def _now_iso() -> str:
        return datetime.now(timezone.utc).isoformat()

    def _upsert(self, table: str, item_id: str, payload: dict[str, Any]) -> None:
        now = self._now_iso()
        with self.conn() as c:
            c.execute(
                f"""
                INSERT INTO {table} (id, payload, created_at, updated_at)
                VALUES (?, ?, ?, ?)
                ON CONFLICT(id) DO UPDATE SET
                    payload=excluded.payload,
                    updated_at=excluded.updated_at
                """,
                (item_id, json.dumps(payload, ensure_ascii=False), now, now),
            )

    def list_items(self, table: str) -> list[dict[str, Any]]:
        with self.conn() as c:
            rows = c.execute(f"SELECT payload FROM {table} ORDER BY id").fetchall()
        return [json.loads(r["payload"]) for r in rows]

    def get_item(self, table: str, item_id: str) -> dict[str, Any] | None:
        with self.conn() as c:
            row = c.execute(f"SELECT payload FROM {table} WHERE id = ?", (item_id,)).fetchone()
        if not row:
            return None
        return json.loads(row["payload"])

    def put_item(self, table: str, item_id: str, payload: dict[str, Any]) -> dict[str, Any]:
        self._upsert(table, item_id, payload)
        return payload

    def delete_item(self, table: str, item_id: str) -> bool:
        with self.conn() as c:
            res = c.execute(f"DELETE FROM {table} WHERE id = ?", (item_id,))
        return res.rowcount > 0

    def create_run(self, run_id: str, payload: dict[str, Any]) -> None:
        now = self._now_iso()
        with self.conn() as c:
            c.execute(
                """
                INSERT OR REPLACE INTO runs (id, payload, created_at)
                VALUES (?, ?, ?)
                """,
                (run_id, json.dumps(payload, ensure_ascii=False), now),
            )

    def list_runs(self) -> list[dict[str, Any]]:
        with self.conn() as c:
            rows = c.execute("SELECT payload FROM runs ORDER BY created_at DESC").fetchall()
        return [json.loads(r["payload"]) for r in rows]

    def get_run(self, run_id: str) -> dict[str, Any] | None:
        with self.conn() as c:
            row = c.execute("SELECT payload FROM runs WHERE id = ?", (run_id,)).fetchone()
        return json.loads(row["payload"]) if row else None

    def duplicate_run(self, run_id: str, new_id: str) -> dict[str, Any] | None:
        run = self.get_run(run_id)
        if not run:
            return None
        run["id"] = new_id
        run["created_at"] = self._now_iso()
        self.create_run(new_id, run)
        return run

    def get_settings(self) -> dict[str, Any]:
        with self.conn() as c:
            rows = c.execute("SELECT key, value FROM settings").fetchall()
        return {r["key"]: json.loads(r["value"]) for r in rows}

    def set_settings(self, payload: dict[str, Any]) -> dict[str, Any]:
        now = self._now_iso()
        with self.conn() as c:
            for key, value in payload.items():
                c.execute(
                    """
                    INSERT INTO settings (key, value, updated_at)
                    VALUES (?, ?, ?)
                    ON CONFLICT(key) DO UPDATE SET
                        value=excluded.value,
                        updated_at=excluded.updated_at
                    """,
                    (key, json.dumps(value, ensure_ascii=False), now),
                )
        return self.get_settings()

    def seed_defaults_if_empty(self) -> None:
        if not self.list_items("archetypes"):
            for a in DEFAULT_ARCHETYPES:
                self.put_item("archetypes", a["id"], a)
        if not self.list_items("scenarios"):
            for s in build_default_scenarios():
                self.put_item("scenarios", s["id"], s)

    def save_signal(self, signal_id: str, source_type: str, source_name: str, payload: dict[str, Any]) -> None:
        now = self._now_iso()
        with self.conn() as c:
            c.execute(
                """
                INSERT OR REPLACE INTO signals (id, source_type, source_name, payload, fetched_at)
                VALUES (?, ?, ?, ?, ?)
                """,
                (signal_id, source_type, source_name, json.dumps(payload, ensure_ascii=False), now),
            )

    def list_signals(self, source_type: str | None = None, limit: int = 200) -> list[dict[str, Any]]:
        with self.conn() as c:
            if source_type:
                rows = c.execute(
                    "SELECT id, source_type, source_name, payload, fetched_at FROM signals WHERE source_type = ? ORDER BY fetched_at DESC LIMIT ?",
                    (source_type, limit),
                ).fetchall()
            else:
                rows = c.execute(
                    "SELECT id, source_type, source_name, payload, fetched_at FROM signals ORDER BY fetched_at DESC LIMIT ?",
                    (limit,),
                ).fetchall()
        out = []
        for row in rows:
            payload = json.loads(row["payload"])
            payload["_meta"] = {
                "id": row["id"],
                "source_type": row["source_type"],
                "source_name": row["source_name"],
                "fetched_at": row["fetched_at"],
            }
            out.append(payload)
        return out

    def latest_signal(self, source_type: str) -> dict[str, Any] | None:
        with self.conn() as c:
            row = c.execute(
                "SELECT id, source_type, source_name, payload, fetched_at FROM signals WHERE source_type = ? ORDER BY fetched_at DESC LIMIT 1",
                (source_type,),
            ).fetchone()
        if not row:
            return None
        payload = json.loads(row["payload"])
        payload["_meta"] = {
            "id": row["id"],
            "source_type": row["source_type"],
            "source_name": row["source_name"],
            "fetched_at": row["fetched_at"],
        }
        return payload
