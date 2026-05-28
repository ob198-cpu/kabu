import csv
from pathlib import Path

from reportlab.lib import colors
from reportlab.lib.enums import TA_LEFT
from reportlab.lib.pagesizes import A4, landscape
from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
from reportlab.lib.units import mm
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.cidfonts import UnicodeCIDFont
from reportlab.platypus import Paragraph, SimpleDocTemplate, Spacer, Table, TableStyle

ROOT = Path(__file__).resolve().parents[1]
CSV = ROOT / "785_integrated_recalculated_10_20260528.csv"
HTML = ROOT / "selection_change_report_20260528.html"
PDF = ROOT / "selection_change_report_20260528.pdf"
CORRECTED_HTML = ROOT / "selection_change_report_20260528_corrected.html"
CORRECTED_PDF = ROOT / "selection_change_report_20260528_corrected.pdf"
RESELECTED_PDF = ROOT / "selection_change_report_20260528_reselected.pdf"


def read_rows(path):
    with path.open(encoding="utf-8-sig", newline="") as f:
        return list(csv.DictReader(f))


def num(value):
    text = str(value or "").replace(",", "").replace("%", "").strip()
    if not text:
        return None
    try:
        return float(text)
    except ValueError:
        return None


def fmt(value, suffix="", digits=1):
    n = num(value) if isinstance(value, str) else value
    if n is None:
        return "未取得"
    text = f"{n:.{digits}f}".rstrip("0").rstrip(".")
    return f"{text}{suffix}"


def esc(value):
    return (
        str(value or "")
        .replace("&", "&amp;")
        .replace("<", "&lt;")
        .replace(">", "&gt;")
        .replace('"', "&quot;")
    )


def yen(value):
    return f"{round(value):,}円"


def html_table(headers, rows):
    head = "".join(f"<th>{esc(h)}</th>" for h in headers)
    body = "".join(
        "<tr>" + "".join(f"<td>{esc(row.get(h, ''))}</td>" for h in headers) + "</tr>"
        for row in rows
    )
    return f"<table><thead><tr>{head}</tr></thead><tbody>{body}</tbody></table>"


rows = read_rows(CSV)

summary_rows = [
    {
        "項目": "本日の修正内容",
        "内容": "昨日までの既存選定スコアと、今朝追加した長期安定性・S&P比較・下落耐性を同じ表に並べ、4項目合計で再計算した。",
    },
    {
        "項目": "計算式",
        "内容": "総合スコア = 既存選定スコア + 長期安定性 + S&P比較 + 下落耐性。表では4項目合計と100点換算を併記。",
    },
    {
        "項目": "前回資料との差し替え理由",
        "内容": "今朝追加した指標だけで候補が置き換わって見える表現を避けるため、既存スコアを同じ表に戻して統合再計算した。",
    },
    {
        "項目": "現在の扱い",
        "内容": "購入確定ではなく、6月の市場イベント後に再判定するための候補比較表。",
    },
]

top_rows = [
    {
        "順位": row["統合10社順位"],
        "銘柄": f"{row['コード']} {row['銘柄']}",
        "4項目合計": row["4項目合計"],
        "100点換算": row["総合スコア100点換算"],
        "既存": row["既存選定スコア"],
        "長期": row["長期安定性"],
        "S&P": row["S&P比較"],
        "下落耐性": row["下落耐性"],
        "区分": row["旧候補"] or "新規浮上",
    }
    for row in rows
]

detail_rows = [
    {
        "順位": row["統合10社順位"],
        "銘柄": f"{row['コード']} {row['銘柄']}",
        "5年CAGR": fmt(row["5年CAGR"], "%"),
        "10年CAGR": fmt(row["10年CAGR"], "%"),
        "5年S&P差": fmt(row["5年S&P差"], "%"),
        "1年S&P差": fmt(row["直近1年S&P差"], "%"),
        "5年最大下落": fmt(row["5年最大下落"], "%"),
        "1年最大下落": fmt(row["直近1年最大下落"], "%"),
    }
    for row in rows
]

capital = 2_000_000
avg_5y = sum(num(row["5年CAGR"]) or 0 for row in rows) / len(rows)
avg_10y = sum(num(row["10年CAGR"]) or 0 for row in rows) / len(rows)
sp_rate = 10.0
target_rate = 15.0
projection_rows = []
for year in range(1, 11):
    selected_value = capital * ((1 + avg_10y / 100) ** year)
    sp_value = capital * ((1 + sp_rate / 100) ** year)
    target_value = capital * ((1 + target_rate / 100) ** year)
    projection_rows.append(
        {
            "年数": f"{year}年後",
            "10社過去10年ペース": yen(selected_value),
            "S&P500 10%": yen(sp_value),
            "S&Pとの差": yen(selected_value - sp_value),
            "S&P+5% 15%": yen(target_value),
            "+5%との差": yen(selected_value - target_value),
        }
    )

html = f"""<!doctype html>
<html lang="ja">
<head>
  <meta charset="utf-8">
  <title>5月28日 作業報告 修正版</title>
  <style>
    @page {{ size: A4 landscape; margin: 10mm; }}
    * {{ box-sizing: border-box; }}
    body {{ margin:0; font-family:"Meiryo","Yu Gothic",Arial,sans-serif; color:#050b14; line-height:1.56; font-size:13px; }}
    section {{ max-width:1180px; margin:0 auto; padding:24px; }}
    h1 {{ color:#123d63; font-size:30px; margin:0 0 8px; }}
    h2 {{ color:#123d63; border-left:7px solid #0b5f96; padding-left:10px; margin:22px 0 10px; }}
    .note {{ border-left:6px solid #a85b00; background:#fff8ec; padding:12px; margin:12px 0; }}
    .cards {{ display:grid; grid-template-columns:repeat(4,1fr); gap:10px; margin:14px 0; }}
    .card {{ border:1px solid #cbd8e6; background:#f8fbff; border-radius:8px; padding:12px; }}
    .value {{ display:block; color:#0b5f96; font-size:25px; font-weight:900; }}
    table {{ width:100%; border-collapse:collapse; table-layout:fixed; margin:8px 0 16px; }}
    th,td {{ border:1px solid #cbd8e6; padding:7px; vertical-align:top; overflow-wrap:break-word; }}
    th {{ background:#e6f1fb; color:#123d63; text-align:left; }}
    @media print {{
      table, tr, td, th, .card, .note {{ break-inside: avoid; page-break-inside: avoid; }}
      thead {{ display: table-header-group; }}
    }}
  </style>
</head>
<body>
<section>
  <h1>5月28日 作業報告 修正版</h1>
  <div class="cards">
    <div class="card"><b>対象</b><span class="value">100社</span><p>母集団から比較</p></div>
    <div class="card"><b>候補</b><span class="value">10社</span><p>統合再計算後</p></div>
    <div class="card"><b>計算</b><span class="value">4項目</span><p>既存・長期・S&P・下落耐性</p></div>
    <div class="card"><b>扱い</b><span class="value">再判定</span><p>6月イベント後に確認</p></div>
  </div>
  <p class="note">本資料は差し替え版です。候補を今朝追加した指標だけで置き換えるのではなく、昨日までの既存選定スコアと追加指標を同じ表に並べて再計算しています。</p>
  <h2>1. 修正内容</h2>
  {html_table(["項目", "内容"], summary_rows)}
  <h2>2. 統合再計算後の10社</h2>
  {html_table(["順位", "銘柄", "4項目合計", "100点換算", "既存", "長期", "S&P", "下落耐性", "区分"], top_rows)}
  <h2>3. 追加指標の内訳</h2>
  {html_table(["順位", "銘柄", "5年CAGR", "10年CAGR", "5年S&P差", "1年S&P差", "5年最大下落", "1年最大下落"], detail_rows)}
  <h2>4. S&P500比較の参考試算</h2>
  <p class="note">下表は、10社の過去10年CAGR単純平均が続いた場合の参考比較です。将来の利益を保証するものではありません。</p>
  {html_table(["年数", "10社過去10年ペース", "S&P500 10%", "S&Pとの差", "S&P+5% 15%", "+5%との差"], projection_rows)}
</section>
</body>
</html>"""

HTML.write_text(html, encoding="utf-8")
CORRECTED_HTML.write_text(html, encoding="utf-8")

pdfmetrics.registerFont(UnicodeCIDFont("HeiseiKakuGo-W5"))
FONT = "HeiseiKakuGo-W5"
styles = getSampleStyleSheet()
base = ParagraphStyle("jp", parent=styles["Normal"], fontName=FONT, fontSize=7.4, leading=10.2, alignment=TA_LEFT)
title = ParagraphStyle("title", parent=base, fontSize=19, leading=24, textColor=colors.HexColor("#123d63"), spaceAfter=6)
heading = ParagraphStyle("heading", parent=base, fontSize=12, leading=15, textColor=colors.HexColor("#123d63"), spaceBefore=8, spaceAfter=5)
note = ParagraphStyle("note", parent=base, backColor=colors.HexColor("#fff8ec"), borderColor=colors.HexColor("#a85b00"), borderWidth=0.8, borderPadding=6, spaceAfter=6)


def p(text, style=base):
    safe = esc(text).replace("\n", "<br/>")
    return Paragraph(safe, style)


def pdf_table(headers, table_rows, widths):
    data = [[p(header) for header in headers]]
    for row in table_rows:
        data.append([p(row.get(header, "")) for header in headers])
    tbl = Table(data, colWidths=widths, repeatRows=1)
    tbl.setStyle(
        TableStyle(
            [
                ("FONTNAME", (0, 0), (-1, -1), FONT),
                ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#e6f1fb")),
                ("TEXTCOLOR", (0, 0), (-1, 0), colors.HexColor("#123d63")),
                ("GRID", (0, 0), (-1, -1), 0.35, colors.HexColor("#cbd8e6")),
                ("VALIGN", (0, 0), (-1, -1), "TOP"),
                ("LEFTPADDING", (0, 0), (-1, -1), 3),
                ("RIGHTPADDING", (0, 0), (-1, -1), 3),
                ("TOPPADDING", (0, 0), (-1, -1), 3),
                ("BOTTOMPADDING", (0, 0), (-1, -1), 3),
            ]
        )
    )
    return tbl


def build_story():
    return [
        p("5月28日 作業報告 修正版", title),
        p("本資料は差し替え版です。昨日までの既存選定スコアと、今朝追加した長期安定性・S&P比較・下落耐性を同じ表に並べ、4項目合計で再計算しています。", note),
        p("1. 修正内容", heading),
        pdf_table(["項目", "内容"], summary_rows, [38 * mm, 220 * mm]),
        Spacer(1, 5),
        p("2. 統合再計算後の10社", heading),
        pdf_table(["順位", "銘柄", "4項目合計", "100点換算", "既存", "長期", "S&P", "下落耐性", "区分"], top_rows, [13 * mm, 55 * mm, 24 * mm, 25 * mm, 18 * mm, 18 * mm, 18 * mm, 22 * mm, 24 * mm]),
        Spacer(1, 5),
        p("3. 追加指標の内訳", heading),
        pdf_table(["順位", "銘柄", "5年CAGR", "10年CAGR", "5年S&P差", "1年S&P差", "5年最大下落", "1年最大下落"], detail_rows, [13 * mm, 58 * mm, 25 * mm, 25 * mm, 25 * mm, 25 * mm, 30 * mm, 30 * mm]),
        Spacer(1, 5),
        p("4. S&P500比較の参考試算", heading),
        p("10社の過去10年CAGR単純平均が続いた場合の参考比較です。将来の利益を保証するものではありません。", note),
        pdf_table(["年数", "10社過去10年ペース", "S&P500 10%", "S&Pとの差", "S&P+5% 15%", "+5%との差"], projection_rows, [18 * mm, 45 * mm, 40 * mm, 42 * mm, 42 * mm, 42 * mm]),
    ]

for out in [PDF, CORRECTED_PDF, RESELECTED_PDF]:
    doc = SimpleDocTemplate(
        str(out),
        pagesize=landscape(A4),
        leftMargin=10 * mm,
        rightMargin=10 * mm,
        topMargin=10 * mm,
        bottomMargin=10 * mm,
    )
    doc.build(build_story())

print(f"wrote {HTML.name}")
print(f"wrote {CORRECTED_HTML.name}")
print(f"wrote {PDF.name}")
print(f"wrote {CORRECTED_PDF.name}")
print(f"wrote {RESELECTED_PDF.name}")
