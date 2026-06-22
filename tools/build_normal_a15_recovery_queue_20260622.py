from __future__ import annotations

import csv
import html
from collections import Counter
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
SOURCE = ROOT / "ultimate_selection_normal_a15_evidence_preparation_20260622.csv"
MAIN_HTML = ROOT / "ultimate_selection_system_20260618.html"
NORMAL_HTML = ROOT / "ultimate_selection_normal_a15_evidence_preparation_20260622.html"
OUT_CSV = ROOT / "ultimate_selection_normal_a15_recovery_queue_20260622.csv"
OUT_HTML = ROOT / "ultimate_selection_normal_a15_recovery_queue_20260622.html"


FIELDS = [
    "priority",
    "ticker",
    "name",
    "current_status",
    "recovery_class",
    "can_be_normal_a_without_rule_change",
    "main_blocker",
    "missing_or_failed_gate",
    "d20_excess_pct",
    "expected_value_pct",
    "risk_score",
    "next_action",
    "reason_for_client",
]


def read_csv(path: Path) -> list[dict[str, str]]:
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


def failed_gates(row: dict[str, str]) -> list[str]:
    labels = []
    gates = [
        ("financial_gate", "財務"),
        ("event_gate", "イベント反応"),
        ("qualitative_gate", "質的根拠"),
        ("risk_gate", "リスク"),
        ("ev_gate", "期待値"),
        ("reliability_gate", "信頼度"),
        ("overheat_gate", "過熱"),
    ]
    for key, label in gates:
        value = row.get(key, "")
        if value not in {"通過"}:
            labels.append(f"{label}:{value}")
    return labels


def classify(row: dict[str, str]) -> tuple[str, str, str, str, str]:
    status = row.get("status", "")
    event_gate = row.get("event_gate", "")
    financial_gate = row.get("financial_gate", "")
    qualitative_gate = row.get("qualitative_gate", "")
    risk_gate = row.get("risk_gate", "")
    ev_gate = row.get("ev_gate", "")
    reliability_gate = row.get("reliability_gate", "")
    overheat_gate = row.get("overheat_gate", "")
    d20 = fnum(row.get("d20_excess_pct"))

    if row.get("normal_a_ready") == "YES":
        return (
            "通常A済",
            "YES",
            "不足なし",
            "注文前ゲートで当日価格、NISA区分、本人操作、配分上限だけ確認する。",
            "財務、イベント後反応、質的根拠、期待値、リスク、過熱条件を通過済み。",
        )

    if "イベント反証" in status or event_gate == "反証":
        return (
            "反証あり・通常Aに上げない",
            "NO",
            "決算後20営業日の指数比が弱い",
            "次の決算、上方修正、政策材料、6月以降の再反応まで通常Aに上げない。",
            "数字が良くても、イベント後に指数を明確に下回ったため、現時点では買付根拠にしない。",
        )

    if event_gate == "未到達":
        return (
            "日数待ち",
            "PENDING",
            "20営業日反応が未到達",
            "20営業日が到来した日に再取得し、日経平均比+2%以上なら通常A再判定へ進める。",
            "まだ判定に必要な日数が足りないため、見込みで通常Aにしない。",
        )

    if event_gate in {"未達"}:
        if d20 >= 1.5:
            return (
                "イベント再確認で昇格候補",
                "PENDING",
                "イベント反応が通常A基準にわずかに届かない",
                "6月イベント後、銀行/業種指数、次の公式開示で指数比+2%以上へ改善するか確認する。",
                "財務・質的根拠は近いが、市場反応が基準に少し不足しているため保留。",
            )
        return (
            "イベント不足",
            "NO",
            "イベント後反応が通常A水準未達",
            "新しい決算・上方修正・政策材料・業界材料が出るまで通常Aに上げない。",
            "財務やテーマが良くても、市場がまだ買っていないため、通常Aにはしない。",
        )

    if financial_gate != "通過":
        return (
            "公式財務不足",
            "PENDING",
            "公式決算・PER/PBR/ROEの不足",
            "公式決算短信、決算説明資料、PER/PBR/ROE、EPS/BPS、利益率を原本ベースで埋める。",
            "財務の公式根拠が不足しているため、スコアだけでは通常Aにしない。",
        )

    if qualitative_gate != "通過":
        return (
            "質的根拠不足",
            "PENDING",
            "事業寄与・受注・売上比率の不足",
            "AI、半導体、電力などの材料を、公式資料の受注・売上・利益・シェアへ接続する。",
            "テーマ名だけでは不十分で、会社の数字にどう効くかがまだ弱い。",
        )

    if risk_gate != "通過" or overheat_gate != "通過":
        return (
            "過熱・下落耐性不足",
            "NO",
            "過熱または最大下落が大きい",
            "買うなら通常Aではなく小口・条件付き枠。押し目、出来高、急落耐性を別途確認する。",
            "上昇力はあっても、1年保有テストで通常配分にするには振れ幅が大きい。",
        )

    if ev_gate != "通過":
        return (
            "期待値不足",
            "NO",
            "期待値が低い",
            "守り枠や比較枠に限定し、通常A15社には数えない。",
            "分散には使えても、指数+1%以上を狙う主力根拠としては弱い。",
        )

    if reliability_gate != "通過":
        return (
            "信頼度不足",
            "PENDING",
            "データ信頼度が不足",
            "財務・イベント・質的根拠が同時に確認できるまで信頼度を上げない。",
            "確認項目が足りないため、通常Aにするには説明責任が不足している。",
        )

    return (
        "追加確認",
        "PENDING",
        "複合条件の確認",
        "各ゲートの最新値を再計算し、通常A条件に再投入する。",
        "形式上は近いが、どの条件で止まっているかを再確認する。",
    )


def priority_key(row: dict[str, object]) -> tuple[int, float, float]:
    order = {
        "通常A済": 0,
        "イベント再確認で昇格候補": 1,
        "日数待ち": 2,
        "公式財務不足": 3,
        "質的根拠不足": 4,
        "イベント不足": 5,
        "過熱・下落耐性不足": 6,
        "期待値不足": 7,
        "信頼度不足": 8,
        "反証あり・通常Aに上げない": 9,
    }.get(str(row.get("recovery_class")), 20)
    return (order, -fnum(row.get("expected_value_pct")), -fnum(row.get("d20_excess_pct")))


def make_rows() -> list[dict[str, object]]:
    source = read_csv(SOURCE)
    rows: list[dict[str, object]] = []
    for row in source:
        recovery_class, can_promote, blocker, next_action, client_reason = classify(row)
        rows.append(
            {
                "priority": 0,
                "ticker": row.get("ticker", ""),
                "name": row.get("name", ""),
                "current_status": row.get("status", ""),
                "recovery_class": recovery_class,
                "can_be_normal_a_without_rule_change": can_promote,
                "main_blocker": blocker,
                "missing_or_failed_gate": " / ".join(failed_gates(row)),
                "d20_excess_pct": row.get("d20_excess_pct", ""),
                "expected_value_pct": row.get("expected_value_pct", ""),
                "risk_score": row.get("risk_score", ""),
                "next_action": next_action,
                "reason_for_client": client_reason,
            }
        )
    rows.sort(key=priority_key)
    for idx, row in enumerate(rows, 1):
        row["priority"] = idx
    return rows


def write_html(rows: list[dict[str, object]]) -> None:
    counts = Counter(str(row["recovery_class"]) for row in rows)
    normal = counts.get("通常A済", 0)
    pending = sum(1 for row in rows if row["can_be_normal_a_without_rule_change"] == "PENDING")
    no_count = sum(1 for row in rows if row["can_be_normal_a_without_rule_change"] == "NO")
    cards = [
        ("通常A標準", normal, "水増しなしで通過済み"),
        ("回収余地あり", pending, "日数待ち・財務不足・質的不足など"),
        ("通常Aにしない", no_count, "反証・過熱・期待値不足"),
        ("不足社数", max(0, 15 - normal), "15社までに必要な追加通過数"),
    ]
    card_html = "".join(
        f"<div class='card'><b>{esc(label)}</b><strong>{esc(value)}</strong><span>{esc(note)}</span></div>"
        for label, value, note in cards
    )
    table_rows = []
    for row in rows[:45]:
        klass = "ok" if row["can_be_normal_a_without_rule_change"] == "YES" else (
            "pending" if row["can_be_normal_a_without_rule_change"] == "PENDING" else "stop"
        )
        table_rows.append(
            "<tr>"
            f"<td>{esc(row['priority'])}</td>"
            f"<td><b>{esc(row['ticker'])}</b><br>{esc(row['name'])}</td>"
            f"<td><span class='{klass}'>{esc(row['recovery_class'])}</span></td>"
            f"<td>{esc(row['can_be_normal_a_without_rule_change'])}</td>"
            f"<td>{esc(row['main_blocker'])}</td>"
            f"<td>{esc(row['missing_or_failed_gate'])}</td>"
            f"<td>{esc(row['d20_excess_pct'])}%</td>"
            f"<td>{esc(row['expected_value_pct'])}%</td>"
            f"<td>{esc(row['risk_score'])}</td>"
            f"<td>{esc(row['next_action'])}</td>"
            f"<td>{esc(row['reason_for_client'])}</td>"
            "</tr>"
        )
    doc = f"""<!doctype html>
<html lang="ja">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>通常A標準15社 根拠回収キュー 2026-06-22</title>
  <style>
    body {{ margin:0; background:#f5f8fb; color:#061725; font-family:"Yu Gothic","Meiryo",sans-serif; font-size:18px; line-height:1.65; }}
    main {{ max-width:1540px; margin:0 auto; padding:24px; }}
    h1 {{ margin:0 0 10px; color:#003b63; font-size:34px; }}
    .lead {{ background:#fff; border:2px solid #bed3e4; border-left:10px solid #005c97; border-radius:12px; padding:16px; font-weight:900; font-size:20px; }}
    .cards {{ display:grid; grid-template-columns:repeat(4,minmax(180px,1fr)); gap:12px; margin:18px 0; }}
    .card {{ background:#fff; border:2px solid #c7dae8; border-radius:12px; padding:14px; }}
    .card strong {{ display:block; font-size:36px; color:#003b63; }}
    .card span {{ font-weight:900; color:#263d52; }}
    table {{ width:100%; border-collapse:collapse; background:#fff; table-layout:fixed; }}
    th,td {{ border:1px solid #c9dbea; padding:9px; vertical-align:top; overflow-wrap:anywhere; }}
    th {{ background:#e7f1fa; color:#003b63; text-align:left; }}
    td:nth-child(1) {{ width:44px; text-align:center; }}
    td:nth-child(2) {{ width:150px; }}
    td:nth-child(3) {{ width:170px; }}
    td:nth-child(4) {{ width:84px; text-align:center; font-weight:950; }}
    .ok,.pending,.stop {{ display:inline-block; border-radius:999px; padding:4px 9px; font-weight:950; }}
    .ok {{ background:#e8f7ef; color:#00703c; border:1px solid #89c6a5; }}
    .pending {{ background:#fff8e7; color:#8a5200; border:1px solid #d7a13b; }}
    .stop {{ background:#ffecec; color:#b00020; border:1px solid #e09393; }}
    @media(max-width:1000px) {{ .cards {{ grid-template-columns:1fr 1fr; }} table {{ font-size:14px; }} }}
  </style>
</head>
<body>
<main>
  <h1>通常A標準15社 根拠回収キュー</h1>
  <p class="lead">目的は、通常A標準を15社へ増やすために「根拠を足せば上げられる銘柄」と「反証・過熱・期待値不足で上げてはいけない銘柄」を分けることです。条件付き、防御枠、反証銘柄は通常A標準に数えません。</p>
  <section class="cards">{card_html}</section>
  <table>
    <thead>
      <tr>
        <th>#</th><th>銘柄</th><th>回収区分</th><th>通常A化</th><th>主な詰まり</th><th>未通過ゲート</th><th>D+20</th><th>EV</th><th>リスク</th><th>次アクション</th><th>説明用理由</th>
      </tr>
    </thead>
    <tbody>{''.join(table_rows)}</tbody>
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
    marker = "ultimate_selection_normal_a15_evidence_preparation_20260622.html"
    pos = text.find(marker)
    if pos >= 0:
        insert_at = text.find("</p>", pos)
        if insert_at >= 0:
            insert_at += 4
            text = text[:insert_at] + "\n    " + link + text[insert_at:]
        else:
            text += "\n" + link
    else:
        text += "\n" + link
    path.write_text(text, encoding="utf-8")


def main() -> None:
    rows = make_rows()
    write_csv(OUT_CSV, rows)
    write_html(rows)
    href = "ultimate_selection_normal_a15_recovery_queue_20260622.html"
    add_link(MAIN_HTML, href, "通常A標準15社 根拠回収キューを開く")
    add_link(NORMAL_HTML, href, "通常A標準15社 根拠回収キューを開く")
    counts = Counter(str(row["recovery_class"]) for row in rows)
    print(f"wrote {OUT_CSV}")
    print(f"wrote {OUT_HTML}")
    print(dict(counts))


if __name__ == "__main__":
    main()
