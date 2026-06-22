from __future__ import annotations

import csv
import html
from collections import Counter
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
SCORES = ROOT / "ultimate_selection_scores_20260618.csv"
FINANCE = ROOT / "official_financial_evidence_20260621.csv"
QUALITY = ROOT / "qualitative_official_evidence_20260621.csv"
EVENT_SCAN = ROOT / "ultimate_selection_a10_event_scan_20260622.csv"
EVENT_GAP_FILL = ROOT / "ultimate_selection_event_reaction_gap_fill_20260621.csv"
MAIN_HTML = ROOT / "ultimate_selection_system_20260618.html"
OUT_CSV = ROOT / "ultimate_selection_normal_a15_evidence_preparation_20260622.csv"
OUT_HTML = ROOT / "ultimate_selection_normal_a15_evidence_preparation_20260622.html"


FIELDS = [
    "rank",
    "ticker",
    "name",
    "status",
    "normal_a_ready",
    "financial_gate",
    "event_gate",
    "qualitative_gate",
    "risk_gate",
    "ev_gate",
    "reliability_gate",
    "overheat_gate",
    "expected_value_pct",
    "risk_score",
    "reliability",
    "one_year_pct",
    "max_dd5_pct",
    "d20_excess_pct",
    "financial_evidence",
    "event_evidence",
    "qualitative_evidence",
    "blocking_reason",
    "next_work",
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


def by_ticker(rows: list[dict[str, str]]) -> dict[str, dict[str, str]]:
    return {row.get("ticker", ""): row for row in rows if row.get("ticker")}


def group_by_ticker(rows: list[dict[str, str]]) -> dict[str, list[dict[str, str]]]:
    out: dict[str, list[dict[str, str]]] = {}
    for row in rows:
        ticker = row.get("ticker", "")
        if ticker:
            out.setdefault(ticker, []).append(row)
    return out


def fnum(value: object, default: float = 0.0) -> float:
    try:
        text = str(value or "").replace(",", "").replace("%", "").strip()
        return float(text) if text else default
    except Exception:
        return default


def short(value: object, limit: int = 260) -> str:
    text = str(value or "").replace("\n", " ").strip()
    return text[:limit] + ("…" if len(text) > limit else "")


def esc(value: object) -> str:
    return html.escape(str(value or ""))


def finance_gate(score: dict[str, str], finance: dict[str, str] | None) -> tuple[str, str, str]:
    if score.get("financial_status") == "pass" or finance:
        evidence = finance.get("official_values_confirmed", "") if finance else "既存スコアで公式財務pass"
        return "通過", short(evidence, 300), ""
    return "不足", short(score.get("missing_items", "公式決算・PER/PBR/ROEの確認不足")), "公式決算・PER/PBR/ROE未通過"


def event_from_gap(row: dict[str, str] | None) -> tuple[str, str, str, float] | None:
    if not row:
        return None
    d20 = fnum(row.get("d20_excess_pct", ""))
    judgement = row.get("event_judgement", "")
    evidence = (
        f"{row.get('event_label','')} / 開示前営業日基準 / "
        f"D+1 {row.get('d1_excess_pct','')}% / D+5 {row.get('d5_excess_pct','')}% / "
        f"D+20 {row.get('d20_excess_pct','')}% / {judgement}"
    )
    if "反証" in judgement:
        return "反証", short(evidence, 300), "決算後20営業日で指数比が弱い", d20
    if d20 >= 2.0:
        return "通過", short(evidence, 300), "", d20
    if row.get("d20_excess_pct", "") == "":
        return "未到達", short(evidence, 300), "20営業日反応が未到達", d20
    return "未達", short(evidence, 300), "イベント後反応が通常A水準未達", d20


def event_from_scan(row: dict[str, str] | None) -> tuple[str, str, str, float]:
    if not row:
        return "不足", "最新イベント後反応未取得", "決算後1日・5日・20営業日の指数比未取得", 0.0
    d20 = fnum(row.get("d20_excess_pct", ""))
    judgement = row.get("event_scan_judgement", "")
    evidence = (
        f"{row.get('event_title','')} / 開示日基準 / "
        f"D+1 {row.get('d1_excess_pct','')}% / D+5 {row.get('d5_excess_pct','')}% / "
        f"D+20 {row.get('d20_excess_pct','')}% / {judgement}"
    )
    if "Aイベント条件通過" in judgement and d20 >= 2.0:
        return "通過", short(evidence, 300), "", d20
    if "20営業日未到達" in judgement:
        return "未到達", short(evidence, 300), "20営業日反応が未到達", d20
    if "イベント反証" in judgement:
        return "反証", short(evidence, 300), "決算後20営業日で指数比が弱い", d20
    if row.get("error"):
        return "不足", short(f"{evidence} / {row.get('error')}", 300), "イベント後反応の取得エラー", d20
    return "未達", short(evidence, 300), "イベント後反応が通常A水準未達", d20


def event_gate(ticker: str, scan: dict[str, str] | None, gap: dict[str, str] | None) -> tuple[str, str, str, float]:
    # 開示後反応は、開示前営業日基準の検証を優先する。
    # 理由: 決算開示が大引け後の場合、開示日終値を基準にすると初動反応を取り逃がすため。
    gap_result = event_from_gap(gap)
    if gap_result is not None:
        return gap_result
    return event_from_scan(scan)


def qualitative_gate(rows: list[dict[str, str]], event_status: str) -> tuple[str, str, str]:
    if not rows:
        return "不足", "公式資料で事業寄与・受注・売上比率が未接続", "質的材料が公式実績層未達"

    parts: list[str] = []
    official = False
    blocker = False
    blocker_can_be_resolved_by_event = False
    for row in rows:
        evidence = row.get("official_or_observed_evidence", "")
        usage = row.get("usage_limit", "")
        level = row.get("evidence_level", "")
        parts.append(f"{row.get('theme','')}: {evidence} / {usage}")
        if any(word in (level + evidence) for word in ["公式", "売上", "利益", "受注", "シェア", "ROE", "営業利益"]):
            official = True
        if any(word in usage for word in ["買付候補に上げない", "単独の買付根拠にしない", "通常購入枠ではなく監視枠"]):
            blocker = True
        if any(word in usage for word in ["決算後反応", "イベント反応", "株価反応"]):
            blocker_can_be_resolved_by_event = True

    evidence_text = short(" ｜ ".join(parts), 340)
    if official and (not blocker or (blocker_can_be_resolved_by_event and event_status == "通過")):
        return "通過", evidence_text, ""
    if official:
        return "補助", evidence_text, "質的材料はあるが、通常Aの単独根拠にしない扱い"
    return "不足", evidence_text, "質的材料が公式実績層未達"


def classify(score: dict[str, str], finance: dict[str, str] | None, quality_rows: list[dict[str, str]], scan: dict[str, str] | None, gap: dict[str, str] | None) -> dict[str, object]:
    f_gate, f_ev, f_block = finance_gate(score, finance)
    e_gate, e_ev, e_block, d20 = event_gate(score.get("ticker", ""), scan, gap)
    q_gate, q_ev, q_block = qualitative_gate(quality_rows, e_gate)

    risk = fnum(score.get("risk_score"))
    ev = fnum(score.get("expected_value_pct"))
    reliability = fnum(score.get("reliability"))
    one_year = fnum(score.get("one_year"))
    max_dd5 = fnum(score.get("max_dd5"))

    risk_gate = "通過" if 35 <= risk < 70 else ("防御枠" if risk >= 70 else "不足")
    ev_gate = "通過" if ev >= 1.0 else "防御枠"
    evidence_reliability_pass = f_gate == "通過" and e_gate == "通過" and q_gate == "通過"
    reliability_gate = "通過" if reliability >= 70 or evidence_reliability_pass else "不足"
    overheat_gate = "通過" if one_year < 250 and max_dd5 > -50 else "条件付き"

    blockers = [b for b in [f_block, e_block, q_block] if b]
    if risk_gate == "不足":
        blockers.append(f"リスクスコア不足({risk:g})")
    elif risk_gate == "防御枠":
        blockers.append(f"リスクスコア高め({risk:g})")
    if ev_gate == "防御枠":
        blockers.append(f"期待値が低い({ev:g}%)")
    if reliability_gate == "不足":
        blockers.append(f"信頼度不足({reliability:g})")
    if overheat_gate == "条件付き":
        blockers.append("過熱または5年最大下落が大きい")

    normal = (
        f_gate == "通過"
        and e_gate == "通過"
        and q_gate == "通過"
        and risk_gate == "通過"
        and ev_gate == "通過"
        and reliability_gate == "通過"
        and overheat_gate == "通過"
    )

    if normal:
        status = "通常A標準"
        next_work = "注文前ゲートで当日悪材料・価格・NISA区分・本人操作・配分上限を確認する。"
    elif e_gate == "反証":
        status = "通常A不可（イベント反証）"
        next_work = "次の決算、上方修正、政策材料、6月以降の再反応まで通常Aに上げない。"
    elif f_gate != "通過":
        status = "通常A未達（財務不足）"
        next_work = "公式決算・PER/PBR/ROE・EPS/BPS・利益率を埋める。"
    elif e_gate != "通過":
        status = "通常A未達（イベント不足）"
        next_work = "決算後20営業日または6月イベント後の指数比を再取得する。"
    elif q_gate != "通過":
        status = "通常A未達（質的根拠不足）"
        next_work = "受注、売上比率、セグメント利益、業界シェアを公式資料で確認する。"
    elif risk_gate == "防御枠" or ev_gate == "防御枠":
        status = "A補完枠（通常Aではない）"
        next_work = "主力ではなく守り・分散の補助に限定。通常A15社には数えない。"
    else:
        status = "通常A未達（条件付き）"
        next_work = "過熱、最大下落、信頼度、当日価格を追加確認する。"

    return {
        "ticker": score.get("ticker", ""),
        "name": score.get("name", ""),
        "status": status,
        "normal_a_ready": "YES" if normal else "NO",
        "financial_gate": f_gate,
        "event_gate": e_gate,
        "qualitative_gate": q_gate,
        "risk_gate": risk_gate,
        "ev_gate": ev_gate,
        "reliability_gate": reliability_gate,
        "overheat_gate": overheat_gate,
        "expected_value_pct": ev,
        "risk_score": risk,
        "reliability": reliability,
        "one_year_pct": one_year,
        "max_dd5_pct": max_dd5,
        "d20_excess_pct": d20,
        "financial_evidence": f_ev,
        "event_evidence": e_ev,
        "qualitative_evidence": q_ev,
        "blocking_reason": " / ".join(blockers) if blockers else "通常A標準の必要根拠を通過",
        "next_work": next_work,
    }


def sort_key(row: dict[str, object]) -> tuple[int, float, float, float]:
    order = {
        "通常A標準": 0,
        "通常A未達（イベント不足）": 1,
        "通常A未達（質的根拠不足）": 2,
        "通常A未達（条件付き）": 3,
        "A補完枠（通常Aではない）": 4,
        "通常A未達（財務不足）": 5,
        "通常A不可（イベント反証）": 6,
    }.get(str(row.get("status")), 9)
    return (order, -fnum(row.get("expected_value_pct")), -fnum(row.get("d20_excess_pct")), fnum(row.get("risk_score")))


def write_html(rows: list[dict[str, object]]) -> None:
    counts = Counter(str(row["status"]) for row in rows)
    normal_count = counts.get("通常A標準", 0)
    gap = max(0, 15 - normal_count)
    cards = [
        ("通常A標準", normal_count, "水増しなしで通過"),
        ("不足", gap, "15社までに必要な追加通過数"),
        ("イベント反証", counts.get("通常A不可（イベント反証）", 0), "根拠を足しても通常Aにしない"),
        ("財務不足", counts.get("通常A未達（財務不足）", 0), "公式決算・PER/PBR/ROE待ち"),
    ]
    card_html = "".join(
        f"<div class='card'><b>{esc(label)}</b><strong>{esc(value)}</strong><span>{esc(note)}</span></div>"
        for label, value, note in cards
    )
    table_rows = []
    for idx, row in enumerate(rows[:45], 1):
        cls = "ok" if row["status"] == "通常A標準" else ("bad" if "反証" in str(row["status"]) else "wait")
        table_rows.append(
            "<tr>"
            f"<td>{idx}</td>"
            f"<td><b>{esc(row['ticker'])}</b><br>{esc(row['name'])}</td>"
            f"<td><span class='{cls}'>{esc(row['status'])}</span></td>"
            f"<td>{esc(row['expected_value_pct'])}%</td>"
            f"<td>{esc(row['risk_score'])}</td>"
            f"<td>{esc(row['d20_excess_pct'])}%</td>"
            f"<td>{esc(row['financial_gate'])}</td>"
            f"<td>{esc(row['event_gate'])}</td>"
            f"<td>{esc(row['qualitative_gate'])}</td>"
            f"<td>{esc(row['blocking_reason'])}</td>"
            f"<td>{esc(row['next_work'])}</td>"
            "</tr>"
        )
    doc = f"""<!doctype html>
<html lang="ja">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>通常A標準15社 根拠準備 2026-06-22</title>
  <style>
    body {{ margin:0; background:#f5f8fb; color:#071927; font-family:"Yu Gothic","Meiryo",sans-serif; font-size:17px; line-height:1.65; }}
    main {{ max-width:1500px; margin:0 auto; padding:24px; }}
    h1 {{ margin:0 0 10px; color:#003b63; font-size:34px; }}
    .lead {{ background:#fff; border:2px solid #bad2e3; border-left:10px solid #005c97; border-radius:12px; padding:16px; font-weight:900; font-size:19px; }}
    .cards {{ display:grid; grid-template-columns:repeat(4,minmax(180px,1fr)); gap:12px; margin:18px 0; }}
    .card {{ background:#fff; border:2px solid #c7dae8; border-radius:12px; padding:14px; }}
    .card strong {{ display:block; font-size:34px; color:#003b63; }}
    .card span {{ font-weight:900; color:#284158; }}
    table {{ width:100%; border-collapse:collapse; background:#fff; table-layout:fixed; }}
    th,td {{ border:1px solid #c9dbea; padding:9px; vertical-align:top; overflow-wrap:anywhere; }}
    th {{ background:#e7f1fa; color:#003b63; text-align:left; }}
    td:nth-child(1) {{ width:42px; text-align:center; }}
    td:nth-child(2) {{ width:150px; }}
    .ok,.wait,.bad {{ display:inline-block; border-radius:999px; padding:4px 8px; font-weight:950; }}
    .ok {{ background:#e8f7ef; color:#00703c; border:1px solid #89c6a5; }}
    .wait {{ background:#fff8e7; color:#8a5200; border:1px solid #d7a13b; }}
    .bad {{ background:#ffecec; color:#b00020; border:1px solid #e09393; }}
  </style>
</head>
<body>
<main>
  <h1>通常A標準15社 根拠準備</h1>
  <p class="lead">通常A標準は、財務・イベント後20営業日反応・質的公式根拠・期待値・リスク・信頼度・過熱確認を同時に通過した銘柄だけです。条件付き、防御枠、イベント反証銘柄は通常A15社に数えません。イベント反応は開示前営業日基準の検証を優先して再計算しています。</p>
  <section class="cards">{card_html}</section>
  <table>
    <thead><tr><th>#</th><th>銘柄</th><th>判定</th><th>EV</th><th>リスク</th><th>D+20指数差</th><th>財務</th><th>イベント</th><th>質的</th><th>未通過理由</th><th>次にやること</th></tr></thead>
    <tbody>{''.join(table_rows)}</tbody>
  </table>
</main>
</body>
</html>"""
    OUT_HTML.write_text(doc, encoding="utf-8")


def main() -> None:
    scores = read_csv(SCORES)
    finance = by_ticker(read_csv(FINANCE))
    quality = group_by_ticker(read_csv(QUALITY))
    scans = by_ticker(read_csv(EVENT_SCAN))
    gaps = by_ticker(read_csv(EVENT_GAP_FILL))
    rows = [
        classify(row, finance.get(row.get("ticker", "")), quality.get(row.get("ticker", ""), []), scans.get(row.get("ticker", "")), gaps.get(row.get("ticker", "")))
        for row in scores[:100]
    ]
    rows.sort(key=sort_key)
    for idx, row in enumerate(rows, 1):
        row["rank"] = idx
    write_csv(OUT_CSV, rows)
    write_html(rows)
    counts = Counter(str(row["status"]) for row in rows)
    print(f"wrote {OUT_CSV}")
    print(f"wrote {OUT_HTML}")
    print(f"normal_a={counts.get('通常A標準', 0)}")
    print(dict(counts))


if __name__ == "__main__":
    main()
