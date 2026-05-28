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

# S&P500+5%の年率15%を超えるかを確認する利益目標ゲート版。
# 直近価格の弱い銘柄は大きく扱わず、長期実績と保守補正後年率で再配分する。
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

work_rows = [
    {
        "項目": "本日の作業",
        "内容": "候補10社の選定に、直近価格、下落リスク、S&P500比較、保守補正後年率の指標を追加した。",
    },
    {
        "項目": "追加した指標",
        "内容": "過去実績をそのまま使わず、65%割引、大幅下落歴補正、高ボラ補正、急騰補正、S&P500+5%目標との比較を入れた。",
    },
    {
        "項目": "選定への影響",
        "内容": "新指標を入れた結果、長期実績だけで上位に見えていた銘柄をそのまま採用せず、候補10社と比率を再計算した。",
    },
    {
        "項目": "確認した結果",
        "内容": f"修正後の年率試算は{pct(portfolio_rate)}。S&P500+5%の年率15%ラインは上回るが、高成長銘柄への集中リスクも残る。",
    },
]

indicator_rows = [
    {
        "追加指標": "保守補正後年率",
        "追加した理由": "過去の上昇率をそのまま将来期待に使うと、急騰銘柄を過大評価しやすいため。",
        "結果": f"過去実績を割り引いても、修正後10社の年率試算は{pct(portfolio_rate)}となり、S&P500+5%の15%ラインを上回った。",
    },
    {
        "追加指標": "大幅下落歴補正",
        "追加した理由": "NISAの1年保有では、過去に大きく下落した銘柄ほど途中損失が大きくなりやすいため。",
        "結果": "最大下落率が大きい銘柄は、実用年率に補正を入れた。高成長でも無条件に大きく採用しない形にした。",
    },
    {
        "追加指標": "高ボラ・急騰補正",
        "追加した理由": "直近または過去に急騰した銘柄は、同じ伸びが続くとは限らず、反落リスクを抱えるため。",
        "結果": "高成長銘柄は残しつつ、補正欄にリスクを明記し、配分の集中リスクを確認事項として残した。",
    },
    {
        "追加指標": "S&P500+5%比較",
        "追加した理由": "S&P500や一般的な投信を上回れないなら、個別株を選ぶ意味が薄いため。",
        "結果": f"200万円・1年では、S&P500+5%ラインの{yen(target_profit_1y)}に対し、修正後10社は約{yen(profit_1y)}となった。",
    },
    {
        "追加指標": "直近価格確認",
        "追加した理由": "長期実績だけでは、今年弱くなっている銘柄を見落とす可能性があるため。",
        "結果": "長期実績で強い銘柄でも、直近価格が弱い場合は大きく扱わない方針にした。",
    },
]

summary_rows = [
    {
        "項目": "変更の要点",
        "説明": "新しいリスク補正指標を追加したことで、単純な長期上昇率順ではなく、保守補正後の実用年率で選定し直した。",
    },
    {
        "項目": "新しく加えた指標",
        "説明": "大幅下落歴、高ボラティリティ、急騰後の過熱、S&P500+5%目標との差を確認する指標を追加した。",
    },
    {
        "項目": "再計算後の年率試算",
        "説明": f"修正後10社を新比率で持った場合、保守補正後の年率試算は{pct(portfolio_rate)}。200万円では1年利益が約{yen(profit_1y)}。",
    },
    {
        "項目": "S&P+5%との比較",
        "説明": f"S&P500+5%の年率15%ラインは1年利益{yen(target_profit_1y)}。修正後10社は約{yen(profit_1y - target_profit_1y)}上回る試算。",
    },
    {
        "項目": "注意点",
        "説明": "S&P+5%を超える試算にするには高成長銘柄の比率が高くなる。目標は維持できるが、銘柄集中リスクも確認事項として残る。",
    },
]

change_rows = [
    {
        "区分": "再計算",
        "銘柄": "候補10社の配分",
        "理由": "S&P500+5%の年率15%を超えるかを、保守補正後の実用年率で確認した。",
    },
    {
        "区分": "反映",
        "銘柄": "直近価格の弱さ",
        "理由": "長期実績が強くても、直近価格が弱い銘柄は大きく扱わないように配分へ反映した。",
    },
    {
        "区分": "確認",
        "銘柄": "1年後〜10年後の比較表",
        "理由": "200万円を前提に、修正後10社、S&P500年率10%、S&P500+5%年率15%を複利で比較した。",
    },
]

selection_rows = []
for rank, (ticker, weight) in enumerate(WEIGHTS.items(), start=1):
    company, industry = NAMES[ticker]
    m = metric(ticker)
    note = m["corrections"]
    if ticker == "5803.T":
        note = "集中リスク確認 / " + note
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
        "補正": note,
    })

projection_rows = []
for year in range(1, 11):
    portfolio_value = CAPITAL * ((1 + portfolio_rate / 100) ** year)
    sp_value = CAPITAL * ((1 + SP_RATE / 100) ** year)
    target_value = CAPITAL * ((1 + TARGET_RATE / 100) ** year)
    projection_rows.append({
        "年数": f"{year}年後",
        "修正後10社": yen(portfolio_value),
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
    <div class="card"><b>対象</b><span class="value">10社</span><p>候補配分の再計算</p></div>
    <div class="card"><b>修正後年率</b><span class="value">{pct(portfolio_rate)}</span><p>保守補正後</p></div>
    <div class="card"><b>S&P+5%目標</b><span class="value">15%</span><p>比較ライン</p></div>
    <div class="card"><b>目標との差</b><span class="value">{yen(profit_1y - target_profit_1y)}</span><p>200万円・1年</p></div>
  </div>
  <p class="note">本資料は、新しいリスク補正指標を追加した結果、候補10社の選定と配分がどう変わったかを整理した作業報告です。単純な過去上昇率順ではなく、保守補正後の実用年率とS&P500比較で再計算しています。</p>
  <h2>1. 本日の作業内容</h2>
  {html_table(["項目", "内容"], work_rows)}
  <h2>2. 新指標追加による選定変更</h2>
  {html_table(["追加指標", "追加した理由", "結果"], indicator_rows)}
  <h2>3. 修正後の配分変更</h2>
  {html_table(["区分", "銘柄", "理由"], change_rows)}
  <h2>4. 修正後10社の数値</h2>
  {html_table(["順位", "銘柄", "業種", "比率", "継続期待", "実用年率", "5年CAGR", "10年CAGR", "S&P差", "最大下落", "補正"], selection_rows)}
  <h2>5. 1年後〜10年後のS&P500比較試算</h2>
  <p class="note">前提は、修正後10社を上記比率で持った場合の年率試算{pct(portfolio_rate)}、S&P500を年率10%、目標ラインをS&P500+5%の年率15%とした複利計算です。</p>
  {html_table(["年数", "修正後10社", "S&P500 10%", "S&Pとの差", "S&P+5% 15%", "+5%目標との差"], projection_rows)}
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
    p("本資料は、新しいリスク補正指標を追加した結果、候補10社の選定と配分がどう変わったかを整理した作業報告です。単純な過去上昇率順ではなく、保守補正後の実用年率とS&P500比較で再計算しています。", note),
    p("1. 本日の作業内容", h),
    pdf_table(["項目", "内容"], work_rows, [48 * mm, 224 * mm]),
    p("2. 新指標追加による選定変更", h),
    pdf_table(["追加指標", "追加した理由", "結果"], indicator_rows, [42 * mm, 116 * mm, 114 * mm]),
    p("3. 修正後の配分変更", h),
    pdf_table(["区分", "銘柄", "理由"], change_rows, [25 * mm, 105 * mm, 142 * mm]),
    PageBreak(),
    p("4. 修正後10社の数値", h),
    pdf_table(["順位", "銘柄", "業種", "比率", "継続期待", "実用年率", "5年CAGR", "10年CAGR", "S&P差", "最大下落", "補正"], selection_rows, [12 * mm, 34 * mm, 24 * mm, 15 * mm, 22 * mm, 22 * mm, 22 * mm, 22 * mm, 19 * mm, 20 * mm, 60 * mm]),
    PageBreak(),
    p("5. 1年後〜10年後のS&P500比較試算", h),
    p(f"前提は、修正後10社を上記比率で持った場合の年率試算{pct(portfolio_rate)}、S&P500を年率10%、目標ラインをS&P500+5%の年率15%とした複利計算です。", note),
    pdf_table(["年数", "修正後10社", "S&P500 10%", "S&Pとの差", "S&P+5% 15%", "+5%目標との差"], projection_rows, [22 * mm, 45 * mm, 45 * mm, 40 * mm, 45 * mm, 45 * mm]),
    p("扱い", h),
    p("修正後もS&P+5%は上回る試算ですが、高成長銘柄への比率が高いため、6月の市場イベント後に再判定します。", note),
]

doc = SimpleDocTemplate(str(PDF), pagesize=landscape(A4), rightMargin=10 * mm, leftMargin=10 * mm, topMargin=10 * mm, bottomMargin=10 * mm)


def set_pdf_title(canvas, _doc):
    canvas.setTitle("5月28日 作業報告")


doc.build(story, onFirstPage=set_pdf_title, onLaterPages=set_pdf_title)
shutil.copyfile(PDF, SAFE_PDF)
print(PDF)
print(SAFE_PDF)
