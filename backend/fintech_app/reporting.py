from __future__ import annotations

from typing import Any


def _money(v: Any) -> str:
    try:
        return f"${float(v):,.2f}"
    except Exception:
        return "$0.00"


def _pct(v: Any) -> str:
    try:
        return f"{float(v) * 100:.1f}%"
    except Exception:
        return "0.0%"


def _txt(lang: str, es: str, en: str) -> str:
    return es if lang == "es" else en


def _escape_pdf_text(text: str) -> str:
    return (
        text.replace("\\", "\\\\")
        .replace("(", "\\(")
        .replace(")", "\\)")
        .replace("\r", " ")
        .replace("\n", " ")
    )


def _build_simple_pdf(lines: list[str]) -> bytes:
    page_w = 595
    page_h = 842
    margin_left = 40
    start_y = 800
    line_h = 14

    stream_parts = ["BT", "/F1 11 Tf", f"{margin_left} {start_y} Td"]
    for i, line in enumerate(lines[:52]):
        safe = _escape_pdf_text(line)
        if i == 0:
            stream_parts.append(f"({safe}) Tj")
        else:
            stream_parts.append(f"0 -{line_h} Td ({safe}) Tj")
    stream_parts.append("ET")
    stream = "\n".join(stream_parts).encode("latin-1", errors="replace")

    objects: list[bytes] = []
    objects.append(b"<< /Type /Catalog /Pages 2 0 R >>")
    objects.append(b"<< /Type /Pages /Kids [3 0 R] /Count 1 >>")
    objects.append(
        f"<< /Type /Page /Parent 2 0 R /MediaBox [0 0 {page_w} {page_h}] "
        f"/Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>".encode("ascii")
    )
    objects.append(b"<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>")
    objects.append(f"<< /Length {len(stream)} >>\nstream\n".encode("ascii") + stream + b"\nendstream")

    out = bytearray()
    out.extend(b"%PDF-1.4\n%\xe2\xe3\xcf\xd3\n")
    offsets = [0]
    for idx, obj in enumerate(objects, start=1):
        offsets.append(len(out))
        out.extend(f"{idx} 0 obj\n".encode("ascii"))
        out.extend(obj)
        out.extend(b"\nendobj\n")

    xref_pos = len(out)
    out.extend(f"xref\n0 {len(objects)+1}\n".encode("ascii"))
    out.extend(b"0000000000 65535 f \n")
    for off in offsets[1:]:
        out.extend(f"{off:010d} 00000 n \n".encode("ascii"))
    out.extend(
        (
            f"trailer\n<< /Size {len(objects)+1} /Root 1 0 R >>\n"
            f"startxref\n{xref_pos}\n%%EOF\n"
        ).encode("ascii")
    )
    return bytes(out)


def build_run_report_pdf(run: dict[str, Any], lang: str = "es", ai_summary: str = "") -> bytes:
    lang = "es" if lang not in {"es", "en"} else lang
    cfg = run.get("config", {})
    outputs = run.get("outputs", {})
    single = outputs.get("single_run", {})
    tactical = run.get("tactical_recommendations", {}).get("tactical_actions", []) or []
    innovation = run.get("disruptive_recommendations", {}).get("innovation_lab", []) or []

    lines: list[str] = []
    lines.append(_txt(lang, "MiroFish AR - Informe Ejecutivo de Simulación", "MiroFish AR - Executive Simulation Report"))
    lines.append(f"Run ID: {run.get('id', '-')}")
    lines.append(f"{_txt(lang, 'Fecha', 'Date')}: {run.get('created_at', '-')}")
    lines.append("")
    lines.append(
        _txt(
            lang,
            "Resumen: el informe explica qué se simuló, cómo reaccionaron los agentes y qué acciones se recomiendan.",
            "Summary: this report explains what was simulated, how agents reacted, and which actions are recommended.",
        )
    )
    if ai_summary:
        lines.append("")
        lines.append(_txt(lang, "Lectura ejecutiva IA:", "AI executive reading:"))
        for part in ai_summary.split(". "):
            part = part.strip()
            if part:
                lines.append(f"- {part}")

    lines.append("")
    lines.append(_txt(lang, "1) Configuración utilizada", "1) Simulation setup"))
    lines.append(f"- {_txt(lang, 'Escenario', 'Scenario')}: {cfg.get('scenario_name', '-')}")
    lines.append(f"- {_txt(lang, 'Agentes', 'Agents')}: {cfg.get('num_agents', '-')}")
    lines.append(f"- {_txt(lang, 'Pasos', 'Steps')}: {cfg.get('num_steps', '-')}")
    lines.append(f"- Seed: {cfg.get('seed', '-')}")
    lines.append(f"- Monte Carlo: {cfg.get('monte_carlo_runs', '-')}")

    lines.append("")
    lines.append(_txt(lang, "2) KPIs principales", "2) Main KPIs"))
    lines.append(f"- {_txt(lang, 'Migración de fondos', 'Migration of funds')}: {_money(single.get('estimated_migration_of_funds', 0))}")
    lines.append(f"- {_txt(lang, 'Riesgo de churn', 'Churn risk')}: {_pct(single.get('churn_proxy', 0))}")
    lines.append(f"- {_txt(lang, 'Estrés de liquidez', 'Liquidity stress')}: {_pct(single.get('liquidity_stress_proxy', 0))}")
    lines.append(f"- {_txt(lang, 'Deterioro de confianza', 'Trust deterioration')}: {_pct(single.get('trust_deterioration_proxy', 0))}")
    lines.append(
        f"- Panic Index: {single.get('panic_index_score', 0)} ({single.get('panic_index_label', '-')})"
    )

    lines.append("")
    lines.append(_txt(lang, "3) Acciones observadas de agentes", "3) Observed agent actions"))
    final_actions = single.get("final_action_distribution", {}) or {}
    for action, count in sorted(final_actions.items(), key=lambda kv: kv[1], reverse=True)[:8]:
        lines.append(f"- {action}: {count}")
    if not final_actions:
        lines.append(_txt(lang, "- Sin datos de acciones.", "- No action data."))

    lines.append("")
    lines.append(_txt(lang, "4) Recomendaciones tácticas (top 10)", "4) Tactical recommendations (top 10)"))
    if tactical:
        for idx, item in enumerate(tactical[:10], start=1):
            title = item.get("title", "-")
            why = item.get("why", "")
            lines.append(f"{idx}. {title} - {why}")
    else:
        lines.append(_txt(lang, "Sin datos de recomendaciones tácticas.", "No tactical recommendation data."))

    lines.append("")
    lines.append(_txt(lang, "5) Innovation Lab (top 10)", "5) Innovation Lab (top 10)"))
    if innovation:
        for idx, item in enumerate(innovation[:10], start=1):
            idea = item.get("idea", "-")
            fit = item.get("fit", "")
            lines.append(f"{idx}. {idea} - {fit}")
    else:
        lines.append(_txt(lang, "Sin datos de Innovation Lab.", "No innovation lab data."))

    return _build_simple_pdf(lines)
