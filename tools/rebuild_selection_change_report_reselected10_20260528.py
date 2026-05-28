import csv
from pathlib import Path

from reportlab.lib import colors
from reportlab.lib.enums import TA_LEFT
from reportlab.lib.pagesizes import A4, landscape
from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
from reportlab.lib.units import mm
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.cidfonts import UnicodeCIDFont
from reportlab.platypus import Paragraph, SimpleDocTemplate, Table, TableStyle

ROOT = Path(__file__).resolve().parents[1]
HTML = ROOT / "selection_change_report_20260528.html"
PDF = ROOT / "selection_change_report_20260528.pdf"
CSV = ROOT / "782_reselected_10_candidates_20260528.csv"

CAPITAL = 2_000_000
SP_RATE = 10.0
TARGET_RATE = 15.0
EQUAL_WEIGHT = 10.0

INDUSTRIES = {
    "8053.T": "商社",
    "8002.T": "商社",
    "8058.T": "商社",
    "8316.T": "銀行",
    "8306.T": "銀行",
    "1605.T": "資源・エネルギー",
    "6503.T": "総合電機",
    "8031.T": "商社",
    "8411.T": "銀行",
    "8725.T": "保険",
}


def read_dicts(path):
    with path.open(encoding="utf-8-sig", newline="") as f:
        return list(csv.DictReader(f))


def num(value):
    try:
        text = str(value or "").replace(",", "").replace("%", "").strip()
        return float(text) if text else None
    except ValueError:
        return None


def pct(value, digits=1):
    if value is None:
        return "未取得"
    return f"{value:.{digits}f}".rstrip("0").rstrip(".") + "%"


def yen(value):
    return f"{round(value):,}円"


def esc(value):
    return (
        str(value)
        .replace("&", "&amp;")
        .replace("<", "&lt;")
        .replace(">", "&gt;")
        .replace('"', "&quot;")
    )


def html_table(headers, rows):
    head = "".join(f"<th>{esc(h)}</th>" for h in headers)
    body = "".join(
        "<tr>" + "".join(f"<td>{esc(row.get(h, ''))}</td>" for h in headers) + "</tr>"
        for row in rows
    )
    return f"<table><thead><tr>{head}</tr></thead><tbody>{body}</tbody></table>"


rows = read_dicts(CSV)[:10]

portfolio_5y_rate = sum(num(row["5年CAGR"]) * EQUAL_WEIGHT / 100 for row in rows)
portfolio_10y_rate = sum(num(row["10年CAGR"]) * EQUAL_WEIGHT / 100 for row in rows)

work_rows = [
    {
        "項目": "本日の作業",
        "内容": "NISA 1年保有テストに向けて、候補10社を比較するための実データ指標を追加・整理した。",
    },
    {
        "項目": "追加した指標",
        "内容": "過去5年CAGR、過去10年CAGR、S&P500との差、最大下落率、ボラティリティを候補比較に追加した。",
    },
    {
        "項目": "選定への反映",
        "内容": "単純な過去上昇率だけでなく、S&P500を上回っていたか、途中下落が大きすぎないかも見える形にした。",
    },
    {
        "項目": "本日の成果",
        "内容": f"修正後10社は、過去5年ペースで{pct(portfolio_5y_rate)}、過去10年ペースで{pct(portfolio_10y_rate)}。これは予測ではなく、過去実績の確認値として扱う。",
    },
]

indicator_rows = [
    {
        "指標": "過去5年CAGR",
        "足した理由": "直近テーマや時流がどの程度株価に反映されていたかを確認するため。",
        "結果": f"修正後10社の加重平均は{pct(portfolio_5y_rate)}。S&P+5%の15%ラインは過去実績では上回っている。",
    },
    {
        "指標": "過去10年CAGR",
        "足した理由": "一時的なブームだけでなく、長めの期間で伸びているかを確認するため。",
        "結果": f"修正後10社の加重平均は{pct(portfolio_10y_rate)}。過去10年でも15%ラインを上回っている。",
    },
    {
        "指標": "最大下落率",
        "足した理由": "NISAの1年保有では、途中の大きな下落に耐えられるかが重要なため。",
        "結果": "大幅下落歴のある銘柄は、補正欄に明示し、同じ上昇率でもリスク確認対象として扱う。",
    },
    {
        "指標": "S&P500との差",
        "足した理由": "S&P500を上回れないなら個別株を選ぶ意味が薄いため。",
        "結果": "各銘柄の過去S&P差を確認し、ポートフォリオ全体でもS&P+5%ラインと比較した。",
    },
]

selection_rows = []
for row in rows:
    ticker = row["コード"]
    selection_rows.append(
        {
            "順位": row["再選定順位"],
            "銘柄": f"{ticker} {row['銘柄']}",
            "業種": INDUSTRIES.get(ticker, ""),
            "比率": f"{EQUAL_WEIGHT:.0f}%",
            "継続期待": pct(num(row["再選定点"])),
            "5年CAGR": pct(num(row["5年CAGR"])),
            "10年CAGR": pct(num(row["10年CAGR"])),
            "S&P差": pct(num(row["5年S&P差"])),
            "最大下落": pct(num(row["5年最大下落率"])),
            "確認事項": row.get("確認事項", ""),
        }
    )

projection_rows = []
for year in range(1, 11):
    past10_value = CAPITAL * ((1 + portfolio_10y_rate / 100) ** year)
    sp_value = CAPITAL * ((1 + SP_RATE / 100) ** year)
    target_value = CAPITAL * ((1 + TARGET_RATE / 100) ** year)
    projection_rows.append(
        {
            "年数": f"{year}年後",
            "過去10年ペース": yen(past10_value),
            "S&P500 10%": yen(sp_value),
            "S&Pとの差": yen(past10_value - sp_value),
            "S&P+5% 15%": yen(target_value),
            "+5%ラインとの差": yen(past10_value - target_value),
        }
    )

html = f"""<!doctype html>
<html lang="ja">
<head>
  <meta charset="utf-8">
  <title>5月28日 作業報告</title>
  <style>
    @page {{ size: A4 landscape; margin: 10mm; }}
    * {{ box-sizing: border-box; }}
    body {{ margin:0; font-family:"Noto Sans JP","Meiryo","Yu Gothic",Arial,sans-serif; color:#050b14; line-height:1.58; font-size:14px; }}
    section {{ max-width:1180px; margin:0 auto; padding:28px; }}
    h1 {{ color:#123d63; font-size:30px; margin:0 0 10px; }}
    h2 {{ color:#123d63; border-left:7px solid #0b5f96; padding-left:10px; margin:24px 0 10px; }}
    .note {{ border-left:6px solid #a85b00; background:#fff8ec; padding:12px; margin:12px 0; }}
    .cards {{ display:grid; grid-template-columns:repeat(4,1fr); gap:10px; margin:16px 0; }}
    .card {{ border:1px solid #cbd8e6; background:#f8fbff; border-radius:8px; padding:12px; }}
    .value {{ display:block; color:#0b5f96; font-size:26px; font-weight:900; }}
    table {{ width:100%; border-collapse:collapse; table-layout:fixed; margin:10px 0 18px; }}
    th,td {{ border:1px solid #cbd8e6; padding:8px; vertical-align:top; overflow-wrap:break-word; }}
    th {{ background:#e6f1fb; color:#123d63; text-align:left; }}
    @media print {{
      section, table, tr, td, th, .card, .note {{ break-inside: avoid; page-break-inside: avoid; }}
      thead {{ display: table-header-group; }}
    }}
  </style>
</head>
<body>
<section>
  <h1>5月28日 作業報告</h1>
  <div class="cards">
    <div class="card"><b>比較対象</b><span class="value">10社</span><p>NISA 1年保有テスト候補</p></div>
    <div class="card"><b>過去5年</b><span class="value">{pct(portfolio_5y_rate)}</span><p>加重平均CAGR</p></div>
    <div class="card"><b>過去10年</b><span class="value">{pct(portfolio_10y_rate)}</span><p>加重平均CAGR</p></div>
    <div class="card"><b>S&P+5%</b><span class="value">15%</span><p>比較ライン</p></div>
  </div>
  <p class="note">本資料は、候補10社の選定に使う比較指標を追加し、S&P500との比較と下落リスクを確認できる形に整理した作業報告です。過去5年・10年の実績は将来予測ではなく、候補比較のための確認値として扱います。</p>
  <h2>1. 本日の作業内容</h2>
  {html_table(["項目", "内容"], work_rows)}
  <h2>2. 追加指標の理由と結果</h2>
  {html_table(["指標", "足した理由", "結果"], indicator_rows)}
  <h2>3. 修正後10社の数値</h2>
  {html_table(["順位", "銘柄", "業種", "比率", "継続期待", "5年CAGR", "10年CAGR", "S&P差", "最大下落", "確認事項"], selection_rows)}
  <h2>4. 1年後〜10年後のS&P500比較表</h2>
  <p class="note">下表は、過去10年CAGRの加重平均が続いた場合の参考比較です。将来予測ではありません。今後、過去時点から選定した場合の1年後成績を検証します。</p>
  {html_table(["年数", "過去10年ペース", "S&P500 10%", "S&Pとの差", "S&P+5% 15%", "+5%ラインとの差"], projection_rows)}
</section>
</body>
</html>"""

HTML.write_text(html, encoding="utf-8")

pdfmetrics.registerFont(UnicodeCIDFont("HeiseiKakuGo-W5"))
FONT = "HeiseiKakuGo-W5"
styles = getSampleStyleSheet()
base = ParagraphStyle("jp", parent=styles["Normal"], fontName=FONT, fontSize=8.0, leading=10.8, alignment=TA_LEFT)
title = ParagraphStyle("title", parent=base, fontSize=20, leading=25, textColor=colors.HexColor("#123d63"), spaceAfter=8)
h = ParagraphStyle("h", parent=base, fontSize=13, leading=17, textColor=colors.HexColor("#123d63"), spaceBefore=8, spaceAfter=5)
note = ParagraphStyle("note", parent=base, backColor=colors.HexColor("#fff8ec"), borderColor=colors.HexColor("#a85b00"), borderWidth=0.8, borderPadding=6, spaceAfter=7)


def p(text, style=base):
    safe = str(text).replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;").replace("\n", "<br/>")
    return Paragraph(safe, style)


def pdf_table(headers, rows, col_widths=None):
    data = [[p(h) for h in headers]]
    for row in rows:
        data.append([p(row.get(h, "")) for h in headers])
    table = Table(data, colWidths=col_widths, repeatRows=1)
    table.setStyle(
        TableStyle(
            [
                ("FONTNAME", (0, 0), (-1, -1), FONT),
                ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#e6f1fb")),
                ("TEXTCOLOR", (0, 0), (-1, 0), colors.HexColor("#123d63")),
                ("GRID", (0, 0), (-1, -1), 0.4, colors.HexColor("#cbd8e6")),
                ("VALIGN", (0, 0), (-1, -1), "TOP"),
                ("LEFTPADDING", (0, 0), (-1, -1), 4),
                ("RIGHTPADDING", (0, 0), (-1, -1), 4),
                ("TOPPADDING", (0, 0), (-1, -1), 4),
                ("BOTTOMPADDING", (0, 0), (-1, -1), 4),
            ]
        )
    )
    return table


doc = SimpleDocTemplate(
    str(PDF),
    pagesize=landscape(A4),
    leftMargin=10 * mm,
    rightMargin=10 * mm,
    topMargin=10 * mm,
    bottomMargin=10 * mm,
)

story = [
    p("5月28日 作業報告", title),
    p(
        f"比較対象: 10社 / 過去5年: {pct(portfolio_5y_rate)} / 過去10年: {pct(portfolio_10y_rate)} / S&P+5%比較ライン: 15%",
        note,
    ),
    p("本資料は、候補10社の選定に使う比較指標を追加し、S&P500との比較と下落リスクを確認できる形に整理した作業報告です。過去5年・10年の実績は将来予測ではなく、候補比較のための確認値として扱います。", base),
    p("1. 本日の作業内容", h),
    pdf_table(["項目", "内容"], work_rows, [38 * mm, 230 * mm]),
    p("2. 追加指標の理由と結果", h),
    pdf_table(["指標", "足した理由", "結果"], indicator_rows, [38 * mm, 112 * mm, 118 * mm]),
    p("3. 修正後10社の数値", h),
    pdf_table(
        ["順位", "銘柄", "業種", "比率", "継続期待", "5年CAGR", "10年CAGR", "S&P差", "最大下落", "確認事項"],
        selection_rows,
        [13 * mm, 39 * mm, 25 * mm, 15 * mm, 22 * mm, 22 * mm, 22 * mm, 20 * mm, 22 * mm, 68 * mm],
    ),
    p("4. 1年後〜10年後のS&P500比較表", h),
    p("下表は、過去10年CAGRの加重平均が続いた場合の参考比較です。将来予測ではありません。今後、過去時点から選定した場合の1年後成績を検証します。", base),
    pdf_table(
        ["年数", "過去10年ペース", "S&P500 10%", "S&Pとの差", "S&P+5% 15%", "+5%ラインとの差"],
        projection_rows,
        [24 * mm, 50 * mm, 46 * mm, 46 * mm, 50 * mm, 52 * mm],
    ),
]

doc.build(story)

print(f"wrote {HTML.name}")
print(f"wrote {PDF.name}")
