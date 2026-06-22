from __future__ import annotations

import csv
import html
from collections import Counter
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
RECOVERY = ROOT / "ultimate_selection_normal_a15_recovery_queue_20260622.csv"
EVIDENCE = ROOT / "ultimate_selection_normal_a15_evidence_preparation_20260622.csv"
OUT_CSV = ROOT / "ultimate_selection_normal_a15_progress_20260622.csv"
OUT_HTML = ROOT / "ultimate_selection_normal_a15_progress_20260622.html"


FIELDS = [
    "priority",
    "ticker",
    "name",
    "current_status",
    "promotion_group",
    "normal_a_countable",
    "blocker",
    "evidence_to_add",
    "action",
    "client_explanation",
]


def read_csv(path: Path) -> list[dict[str, str]]:
    with path.open("r", encoding="utf-8-sig", newline="") as f:
        return list(csv.DictReader(f))


def write_csv(rows: list[dict[str, str]]) -> None:
    with OUT_CSV.open("w", encoding="utf-8-sig", newline="") as f:
        writer = csv.DictWriter(f, fieldnames=FIELDS)
        writer.writeheader()
        writer.writerows([{field: row.get(field, "") for field in FIELDS} for row in rows])


def esc(value: object) -> str:
    return html.escape(str(value or ""))


def classify(row: dict[str, str]) -> tuple[str, str, str, str, str]:
    status = row.get("current_status", "")
    recovery = row.get("recovery_class", "")
    ticker = row.get("ticker", "")
    blocker = row.get("main_blocker", "")
    failed = row.get("missing_or_failed_gate", "")
    d20 = row.get("d20_excess_pct", "")

    if status == "通常A標準":
        return (
            "通常A標準（採用可能）",
            "YES",
            "不足なし",
            "注文前の当日価格、NISA口座区分、本人操作、1銘柄上限だけ確認する。",
            "財務・イベント後反応・質的根拠・リスク・期待値・過熱条件をすべて通過しているため、通常Aに数える。",
        )

    if ticker == "8411.T":
        return (
            "昇格候補（イベント再確認）",
            "PENDING",
            "決算後20営業日反応が日経平均比+1.91%で、通常A基準の+2.00%に0.09pt不足。",
            "銀行セクター指数、6月イベント後の反応、次回開示後の指数差を再取得する。+2%以上なら再判定。",
            "ほぼ届いているが、基準未満を通常Aに数えると説明責任が崩れるため、現時点では保留。",
        )

    if ticker == "6503.T":
        return (
            "昇格候補（20営業日待ち）",
            "PENDING",
            "訂正開示後の20営業日反応がまだ未到達。",
            "20営業日到達日に株価と日経平均を再取得し、日経平均比+2%以上なら通常Aへ再判定する。",
            "財務・質的根拠・リスク・期待値は通過しているが、イベント後反応の確認日数が足りないため保留。",
        )

    if "反証" in recovery or "反証" in status:
        return (
            "通常A不可（反証あり）",
            "NO",
            blocker or "決算後またはイベント後に指数比で弱い反応が確認されている。",
            "次回決算、上方修正、政策材料などで反応が改善するまで通常Aに上げない。",
            "財務やテーマが良くても、市場が実際に買っていない証拠があるため、通常Aには数えない。",
        )

    if "過熱" in blocker or "条件付き" in status:
        return (
            "通常A未達（過熱・下落耐性）",
            "NO",
            blocker or failed,
            "当日価格、60日/1年上昇率、最大下落率を再確認し、過熱が解消するまで条件付きに留める。",
            "上昇力はあるが、急落時の振れ幅が大きく、通常Aの標準枠としてはリスクが高い。",
        )

    if "財務不足" in status:
        return (
            "根拠準備中（公式財務不足）",
            "PENDING",
            blocker or "公式決算・PER/PBR/ROE・EPS/BPS・利益率が不足。",
            "公式決算短信・決算説明資料・証券会社画面でPER/PBR/ROEを埋め、同じゲートに再投入する。",
            "スコア上は候補余地があるが、公式財務が不足しているため、現時点では通常Aに数えない。",
        )

    if "イベント不足" in status:
        return (
            "根拠準備中（イベント不足）",
            "PENDING",
            blocker or f"イベント後反応が通常A基準未達。D20={d20}%",
            "決算後1日・5日・20営業日、6月イベント後、指数比を再取得する。",
            "財務だけでなく、実際に株価が買われたかを確認してから通常Aに入れる。",
        )

    return (
        "根拠準備中",
        "PENDING",
        blocker or failed,
        row.get("next_action", "不足データを埋めて再判定する。"),
        "現在の不足条件を埋めた後に、同じ通常A基準で再判定する。",
    )


def build_rows() -> list[dict[str, str]]:
    out: list[dict[str, str]] = []
    for row in read_csv(RECOVERY):
        group, countable, blocker, action, client = classify(row)
        out.append(
            {
                "priority": row.get("priority", ""),
                "ticker": row.get("ticker", ""),
                "name": row.get("name", ""),
                "current_status": row.get("current_status", ""),
                "promotion_group": group,
                "normal_a_countable": countable,
                "blocker": blocker,
                "evidence_to_add": row.get("missing_or_failed_gate", ""),
                "action": action,
                "client_explanation": client,
            }
        )
    return out


def write_html(rows: list[dict[str, str]]) -> None:
    counts = Counter(row["promotion_group"] for row in rows)
    normal = sum(1 for row in rows if row["normal_a_countable"] == "YES")
    pending = sum(1 for row in rows if row["normal_a_countable"] == "PENDING")
    no_count = sum(1 for row in rows if row["normal_a_countable"] == "NO")
    remaining = max(0, 15 - normal)

    cards = [
        ("通常A標準", f"{normal}/15社", "現時点で通常Aに数えられる銘柄"),
        ("残り必要数", f"{remaining}社", "15社にするために追加で通過が必要"),
        ("昇格作業中", f"{pending}社", "財務・イベント・質的根拠を埋めて再判定"),
        ("通常Aにしない", f"{no_count}社", "反証・過熱・期待値不足など"),
    ]
    card_html = "".join(
        f"<div class='card'><b>{esc(label)}</b><strong>{esc(value)}</strong><span>{esc(note)}</span></div>"
        for label, value, note in cards
    )

    body = []
    for row in rows[:45]:
        cls = "yes" if row["normal_a_countable"] == "YES" else "pending" if row["normal_a_countable"] == "PENDING" else "no"
        body.append(
            "<tr>"
            f"<td>{esc(row['priority'])}</td>"
            f"<td><b>{esc(row['ticker'])}</b><br>{esc(row['name'])}</td>"
            f"<td><span class='{cls}'>{esc(row['promotion_group'])}</span></td>"
            f"<td>{esc(row['blocker'])}</td>"
            f"<td>{esc(row['action'])}</td>"
            f"<td>{esc(row['client_explanation'])}</td>"
            "</tr>"
        )

    doc = f"""<!doctype html>
<html lang="ja">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>通常A標準15社 根拠準備 進捗</title>
  <style>
    body {{ margin:0; background:#f4f8fb; color:#071827; font-family:"Yu Gothic","Meiryo",sans-serif; font-size:18px; line-height:1.7; }}
    main {{ max-width:1500px; margin:0 auto; padding:24px; }}
    h1 {{ margin:0 0 10px; color:#003b63; font-size:34px; }}
    .lead {{ background:#fff; border:2px solid #bfd4e6; border-left:10px solid #006aa6; border-radius:12px; padding:16px; font-weight:900; font-size:20px; }}
    .cards {{ display:grid; grid-template-columns:repeat(4,minmax(0,1fr)); gap:12px; margin:18px 0; }}
    .card {{ background:#fff; border:2px solid #c5d8e9; border-radius:12px; padding:14px; }}
    .card b {{ display:block; color:#31506a; }}
    .card strong {{ display:block; font-size:30px; color:#003b63; }}
    .card span {{ display:block; color:#111; font-weight:700; }}
    table {{ width:100%; border-collapse:collapse; background:#fff; table-layout:fixed; }}
    th,td {{ border:1px solid #c9dbea; padding:10px; vertical-align:top; overflow-wrap:anywhere; }}
    th {{ background:#e6f2fb; color:#003b63; text-align:left; }}
    th:nth-child(1), td:nth-child(1) {{ width:48px; text-align:center; }}
    th:nth-child(2), td:nth-child(2) {{ width:170px; }}
    .yes,.pending,.no {{ display:inline-block; border-radius:999px; padding:5px 10px; font-weight:900; }}
    .yes {{ color:#00643b; background:#e4f7ed; }}
    .pending {{ color:#8a5200; background:#fff0cf; }}
    .no {{ color:#9b1c1c; background:#ffe2e2; }}
    .links a {{ display:inline-block; margin:0 8px 8px 0; padding:8px 12px; border:1px solid #80add0; border-radius:8px; color:#003b63; background:#fff; font-weight:900; text-decoration:none; }}
  </style>
</head>
<body>
<main>
  <h1>通常A標準15社 根拠準備 進捗</h1>
  <p class="lead">目的は、通常A標準を15社に見せかけることではなく、同じ基準を通過した銘柄だけを増やすことです。現時点では5社が通常A標準です。残り10社は、公式財務、イベント後反応、質的実績、過熱・下落耐性の不足を埋めた後に再判定します。</p>
  <p class="links">
    <a href="ultimate_selection_normal_a15_evidence_preparation_20260622.html">通常A判定表</a>
    <a href="ultimate_selection_normal_a15_recovery_queue_20260622.html">根拠回収キュー</a>
    <a href="ultimate_selection_normal_a15_universe_expansion_queue_20260622.html">母集団拡張キュー</a>
    <a href="ultimate_selection_system_20260618.html">システム本体へ戻る</a>
  </p>
  <div class="cards">{card_html}</div>
  <table>
    <thead><tr><th>#</th><th>銘柄</th><th>扱い</th><th>止まっている理由</th><th>次にやること</th><th>説明用コメント</th></tr></thead>
    <tbody>{''.join(body)}</tbody>
  </table>
</main>
</body>
</html>"""
    OUT_HTML.write_text(doc, encoding="utf-8")


def main() -> None:
    rows = build_rows()
    write_csv(rows)
    write_html(rows)
    print({"normal_a": sum(1 for r in rows if r["normal_a_countable"] == "YES"), "rows": len(rows)})


if __name__ == "__main__":
    main()
