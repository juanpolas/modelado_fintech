from __future__ import annotations

import os
import threading
import time
import uuid
from typing import Any

from .db import Database
from .news_client import NewsSignalClient
from .signal_fusion import SignalFusionEngine
from .twitter_client import TwitterSignalClient


class SignalBackgroundJobs:
    def __init__(self, db: Database, twitter: TwitterSignalClient, news: NewsSignalClient, fusion: SignalFusionEngine):
        self.db = db
        self.twitter = twitter
        self.news = news
        self.fusion = fusion
        self.interval_minutes = int(os.getenv("NEWS_REFRESH_INTERVAL_MINUTES", "20"))
        self.enabled = os.getenv("SIGNALS_BACKGROUND_ENABLED", "false").lower() == "true"
        self._thread: threading.Thread | None = None

    def start(self) -> None:
        if not self.enabled or self._thread:
            return
        self._thread = threading.Thread(target=self._loop, daemon=True)
        self._thread.start()

    def _loop(self) -> None:
        while True:
            try:
                self.run_once()
            except Exception:
                pass
            time.sleep(max(60, self.interval_minutes * 60))

    def run_once(self) -> dict[str, Any]:
        tw_fetch = self.twitter.fetch({})
        tw_an = self.twitter.analyze(tw_fetch)
        self.db.save_signal(f"twitter_bg_{uuid.uuid4().hex[:10]}", "twitter", "X", tw_an)

        nw_fetch = self.news.fetch({})
        nw_an = self.news.analyze(nw_fetch)
        self.db.save_signal(f"news_bg_{uuid.uuid4().hex[:10]}", "news", "argentina_news_feeds", nw_an)

        fused = self.fusion.fuse(tw_an, nw_an, {})
        self.db.save_signal(fused["id"], "fusion", "twitter_news_user_fusion", fused)
        return fused
