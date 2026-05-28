import csv
from pathlib import Path

from reportlab.lib import colors
from reportlab.lib.enums import TA_LEFT
from reportlab.lib.pagesizes import A4, landscape
from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
from reportlab.lib.units import mm
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.cidfonts import UnicodeCIDFont
from reportlab.platypus import PageBreak, Paragraph, SimpleDocTemplate, Table, TableStyle

ROOT = Path.cwd()
HTML = ROOT / "selection_change_report_20260528.html"
PDF = ROOT / "selection_change_report_20260528.pdf"

pdfmetrics.registerFont(UnicodeCIDFont("HeiseiKakuGo-W5"))
FONT = "HeiseiKakuGo-W5"

CAPITAL = 2_000_000
SP_RATE = 10.0
TARGET_RATE = 15.0

NAMES = {
    "5803.T": ("フジクラ", "電線・通信"),
    "7011.T": ("三菱重工", "重工・防衛"),
    "8002.T": ("丸紅", "商社"),
    "6857.T": ("アドバンテスト", "半導体製造装置"),
    "8058.T": ("三菱商事", "商社"),
    "8053.T": ("住友商事", "商社"),
    "8031.T": ("三井物産", "商社"),
    "8306.T": ("三菱UFJ FG", "銀行"),
    "1605.T": ("INPEX", "資源・エネルギー"),
    "5802.T": ("住友電工", "電線・通信"),
}

# S&P500+5%（年率15%）を超えるための利益目標ゲート版。
# 高成長銘柄の比率が上がるため、通常版より値動きリスクも上がる。
WEIGHTS = {
    "5803.T": 25,
    "7011.T": 25,
    "8002.T": 10,
    "6857.T": 8,
    "8058.T": 7,
    "8053.T": 6,
    "8031.T": 5,
    "8306.T": 5,
    "1605.T": 4,
    "5802.T": 5,
}


def read_rows(name):
    with open(ROOT / name, encoding="utf-8", newline="") as f:
        return list(csv.reader(f))[1:]


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


long_by_ticker = {r[1]: r for r in read_rows("728_universe100_long_term_stability_score.csv")}


def metric(ticker):
    row = long_by_ticker[ticker]
    score = num(row[3])
    cagr5 = num(row[6])
    cagr10 = num(row[7])
    sp_diff = num(row[8])
    vol5 = num(row[10])
    max_dd = num(row[11])
    monthly = num(row[12])
    base = cagr5 * 0.6 + cagr10 * 0.4
    multiplier = 0.35
    corrections = ["過去実績65%割引"]
    if max_dd is not None and max_dd <= -45:
        multiplier *= 0.75
        corrections.append("大幅下落歴補正")
    if vol5 is not None and vol5 >= 40:
        multiplier *= 0.80
        corrections.append("高ボラ補正")
    if cagr5 is not None and cagr5 >= 70:
        multiplier *= 0.85
        corrections.append("急騰補正")
    practical = min(base * multiplier, 18)
    return {
        "score": score,
        "cagr5": cagr5,
        "cagr10": cagr10,
        "sp_diff": sp_diff,
        "vol5": vol5,
        "max_dd": max_dd,
        "monthly": monthly,
        "base": base,
        "practical": practical,
        "corrections": " / ".join(corrections),
    }


portfolio_rate = sum(metric(ticker)["practical"] * weight / 100 for ticker, weight in WEIGHTS.items())
profit_1y = CAPITAL * portfolio_rate / 100
sp_profit_1y = CAPITAL * SP_RATE / 100
target_profit_1y = CAPITAL * TARGET_RATE / 100

summary_rows = [
    {
        "項目": "修正理由",
        "説明": "継続安定版では年率10.4%で、S&P500+5%の年率15%目標に届かなかったため、利益目標ゲートで再選定した。",
    },
    {
        "項目": "新しい条件",
        "説明": "100社母集団から、保守補正後の実用年率が高い銘柄を優先。S&P500+5%を超える組み合わせになるように比率を再設計した。",
    },
    {
        "項目": "新10社の年率試算",
        "説明": f"今の10社を新しい比率で持った場合、保守補正後の年率試算は{pct(portfolio_rate)}。200万円では1年利益が約{yen(profit_1y)}。",
    },
    {
        "項目": "S&P500との比較",
        "説明": f"S&P500年率10%なら1年利益は{yen(sp_profit_1y)}。S&P500+5%の年率15%なら{yen(target_profit_1y)}。新10社は15%目標を約{yen(profit_1y - target_profit_1y)}上回る試算。",
    },
    {
        "項目": "注意点",
        "説明": "S&P+5%を超えるには、フジクラ・三菱重工など高成長銘柄の比率が高くなる。期待値は上がる一方、下落時の振れ幅も大きくなるため、6月イベント後の再確認を必須条件にする。",
    },
]

change_rows = [
    {
        "区分": "上げる",
        "銘柄": "5803 フジクラ / 7011 三菱重工 / 6857 アドバンテスト",
        "理由": "保守補正後でも実用年率が高く、S&P+5%の目標を超えるための主要寄与銘柄。",
    },
    {
        "区分": "残す",
        "銘柄": "8002 丸紅 / 8058 三菱商事 / 8053 住友商事 / 8031 三井物産 / 8306 三菱UFJ FG / 1605 INPEX / 5802 住友電工",
        "理由": "利益寄与、業種分散、S&P超過実績を補助する枠として残す。",
    },
    {
        "区分": "下げる",
        "銘柄": "8316 三井住友FG / 8766 東京海上HD / 8001 伊藤忠 / 6501 日立 / 5801 古河電工",
        "理由": "安定性はあるが、S&P+5%目標の利益寄与では相対的に弱いため、今回の利益目標ゲート版では外す。",
    },
]

selection_rows = []
for rank, (ticker, weight) in enumerate(WEIGHTS.items(), start=1):
    company, industry = NAMES[ticker]
    m = metric(ticker)
    selection_rows.append({
        "順位": str(rank),
        "銘柄": f"{ticker} {company}",
        "業種": industry,
        "比率": f"{weight}%",
        "継続期待": pct(m["score"]),
        "実用年率": pct(m["practical"]),
        "5年CAGR": pct(m["cagr5"]),
        "10年CAGR": pct(m["cagr10"]),
        "S&P差": pct(m["sp_diff"]),
        "最大下落": pct(m["max_dd"]),
        "補正": m["corrections"],
    })

projection_rows = []
for year in range(1, 11):
    portfolio_value = CAPITAL * ((1 + portfolio_rate / 100) ** year)
    sp_value = CAPITAL * ((1 + SP_RATE / 100) ** year)
    target_value = CAPITAL * ((1 + TARGET_RATE / 100) ** year)
    projection_rows.append({
        "年数": f"{year}年後",
        "新10社": yen(portfolio_value),
        "S&P500 10%": yen(sp_value),
        "S&Pとの差": yen(portfolio_value - sp_value),
        "S&P+5% 15%": yen(target_value),
        "+5%目標との差": yen(portfolio_value - target_value),
    })


def html_table(headers, rows):
    head = "".join(f"<th>{esc(h)}</th>" for h in headers)
    body = "".join("<tr>" + "".join(f"<td>{esc(row[h])}</td>" for h in headers) + "</tr>" for row in rows)
    return f"<table><thead><tr>{head}</tr></thead><tbody>{body}</tbody></table>"


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
    <div class="card"><b>再選定後</b><span class="value">{pct(portfolio_rate)}</span><p>新10社の年率試算</p></div>
    <div class="card"><b>S&P+5%目標</b><span class="value">15%</span><p>今回の目標ライン</p></div>
    <div class="card"><b>200万円利益</b><span class="value">{yen(profit_1y)}</span><p>1年試算</p></div>
    <div class="card"><b>目標との差</b><span class="value">{yen(profit_1y - target_profit_1y)}</span><p>S&P+5%比</p></div>
  </div>
  <h2>1. 保守補正後でもS&P+5%を超える組み合わせ</h2>
  {html_table(["項目", "説明"], summary_rows)}
  <h2>2. 選定銘柄の入れ替え</h2>
  {html_table(["区分", "銘柄", "理由"], change_rows)}
  <h2>3. 新10社の数値</h2>
  {html_table(["順位", "銘柄", "業種", "比率", "継続期待", "実用年率", "5年CAGR", "10年CAGR", "S&P差", "最大下落", "補正"], selection_rows)}
  <h2>4. 1年後〜10年後のS&P500比較試算</h2>
  <p class="note">前提は、新10社を上記比率で持った場合の年率試算{pct(portfolio_rate)}、S&P500を年率10%、目標ラインをS&P500+5%の年率15%とした複利計算です。</p>
  {html_table(["年数", "新10社", "S&P500 10%", "S&Pとの差", "S&P+5% 15%", "+5%目標との差"], projection_rows)}
  <h2>5. 現時点の扱い</h2>
  <p class="note">再選定後は、S&P500 10%だけでなく、S&P500+5%の15%目標も上回る試算になりました。ただし、これは過去データを使った確認値です。高成長銘柄への比率が上がるため、6月のCPI、日銀、FOMC後に市場環境を入れて再判定します。</p>
</section>
</body>
</html>"""

HTML.write_text(html, encoding="utf-8")

styles = getSampleStyleSheet()
base = ParagraphStyle("jp", parent=styles["Normal"], fontName=FONT, fontSize=8.6, leading=12.0, alignment=TA_LEFT)
title = ParagraphStyle("title", parent=base, fontSize=20, leading=25, textColor=colors.HexColor("#123d63"), spaceAfter=8)
h = ParagraphStyle("h", parent=base, fontSize=13, leading=17, textColor=colors.HexColor("#123d63"), spaceBefore=8, spaceAfter=5)
note = ParagraphStyle("note", parent=base, backColor=colors.HexColor("#fff8ec"), borderColor=colors.HexColor("#a85b00"), borderWidth=0.8, borderPadding=6, spaceAfter=7)


def p(text, style=base):
    safe = str(text).replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;").replace("\n", "<br/>")
    return Paragraph(safe, style)


def pdf_table(headers, rows, widths):
    data = [[p(h) for h in headers]] + [[p(row[h]) for h in headers] for row in rows]
    t = Table(data, colWidths=widths, repeatRows=1)
    t.setStyle(TableStyle([
        ("FONTNAME", (0, 0), (-1, -1), FONT),
        ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#e6f1fb")),
        ("TEXTCOLOR", (0, 0), (-1, 0), colors.HexColor("#123d63")),
        ("GRID", (0, 0), (-1, -1), 0.45, colors.HexColor("#cbd8e6")),
        ("VALIGN", (0, 0), (-1, -1), "TOP"),
        ("LEFTPADDING", (0, 0), (-1, -1), 3.5),
        ("RIGHTPADDING", (0, 0), (-1, -1), 3.5),
        ("TOPPADDING", (0, 0), (-1, -1), 3.5),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 3.5),
    ]))
    return t


story = [
    p("5月28日 作業報告", title),
    p("1. 保守補正後でもS&P+5%を超える組み合わせ", h),
    pdf_table(["項目", "説明"], summary_rows, [48 * mm, 224 * mm]),
    p("2. 選定銘柄の入れ替え", h),
    pdf_table(["区分", "銘柄", "理由"], change_rows, [25 * mm, 120 * mm, 127 * mm]),
    PageBreak(),
    p("3. 新10社の数値", h),
    pdf_table(["順位", "銘柄", "業種", "比率", "継続期待", "実用年率", "5年CAGR", "10年CAGR", "S&P差", "最大下落", "補正"], selection_rows, [12 * mm, 34 * mm, 24 * mm, 15 * mm, 22 * mm, 22 * mm, 22 * mm, 22 * mm, 19 * mm, 20 * mm, 60 * mm]),
    PageBreak(),
    p("4. 1年後〜10年後のS&P500比較試算", h),
    p(f"前提は、新10社を上記比率で持った場合の年率試算{pct(portfolio_rate)}、S&P500を年率10%、目標ラインをS&P500+5%の年率15%とした複利計算です。", note),
    pdf_table(["年数", "新10社", "S&P500 10%", "S&Pとの差", "S&P+5% 15%", "+5%目標との差"], projection_rows, [22 * mm, 45 * mm, 45 * mm, 40 * mm, 45 * mm, 45 * mm]),
    p("5. 現時点の扱い", h),
    p("再選定後は、S&P500 10%だけでなく、S&P500+5%の15%目標も上回る試算になりました。ただし、これは過去データを使った確認値です。高成長銘柄への比率が上がるため、6月のCPI、日銀、FOMC後に市場環境を入れて再判定します。", note),
]

doc = SimpleDocTemplate(str(PDF), pagesize=landscape(A4), rightMargin=10 * mm, leftMargin=10 * mm, topMargin=10 * mm, bottomMargin=10 * mm)


def set_pdf_title(canvas, _doc):
    canvas.setTitle("5月28日 作業報告")


doc.build(story, onFirstPage=set_pdf_title, onLaterPages=set_pdf_title)
print(PDF)
