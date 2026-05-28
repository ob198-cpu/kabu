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

ROOT = Path.cwd()
HTML = ROOT / "selection_change_report_20260528.html"
PDF = ROOT / "selection_change_report_20260528.pdf"

pdfmetrics.registerFont(UnicodeCIDFont("HeiseiKakuGo-W5"))
FONT = "HeiseiKakuGo-W5"

NAMES = {
    "8316.T": ("三井住友FG", "銀行"),
    "8766.T": ("東京海上HD", "保険"),
    "8058.T": ("三菱商事", "商社"),
    "8306.T": ("三菱UFJ FG", "銀行"),
    "8031.T": ("三井物産", "商社"),
    "8001.T": ("伊藤忠商事", "商社"),
    "6501.T": ("日立製作所", "総合電機・IT"),
    "7011.T": ("三菱重工", "重工・防衛"),
    "5802.T": ("住友電工", "電線・通信"),
    "5801.T": ("古河電工", "電線・通信"),
    "2802.T": ("味の素", "食品・ヘルスケア"),
    "6762.T": ("TDK", "電子部品"),
    "8053.T": ("住友商事", "商社"),
    "7173.T": ("東京きらぼしFG", "銀行"),
    "9984.T": ("ソフトバンクG", "投資会社型"),
    "7735.T": ("SCREEN HD", "半導体装置"),
    "6146.T": ("ディスコ", "半導体装置"),
}

CURRENT_ORDER = ["8316.T", "8766.T", "8058.T", "8306.T", "8031.T", "8001.T", "6501.T", "7011.T", "5802.T", "5801.T"]
PREVIOUS_ONLY = ["2802.T", "6762.T", "8053.T", "7173.T", "9984.T", "7735.T", "6146.T"]


def parse_rows(name):
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


long_by_ticker = {r[1]: r for r in parse_rows("728_universe100_long_term_stability_score.csv")}
current_by_ticker = {r[2]: r for r in parse_rows("764_morning_recalc_top10.csv")}
weights = {r[0]: num(r[3]) or 0 for r in parse_rows("771_provisional_target_weights.csv")}


def metrics(ticker):
    r = long_by_ticker.get(ticker)
    c = current_by_ticker.get(ticker)
    score = num(r[3]) if r else None
    cagr5 = num(r[6]) if r else None
    cagr10 = num(r[7]) if r else None
    sp_diff = num(r[8]) if r else None
    vol5 = num(r[10]) if r else None
    max_dd = num(r[11]) if r else None
    monthly = num(r[12]) if r else None
    base = cagr5 * 0.6 + cagr10 * 0.4 if cagr5 is not None and cagr10 is not None else None
    overheat = c is not None and ("過" in str(c[12]) or "驕" in str(c[12]))
    multiplier = 0.35
    corrections = ["過去実績65%割引"]
    if overheat:
        multiplier *= 0.55
        corrections.append("過熱補正")
    if max_dd is not None and max_dd <= -45:
        multiplier *= 0.75
        corrections.append("大幅下落歴補正")
    if vol5 is not None and vol5 >= 40:
        multiplier *= 0.8
        corrections.append("高ボラ補正")
    practical = min(base * multiplier, 18) if base is not None else None
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


detail = []
weighted_base = 0.0
weighted_practical = 0.0
for ticker in CURRENT_ORDER:
    m = metrics(ticker)
    weight = weights.get(ticker, 0)
    if m["base"] is not None:
        weighted_base += m["base"] * weight / 100
    if m["practical"] is not None:
        weighted_practical += m["practical"] * weight / 100
    company, industry = NAMES[ticker]
    detail.append({
        "順位": str(CURRENT_ORDER.index(ticker) + 1),
        "銘柄": f"{ticker} {company}",
        "業種": industry,
        "比率": f"{weight:g}%",
        "継続期待": pct(m["score"]),
        "実用年率": pct(m["practical"]),
        "5年CAGR": pct(m["cagr5"]),
        "10年CAGR": pct(m["cagr10"]),
        "S&P差": pct(m["sp_diff"]),
        "最大下落": pct(m["max_dd"]),
        "月次勝率": pct(m["monthly"]),
        "補正": m["corrections"],
    })

capital = 2_000_000
profit = capital * weighted_practical / 100
target_rate = 11.0
target_profit = capital * target_rate / 100
gap = profit - target_profit

compact_reasons = [
    {
        "項目": "入れ替えの理由",
        "説明": "前回候補を、1年保有テスト用に再計算したため。短期の話題性だけで並べず、継続期待スコアと保守補正後の年率試算で確認した。",
    },
    {
        "項目": "今の10社を現在の比率で持った場合の年率試算",
        "説明": f"現在の投入比率で計算すると、保守補正後の年率試算は{pct(weighted_practical)}。200万円の場合は約{yen(profit)}。S&P500長期平均10%に+1%を足した11%目標との差額は{yen(gap)}。",
    },
    {
        "項目": "採用した数値軸",
        "説明": "継続期待スコア、5年CAGR、10年CAGR、S&P500との差、最大下落率、月次勝率、過熱補正、投入比率。",
    },
    {
        "項目": "上げた銘柄",
        "説明": "長期上昇の継続性、S&P500超過、下落耐性、業種分散が確認しやすい金融・保険・商社・インフラ関連を上げた。",
    },
    {
        "項目": "下げた銘柄",
        "説明": "高PER、過熱、大幅下落歴、同業重複、決算後反応の未確認が残る銘柄は、10社枠では優先度を下げた。",
    },
    {
        "項目": "結論",
        "説明": f"感覚的な入れ替えではなく、今の10社を現在の比率で持った場合の年率試算は{pct(weighted_practical)}。この数字を6月イベント後に再確認する。",
    },
]

kept_added = [
    ["継続", "8316 三井住友FG / 8058 三菱商事 / 8306 三菱UFJ FG", "前回候補の中でも、長期スコア・価格確認点・実用年率のバランスが残った。"],
    ["追加", "8766 東京海上HD / 8031 三井物産 / 8001 伊藤忠 / 6501 日立 / 7011 三菱重工 / 5802 住友電工 / 5801 古河電工", "継続期待スコア、S&P超過、業種分散、6月以降の時流確認に使いやすい銘柄を追加。過熱銘柄は小比率に抑制。"],
    ["見送り", "2802 味の素 / 6762 TDK / 8053 住友商事 / 7173 東京きらぼしFG / 9984 ソフトバンクG / 7735 SCREEN / 6146 ディスコ", "不採用ではなく、今回の10社枠では優先度を下げた。高PER、半導体高ボラ、同業重複、NAV型、確認不足を理由に再確認枠へ回した。"],
]

previous_rows = []
for ticker in PREVIOUS_ONLY:
    company, industry = NAMES[ticker]
    m = metrics(ticker)
    reason = {
        "2802.T": "高PERの説明に次決算確認が必要。今回は1年保有の安定性を優先。",
        "6762.T": "電子部品テーマは残るが、継続期待スコアは今回10社の上位より低い。",
        "8053.T": "長期スコアは高いが、商社枠は三菱商事・三井物産・伊藤忠へ集約。",
        "7173.T": "銀行枠はメガバンク中心に整理。流動性・比較可能性を優先。",
        "9984.T": "投資会社型で評価軸が別。ボラティリティとNAV確認が必要。",
        "7735.T": "半導体装置は高ボラ・大幅下落歴を確認するまで優先度を下げる。",
        "6146.T": "高成長だが半導体高ボラと大幅下落歴が大きく、今回は確認枠。",
    }[ticker]
    previous_rows.append({
        "銘柄": f"{ticker} {company}",
        "継続期待": pct(m["score"]),
        "5年CAGR": pct(m["cagr5"]),
        "最大下落": pct(m["max_dd"]),
        "扱い": reason,
    })


def html_table(headers, rows):
    return "<table><thead><tr>" + "".join(f"<th>{esc(h)}</th>" for h in headers) + "</tr></thead><tbody>" + "".join(
        "<tr>" + "".join(f"<td>{esc(row[h])}</td>" for h in headers) + "</tr>" for row in rows
    ) + "</tbody></table>"


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
    <div class="card"><b>候補数</b><span class="value">10社</span><p>現金10%を別枠</p></div>
    <div class="card"><b>過去実績基準</b><span class="value">{pct(weighted_base)}</span><p>参考上限</p></div>
    <div class="card"><b>現在比率の年率試算</b><span class="value">{pct(weighted_practical)}</span><p>10社合計の確認値</p></div>
    <div class="card"><b>200万円概算</b><span class="value">{yen(profit)}</span><p>標準試算</p></div>
  </div>
  <h2>1. 継続期待スコア採用による選定銘柄の更新</h2>
  {html_table(["項目", "説明"], compact_reasons)}
  <h2>2. 何が残り、何を下げたか</h2>
  {html_table(["区分", "銘柄", "数値上の理由"], [{"区分": r[0], "銘柄": r[1], "数値上の理由": r[2]} for r in kept_added])}
  <h2>3. 現在10社の数値</h2>
  {html_table(["順位", "銘柄", "業種", "比率", "継続期待", "実用年率", "5年CAGR", "10年CAGR", "S&P差", "最大下落", "月次勝率"], detail)}
  <h2>4. 前回候補から優先度を下げた銘柄</h2>
  {html_table(["銘柄", "継続期待", "5年CAGR", "最大下落", "扱い"], previous_rows)}
  <h2>5. 判断式</h2>
  <table>
    <tr><th>指標</th><th>内容</th></tr>
    <tr><td>継続期待スコア</td><td>5年CAGR、10年CAGR、S&P500との差、最大下落率、月次勝率を統合した長期安定性の確認値。</td></tr>
    <tr><td>実用年率試算</td><td>（5年CAGR×60% + 10年CAGR×40%）×35%×過熱補正×下落補正×ボラ補正。</td></tr>
    <tr><td>ポートフォリオ年率</td><td>Σ（各銘柄の実用年率試算×投入比率）+ 現金0%。現在10社では{pct(weighted_practical)}。</td></tr>
    <tr><td>+1%目標</td><td>S&P500長期平均10%前後に対し、目標は11%前後。現在試算との差額は{yen(gap)}。</td></tr>
  </table>
</section>
</body>
</html>"""

HTML.write_text(html, encoding="utf-8")

styles = getSampleStyleSheet()
base = ParagraphStyle("jp", parent=styles["Normal"], fontName=FONT, fontSize=8.8, leading=12.2, alignment=TA_LEFT)
title = ParagraphStyle("title", parent=base, fontSize=20, leading=25, textColor=colors.HexColor("#123d63"), spaceAfter=8)
h = ParagraphStyle("h", parent=base, fontSize=13, leading=17, textColor=colors.HexColor("#123d63"), spaceBefore=8, spaceAfter=5)
note = ParagraphStyle("note", parent=base, backColor=colors.HexColor("#fff8ec"), borderColor=colors.HexColor("#a85b00"), borderWidth=0.8, borderPadding=6, spaceAfter=7)


def p(text, style=base):
    safe = (
        str(text)
        .replace("&", "&amp;")
        .replace("<", "&lt;")
        .replace(">", "&gt;")
        .replace("\n", "<br/>")
    )
    return Paragraph(safe, style)


def pdf_table(headers, rows, widths):
    data = [[p(x) for x in headers]] + [[p(row[h]) for h in headers] for row in rows]
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
    p("1. 継続期待スコア採用による選定銘柄の更新", h),
    pdf_table(["項目", "説明"], compact_reasons, [48 * mm, 224 * mm]),
    p("2. 何が残り、何を下げたか", h),
    pdf_table(["区分", "銘柄", "数値上の理由"], [{"区分": r[0], "銘柄": r[1], "数値上の理由": r[2]} for r in kept_added], [28 * mm, 112 * mm, 132 * mm]),
    p("3. 現在10社の数値", h),
    pdf_table(["順位", "銘柄", "業種", "比率", "継続期待", "実用年率", "5年CAGR", "10年CAGR", "S&P差", "最大下落", "月次勝率"], detail, [12 * mm, 34 * mm, 24 * mm, 15 * mm, 22 * mm, 22 * mm, 22 * mm, 22 * mm, 19 * mm, 20 * mm, 20 * mm]),
    p("4. 前回候補から優先度を下げた銘柄", h),
    pdf_table(["銘柄", "継続期待", "5年CAGR", "最大下落", "扱い"], previous_rows, [45 * mm, 24 * mm, 24 * mm, 24 * mm, 155 * mm]),
    p("5. 判断式", h),
    pdf_table(["指標", "内容"], [
        {"指標": "継続期待スコア", "内容": "5年CAGR、10年CAGR、S&P500との差、最大下落率、月次勝率を統合した長期安定性の確認値。"},
        {"指標": "実用年率試算", "内容": "（5年CAGR×60% + 10年CAGR×40%）×35%×過熱補正×下落補正×ボラ補正。"},
        {"指標": "ポートフォリオ年率", "内容": f"Σ（各銘柄の実用年率試算×投入比率）+ 現金0%。現在10社では{pct(weighted_practical)}。"},
        {"指標": "+1%目標", "内容": f"S&P500長期平均10%前後に対し、目標は11%前後。現在試算との差額は{yen(gap)}。"},
    ], [48 * mm, 224 * mm]),
]

doc = SimpleDocTemplate(
    str(PDF),
    pagesize=landscape(A4),
    rightMargin=10 * mm,
    leftMargin=10 * mm,
    topMargin=10 * mm,
    bottomMargin=10 * mm,
)
doc.build(story)
print(PDF)
