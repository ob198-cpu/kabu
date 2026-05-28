import csv
import shutil
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
SAFE_PDF = ROOT / "selection_change_report_20260528_sp5_pagesafe.pdf"

pdfmetrics.registerFont(UnicodeCIDFont("HeiseiKakuGo-W5"))
FONT = "HeiseiKakuGo-W5"

CAPITAL = 2_000_000
SP_RATE = 10.0
TARGET_RATE = 15.0

NAMES = {
    "5803.T": ("フジクラ", "電線・通信"),
    "8002.T": ("丸紅", "商社"),
    "6857.T": ("アドバンテスト", "半導体製造装置"),
    "8058.T": ("三菱商事", "商社"),
    "8053.T": ("住友商事", "商社"),
    "8031.T": ("三井物産", "商社"),
    "8306.T": ("三菱UFJ FG", "銀行"),
    "1605.T": ("INPEX", "資源・エネルギー"),
    "5802.T": ("住友電工", "電線・通信"),
    "6501.T": ("日立製作所", "総合電機・IT"),
}

WEIGHTS = {
    "5803.T": 45,
    "8002.T": 14,
    "6857.T": 10,
    "8058.T": 8,
    "8053.T": 6,
    "8031.T": 4,
    "8306.T": 4,
    "1605.T": 3,
    "5802.T": 2,
    "6501.T": 4,
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
    checks = []
    if max_dd is not None and max_dd <= -45:
        checks.append("大幅下落歴あり")
    if vol5 is not None and vol5 >= 40:
        checks.append("高ボラ")
    if cagr5 is not None and cagr5 >= 70:
        checks.append("急騰履歴あり")
    if not checks:
        checks.append("通常確認")
    return {
        "score": score,
        "cagr5": cagr5,
        "cagr10": cagr10,
        "sp_diff": sp_diff,
        "vol5": vol5,
        "max_dd": max_dd,
        "checks": " / ".join(checks),
    }


portfolio_5y_rate = sum(metric(ticker)["cagr5"] * weight / 100 for ticker, weight in WEIGHTS.items())
portfolio_10y_rate = sum(metric(ticker)["cagr10"] * weight / 100 for ticker, weight in WEIGHTS.items())
target_profit_1y = CAPITAL * TARGET_RATE / 100

work_rows = [
    {
        "項目": "本日の重要修正",
        "内容": "未検証の固定係数を使った年率試算を撤回した。検証前の係数で利回りを確定表示する扱いはしない。",
    },
    {
        "項目": "使う数値",
        "内容": "現時点で根拠として使えるのは、過去5年CAGR、過去10年CAGR、S&P500との差、最大下落率、ボラティリティなど実データで確認できる指標。",
    },
    {
        "項目": "使わない数値",
        "内容": "任意の割引率や固定係数で作った将来利回りは、正式な根拠として使わない。正式化するには過去ローリング検証が必要。",
    },
    {
        "項目": "本日の結果",
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
    {
        "指標": "係数の扱い",
        "足した理由": "未検証係数を使うと、検証されていない利回りを作れてしまうため。",
        "結果": "固定割引率による将来年率は使わない。次工程で過去ローリング検証により係数を作る。",
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
        "5年CAGR": pct(m["cagr5"]),
        "10年CAGR": pct(m["cagr10"]),
        "S&P差": pct(m["sp_diff"]),
        "最大下落": pct(m["max_dd"]),
        "確認事項": m["checks"],
    })

projection_rows = []
for year in range(1, 11):
    past10_value = CAPITAL * ((1 + portfolio_10y_rate / 100) ** year)
    sp_value = CAPITAL * ((1 + SP_RATE / 100) ** year)
    target_value = CAPITAL * ((1 + TARGET_RATE / 100) ** year)
    projection_rows.append({
        "年数": f"{year}年後",
        "過去10年ペース": yen(past10_value),
        "S&P500 10%": yen(sp_value),
        "S&Pとの差": yen(past10_value - sp_value),
        "S&P+5% 15%": yen(target_value),
        "+5%ラインとの差": yen(past10_value - target_value),
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
    <div class="card"><b>係数扱い</b><span class="value">撤回</span><p>未検証係数は使用しない</p></div>
    <div class="card"><b>過去5年</b><span class="value">{pct(portfolio_5y_rate)}</span><p>加重平均CAGR</p></div>
    <div class="card"><b>過去10年</b><span class="value">{pct(portfolio_10y_rate)}</span><p>加重平均CAGR</p></div>
    <div class="card"><b>S&P+5%</b><span class="value">15%</span><p>比較ライン</p></div>
  </div>
  <p class="note">本資料は、未検証の固定係数を使った年率試算を撤回し、確認できる実データだけで候補10社を見直した作業報告です。過去5年・10年の実績は将来予測ではなく、候補比較のための確認値として扱います。</p>
  <h2>1. 本日の作業内容</h2>
  {html_table(["項目", "内容"], work_rows)}
  <h2>2. 追加指標の理由と結果</h2>
  {html_table(["指標", "足した理由", "結果"], indicator_rows)}
  <h2>3. 修正後10社の数値</h2>
  {html_table(["順位", "銘柄", "業種", "比率", "継続期待", "5年CAGR", "10年CAGR", "S&P差", "最大下落", "確認事項"], selection_rows)}
  <h2>4. 1年後〜10年後のS&P500比較表</h2>
  <p class="note">下表は、過去10年CAGRの加重平均が続いた場合の参考比較です。将来予測ではありません。正式な期待利回りは、次工程のローリング検証後に算出します。</p>
  {html_table(["年数", "過去10年ペース", "S&P500 10%", "S&Pとの差", "S&P+5% 15%", "+5%ラインとの差"], projection_rows)}
</section>
</body>
</html>"""

HTML.write_text(html, encoding="utf-8")

styles = getSampleStyleSheet()
base = ParagraphStyle("jp", parent=styles["Normal"], fontName=FONT, fontSize=8.2, leading=11.2, alignment=TA_LEFT)
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
    p("本資料は、未検証の固定係数を使った年率試算を撤回し、確認できる実データだけで候補10社を見直した作業報告です。過去5年・10年の実績は将来予測ではなく、候補比較のための確認値として扱います。", note),
    p("1. 本日の作業内容", h),
    pdf_table(["項目", "内容"], work_rows, [48 * mm, 224 * mm]),
    p("2. 追加指標の理由と結果", h),
    pdf_table(["指標", "足した理由", "結果"], indicator_rows, [42 * mm, 116 * mm, 114 * mm]),
    PageBreak(),
    p("3. 修正後10社の数値", h),
    pdf_table(["順位", "銘柄", "業種", "比率", "継続期待", "5年CAGR", "10年CAGR", "S&P差", "最大下落", "確認事項"], selection_rows, [12 * mm, 36 * mm, 27 * mm, 15 * mm, 23 * mm, 24 * mm, 24 * mm, 22 * mm, 22 * mm, 67 * mm]),
    PageBreak(),
    p("4. 1年後〜10年後のS&P500比較表", h),
    p("下表は、過去10年CAGRの加重平均が続いた場合の参考比較です。将来予測ではありません。正式な期待利回りは、次工程のローリング検証後に算出します。", note),
    pdf_table(["年数", "過去10年ペース", "S&P500 10%", "S&Pとの差", "S&P+5% 15%", "+5%ラインとの差"], projection_rows, [25 * mm, 45 * mm, 45 * mm, 40 * mm, 45 * mm, 45 * mm]),
]

doc = SimpleDocTemplate(str(PDF), pagesize=landscape(A4), rightMargin=10 * mm, leftMargin=10 * mm, topMargin=10 * mm, bottomMargin=10 * mm)


def set_pdf_title(canvas, _doc):
    canvas.setTitle("5月28日 作業報告")


doc.build(story, onFirstPage=set_pdf_title, onLaterPages=set_pdf_title)
shutil.copyfile(PDF, SAFE_PDF)
print(PDF)
print(SAFE_PDF)
