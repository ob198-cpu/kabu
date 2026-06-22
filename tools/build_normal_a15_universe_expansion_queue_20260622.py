from __future__ import annotations

import csv
import html
from collections import OrderedDict
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
CURRENT = ROOT / "ultimate_selection_normal_a15_evidence_preparation_20260622.csv"
SUPPLEMENT = ROOT / "276_candidate_supplement_screening.csv"
PHYSICAL_AI = ROOT / "886_quantum_physical_ai_screening_20260605.csv"
OUT_CSV = ROOT / "ultimate_selection_normal_a15_universe_expansion_queue_20260622.csv"
OUT_HTML = ROOT / "ultimate_selection_normal_a15_universe_expansion_queue_20260622.html"
MAIN_HTML = ROOT / "ultimate_selection_system_20260618.html"
RECOVERY_HTML = ROOT / "ultimate_selection_normal_a15_recovery_queue_20260622.html"


FIELDS = [
    "priority",
    "ticker",
    "name",
    "source",
    "theme",
    "current_system_status",
    "expansion_status",
    "known_numbers",
    "main_missing",
    "next_action",
    "client_explanation",
]


def read_csv(path: Path) -> list[dict[str, str]]:
    if not path.exists():
        return []
    with path.open("r", encoding="utf-8-sig", newline="") as f:
        return list(csv.DictReader(f))


def write_csv(path: Path, rows: list[dict[str, object]]) -> None:
    with path.open("w", encoding="utf-8-sig", newline="") as f:
        writer = csv.DictWriter(f, fieldnames=FIELDS)
        writer.writeheader()
        for row in rows:
            writer.writerow({field: row.get(field, "") for field in FIELDS})


def fnum(value: object, default: float = 0.0) -> float:
    try:
        text = str(value or "").replace(",", "").replace("%", "").strip()
        return float(text) if text else default
    except Exception:
        return default


def esc(value: object) -> str:
    return html.escape(str(value or ""))


def current_map() -> dict[str, dict[str, str]]:
    return {r.get("ticker", ""): r for r in read_csv(CURRENT) if r.get("ticker")}


def add_candidate(candidates: OrderedDict[str, dict[str, object]], row: dict[str, object]) -> None:
    ticker = str(row.get("ticker", ""))
    if not ticker:
        return
    if ticker not in candidates:
        candidates[ticker] = row
        return
    # Keep the row with richer known_numbers text.
    if len(str(row.get("known_numbers", ""))) > len(str(candidates[ticker].get("known_numbers", ""))):
        candidates[ticker].update(row)


def from_supplement(cur: dict[str, dict[str, str]]) -> list[dict[str, object]]:
    out: list[dict[str, object]] = []
    for row in read_csv(SUPPLEMENT):
        ticker = row.get("ticker", "")
        if not ticker:
            continue
        score = fnum(row.get("supplement_score"))
        confidence = fnum(row.get("data_confidence"))
        current = cur.get(ticker, {})
        known_numbers = (
            f"補充スコア{score:g} / 成長{row.get('growth_quality_score','')} / "
            f"下落耐性{row.get('downside_safety_score','')} / PER{row.get('per','')} / "
            f"PBR{row.get('pbr','')} / ROE{row.get('roe_pct','')}% / "
            f"利益前年比{row.get('profit_yoy_pct','')}% / 1年{row.get('ret1y_pct','')}%"
        )
        if current.get("status") == "通常A標準":
            status = "既に通常A"
            missing = "不足なし"
            next_action = "注文前ゲートのみ確認。"
        elif current:
            status = "既存100内の再確認候補"
            missing = current.get("blocking_reason", "")
            next_action = current.get("next_work", "")
        elif score >= 60 and confidence >= 80:
            status = "母集団追加の優先候補"
            missing = "公式財務、決算後20営業日反応、質的実績層を通常A形式で未接続"
            next_action = "公式決算・PER/PBR/ROE・D+1/D+5/D+20指数差・質的実績層を追加取得する。"
        else:
            status = "補充候補だが優先低"
            missing = row.get("hard_gate", "") or "スコアまたは信頼度が不足"
            next_action = "通常A候補が不足する場合のみ後順位で確認する。"
        out.append(
            {
                "ticker": ticker,
                "name": row.get("company", ""),
                "source": "補充スクリーニング",
                "theme": row.get("theme", ""),
                "current_system_status": current.get("status", "現100社外"),
                "expansion_status": status,
                "known_numbers": known_numbers,
                "main_missing": missing,
                "next_action": next_action,
                "client_explanation": "現100社だけで通常A15社に届かないため、補充候補として同じ基準に通す対象。",
            }
        )
    return out


def from_physical_ai(cur: dict[str, dict[str, str]]) -> list[dict[str, object]]:
    out: list[dict[str, object]] = []
    for row in read_csv(PHYSICAL_AI):
        ticker = row.get("ticker", "")
        if not ticker:
            continue
        current = cur.get(ticker, {})
        missing = row.get("missing", "") or "PER/PBR/ROE、直近決算、決算後反応、質的実績層"
        status = "テーマ追加調査候補"
        if current.get("status") == "通常A標準":
            status = "既に通常A"
            missing = "不足なし"
        elif current:
            status = "既存100内の再確認候補"
            missing = current.get("blocking_reason", missing)
        out.append(
            {
                "ticker": ticker,
                "name": row.get("name", ""),
                "source": "量子・フィジカルAI枠",
                "theme": f"{row.get('channel','')} / {row.get('role','')}",
                "current_system_status": current.get("status", "現100社外"),
                "expansion_status": status,
                "known_numbers": row.get("evidenceStatus", "") + " / " + row.get("quantStatus", ""),
                "main_missing": missing,
                "next_action": row.get("nextAction", "公式決算・受注・利益率・イベント反応を追加確認する。"),
                "client_explanation": "時流テーマの仮説を、通常Aの実データ基準へ通すための追加候補。",
            }
        )
    return out


def sort_key(row: dict[str, object]) -> tuple[int, float, str]:
    status = str(row.get("expansion_status", ""))
    order = {
        "既に通常A": 0,
        "既存100内の再確認候補": 1,
        "母集団追加の優先候補": 2,
        "テーマ追加調査候補": 3,
        "補充候補だが優先低": 4,
    }.get(status, 9)
    # Extract first number from known text when possible.
    return (order, -fnum(str(row.get("known_numbers", "")).split("/")[0].replace("補充スコア", "")), str(row.get("ticker", "")))


def make_rows() -> list[dict[str, object]]:
    cur = current_map()
    candidates: OrderedDict[str, dict[str, object]] = OrderedDict()
    for row in from_supplement(cur) + from_physical_ai(cur):
        add_candidate(candidates, row)
    rows = list(candidates.values())
    rows.sort(key=sort_key)
    for idx, row in enumerate(rows, 1):
        row["priority"] = idx
    return rows


def write_html(rows: list[dict[str, object]]) -> None:
    top_rows = rows[:40]
    body = []
    for row in top_rows:
        body.append(
            "<tr>"
            f"<td>{esc(row['priority'])}</td>"
            f"<td><b>{esc(row['ticker'])}</b><br>{esc(row['name'])}</td>"
            f"<td>{esc(row['source'])}</td>"
            f"<td>{esc(row['theme'])}</td>"
            f"<td>{esc(row['current_system_status'])}</td>"
            f"<td><b>{esc(row['expansion_status'])}</b></td>"
            f"<td>{esc(row['known_numbers'])}</td>"
            f"<td>{esc(row['main_missing'])}</td>"
            f"<td>{esc(row['next_action'])}</td>"
            "</tr>"
        )
    doc = f"""<!doctype html>
<html lang="ja">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>通常A標準15社 母集団拡張キュー 2026-06-22</title>
  <style>
    body {{ margin:0; background:#f5f8fb; color:#061725; font-family:"Yu Gothic","Meiryo",sans-serif; font-size:18px; line-height:1.65; }}
    main {{ max-width:1500px; margin:0 auto; padding:24px; }}
    h1 {{ color:#003b63; font-size:34px; margin:0 0 10px; }}
    .lead {{ background:#fff; border:2px solid #bed3e4; border-left:10px solid #005c97; border-radius:12px; padding:16px; font-weight:900; font-size:20px; }}
    table {{ width:100%; border-collapse:collapse; background:#fff; table-layout:fixed; }}
    th,td {{ border:1px solid #c9dbea; padding:9px; vertical-align:top; overflow-wrap:anywhere; }}
    th {{ background:#e7f1fa; color:#003b63; text-align:left; }}
    td:nth-child(1) {{ width:44px; text-align:center; }}
    td:nth-child(2) {{ width:150px; }}
  </style>
</head>
<body>
<main>
  <h1>通常A標準15社 母集団拡張キュー</h1>
  <p class="lead">現100社だけで通常A標準15社に届かない場合に、次に同じ審査へ通す候補です。ここに載るだけでは購入候補ではありません。公式財務、イベント後20営業日反応、質的実績層を追加してから通常A判定に入れます。</p>
  <table>
    <thead><tr><th>#</th><th>銘柄</th><th>出所</th><th>テーマ</th><th>現システム扱い</th><th>拡張扱い</th><th>既知数値</th><th>不足</th><th>次アクション</th></tr></thead>
    <tbody>{''.join(body)}</tbody>
  </table>
</main>
</body>
</html>"""
    OUT_HTML.write_text(doc, encoding="utf-8")


def add_link(path: Path, href: str, label: str) -> None:
    if not path.exists():
        return
    text = path.read_text(encoding="utf-8", errors="ignore")
    if href in text:
        return
    link = f'<p class="note"><a href="{href}">{label}</a></p>'
    text += "\n" + link
    path.write_text(text, encoding="utf-8")


def main() -> None:
    rows = make_rows()
    write_csv(OUT_CSV, rows)
    write_html(rows)
    href = "ultimate_selection_normal_a15_universe_expansion_queue_20260622.html"
    add_link(MAIN_HTML, href, "通常A標準15社 母集団拡張キューを開く")
    add_link(RECOVERY_HTML, href, "通常A標準15社 母集団拡張キューを開く")
    print(f"wrote {OUT_CSV}")
    print(f"wrote {OUT_HTML}")
    print(f"rows={len(rows)}")


if __name__ == "__main__":
    main()
