from __future__ import annotations

from dataclasses import dataclass, field


@dataclass
class NewsSource:
    name: str
    method: str  # rss or parser
    rss_url: str | None = None
    parser_url: str | None = None
    category_tags: list[str] = field(default_factory=list)


NEWS_SOURCES: list[NewsSource] = [
    NewsSource("Ámbito Financiero", "rss", "https://www.ambito.com/rss/pages/home.xml", category_tags=["economy", "markets"]),
    NewsSource("El Cronista", "rss", "https://www.cronista.com/files/rss/news.xml", category_tags=["economy", "finance"]),
    NewsSource("iProfesional", "rss", "https://www.iprofesional.com/rss", category_tags=["business", "economy"]),
    NewsSource("Bloomberg Línea", "rss", "https://www.bloomberglinea.com/arc/outboundfeeds/rss/", category_tags=["macro", "markets"]),
    NewsSource("El Economista", "rss", "https://eleconomista.com.ar/feed", category_tags=["economy"]),
    NewsSource("BAE Negocios", "rss", "https://www.baenegocios.com/rss/pages/home.xml", category_tags=["economy", "politics"]),
    NewsSource("Forbes Argentina", "rss", "https://www.forbesargentina.com/rss", category_tags=["business"]),
    NewsSource("Infobae", "rss", "https://www.infobae.com/feeds/rss/", category_tags=["mass_media"]),
    NewsSource("La Nación", "rss", "https://www.lanacion.com.ar/arc/outboundfeeds/rss/", category_tags=["mass_media"]),
    NewsSource("Clarín", "rss", "https://www.clarin.com/rss/lo-ultimo/", category_tags=["mass_media"]),
    NewsSource("TN", "rss", "https://tn.com.ar/arc/outboundfeeds/rss/", category_tags=["mass_media", "tv"]),
    NewsSource("Perfil", "rss", "https://www.perfil.com/feed", category_tags=["politics"]),
    NewsSource("Página 12", "rss", "https://www.pagina12.com.ar/rss/portada", category_tags=["politics"]),
    NewsSource("El Destape", "parser", parser_url="https://www.eldestapeweb.com/", category_tags=["politics", "narrative"]),
    NewsSource("C5N", "rss", "https://www.c5n.com/rss", category_tags=["tv", "social"]),
    NewsSource("A24", "parser", parser_url="https://www.a24.com/", category_tags=["tv", "social"]),
    NewsSource("CriptoNoticias", "rss", "https://www.criptonoticias.com/feed/", category_tags=["crypto"]),
    NewsSource("Cointelegraph Español", "rss", "https://es.cointelegraph.com/rss", category_tags=["crypto", "fintech"]),
    NewsSource("BeInCrypto Español", "rss", "https://es.beincrypto.com/feed/", category_tags=["crypto", "fintech"]),
]

SOURCE_BY_NAME = {s.name: s for s in NEWS_SOURCES}
