import csv
from pathlib import Path

from reportlab.lib import colors
from reportlab.lib.enums import TA_LEFT
from reportlab.lib.pagesizes import A4, landscape
from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
from reportlab.lib.units import mm
from reportlab.pdfbase.cidfonts import UnicodeCIDFont
from reportlab.pdfbase import pdfmetrics
from reportlab.platypus import Paragraph, SimpleDocTemplate, Spacer, Table, TableStyle

ROOT = Path.cwd()
PDF = ROOT / "selection_change_report_20260528.pdf"

pdfmetrics.registerFont(UnicodeCIDFont("HeiseiKakuGo-W5"))
FONT = "HeiseiKakuGo-W5"

names = {
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
}


def rows(name):
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
    text = f"{value:.{digits}f}".rstrip("0").rstrip(".")
    return f"{text}%"


def yen(value):
    return f"{round(value):,}円"


long_by_ticker = {r[1]: r for r in rows("728_universe100_long_term_stability_score.csv")}
current_by_ticker = {r[2]: r for r in rows("764_morning_recalc_top10.csv")}
weight_rows = rows("771_provisional_target_weights.csv")

detail = []
weighted_base = 0.0
weighted_practical = 0.0
invested_weight = 0.0

for wr in weight_rows:
    ticker = wr[0]
    if ticker == "CASH":
        continue
    company, industry = names.get(ticker, (ticker, ""))
    lr = long_by_ticker.get(ticker)
    cr = current_by_ticker.get(ticker)
    weight = num(wr[3]) or 0
    cagr5 = num(lr[6]) if lr else None
    cagr10 = num(lr[7]) if lr else None
    sp_diff = num(lr[8]) if lr else None
    vol5 = num(lr[10]) if lr else None
    max_dd = num(lr[11]) if lr else None
    monthly_win = num(lr[12]) if lr else None
    base = cagr5 * 0.6 + cagr10 * 0.4 if cagr5 is not None and cagr10 is not None else None
    overheat = cr is not None and ("過" in str(cr[12]) or "驕" in str(cr[12]))

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

    if base is not None:
        weighted_base += base * weight / 100
    if practical is not None:
        weighted_practical += practical * weight / 100
    invested_weight += weight

    detail.append([
        f"{ticker}\n{company}",
        industry,
        f"{weight:g}%",
        pct(cagr5),
        pct(cagr10),
        pct(base),
        pct(practical),
        pct(sp_diff),
        pct(max_dd),
        pct(monthly_win),
        " / ".join(corrections),
    ])

capital = 2_000_000
practical_profit = capital * weighted_practical / 100
target_rate = 11.0
target_profit = capital * target_rate / 100
gap = practical_profit - target_profit

styles = getSampleStyleSheet()
base_style = ParagraphStyle(
    "jp",
    parent=styles["Normal"],
    fontName=FONT,
    fontSize=9,
    leading=13,
    alignment=TA_LEFT,
)
title_style = ParagraphStyle(
    "title",
    parent=base_style,
    fontSize=20,
    leading=26,
    textColor=colors.HexColor("#123d63"),
    spaceAfter=8,
)
h_style = ParagraphStyle(
    "h",
    parent=base_style,
    fontSize=14,
    leading=18,
    textColor=colors.HexColor("#123d63"),
    spaceBefore=10,
    spaceAfter=6,
)
note_style = ParagraphStyle(
    "note",
    parent=base_style,
    backColor=colors.HexColor("#fff8ec"),
    borderColor=colors.HexColor("#a85b00"),
    borderWidth=0.8,
    borderPadding=6,
    spaceAfter=8,
)


def p(text, style=base_style):
    return Paragraph(str(text).replace("\n", "<br/>"), style)


def make_table(header, data, widths=None):
    body = [[p(x) for x in header]] + [[p(x) for x in row] for row in data]
    t = Table(body, colWidths=widths, repeatRows=1)
    t.setStyle(TableStyle([
        ("FONTNAME", (0, 0), (-1, -1), FONT),
        ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#e6f1fb")),
        ("TEXTCOLOR", (0, 0), (-1, 0), colors.HexColor("#123d63")),
        ("GRID", (0, 0), (-1, -1), 0.5, colors.HexColor("#cbd8e6")),
        ("VALIGN", (0, 0), (-1, -1), "TOP"),
        ("LEFTPADDING", (0, 0), (-1, -1), 4),
        ("RIGHTPADDING", (0, 0), (-1, -1), 4),
        ("TOPPADDING", (0, 0), (-1, -1), 4),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 4),
    ]))
    return t


story = []
story.append(p("候補10社 変更理由・年率試算 報告書", title_style))
story.append(p("2026年5月28日", h_style))
story.append(p(
    "現在の候補10社について、過去5年・10年の実績から「この10社なら年利でどの程度になりそうか」を確認するための試算を追加しました。"
    "単純な過去実績ではなく、過熱・最大下落・ボラティリティを差し引いた保守的な確かめ算として整理しています。",
    note_style,
))

summary = [
    ["候補数", "10社", "現金待機10%を別枠で保持"],
    ["過去実績基準", pct(weighted_base), "5年CAGR60%、10年CAGR40%。楽観的に見えすぎるため採用値ではなく上限確認。"],
    ["実用年率試算", pct(weighted_practical), "過去実績を65%割引し、過熱・最大下落・ボラティリティで追加補正。"],
    ["200万円の場合", yen(practical_profit), "標準シナリオの年利益試算。"],
    ["+1%目標との比較", f"{pct(target_rate)} / {yen(target_profit)}", f"差額は {yen(gap)}。"],
]
story.append(p("1. 確かめ算の結論", h_style))
story.append(make_table(["項目", "数値", "見方"], summary, [45*mm, 42*mm, 185*mm]))

formula = [
    ["実績基準年率", "5年CAGR × 60% + 10年CAGR × 40%", "直近5年の勢いを重視しつつ、10年の継続性も入れる。"],
    ["実用年率試算", "実績基準年率 × 35% × 過熱補正 × 下落補正 × ボラ補正", "過去の上昇をそのまま未来に置かず、かなり保守的に割り引く。"],
    ["ポートフォリオ年率", "Σ（各銘柄の実用年率試算 × 投入比率） + 現金0%", "現在の10社を実際の比率で持った場合の全体年率を出す。"],
]
story.append(p("2. 計算式", h_style))
story.append(make_table(["項目", "数式", "目的"], formula, [45*mm, 95*mm, 132*mm]))

story.append(p("3. 銘柄別の年率試算 前半5社", h_style))
story.append(make_table(
    ["銘柄", "業種", "比率", "5年CAGR", "10年CAGR", "実績基準", "実用試算", "S&P差", "最大下落", "月次勝率", "補正"],
    detail[:5],
    [25*mm, 22*mm, 15*mm, 22*mm, 22*mm, 24*mm, 24*mm, 20*mm, 20*mm, 20*mm, 58*mm],
))

story.append(p("4. 銘柄別の年率試算 後半5社", h_style))
story.append(make_table(
    ["銘柄", "業種", "比率", "5年CAGR", "10年CAGR", "実績基準", "実用試算", "S&P差", "最大下落", "月次勝率", "補正"],
    detail[5:],
    [25*mm, 22*mm, 15*mm, 22*mm, 22*mm, 24*mm, 24*mm, 20*mm, 20*mm, 20*mm, 58*mm],
))

scenarios = [
    ["強め", pct(min(weighted_base * 0.6, 20)), yen(capital * min(weighted_base * 0.6, 20) / 100), "過去実績の継続性が比較的残り、6月イベント後も市場が崩れない場合。"],
    ["標準", pct(weighted_practical), yen(practical_profit), "過去実績を大きく割り引き、過熱銘柄を抑えて見る場合。今回の中心試算。"],
    ["弱め", pct(weighted_practical - 12), yen(capital * (weighted_practical - 12) / 100), "CPI・金利・日銀・FOMC後に市場が悪化し、個別株比率を下げる必要がある場合。"],
]
story.append(p("5. シナリオ別の見方", h_style))
story.append(make_table(["シナリオ", "年率", "200万円の概算", "前提"], scenarios, [35*mm, 35*mm, 45*mm, 157*mm]))
story.append(p(
    f"現時点の10社は、実用年率試算で約{pct(weighted_practical)}です。"
    "S&P500長期平均を10%前後と置き、最低+1%上回る目標を11%前後とすると、現時点ではほぼ目標近辺です。"
    "ただし余裕は大きくないため、6月イベント後に金利・為替・指数の状態が悪ければ、個別株比率を下げる判断が必要です。",
    note_style,
))

doc = SimpleDocTemplate(
    str(PDF),
    pagesize=landscape(A4),
    rightMargin=10*mm,
    leftMargin=10*mm,
    topMargin=10*mm,
    bottomMargin=10*mm,
)
doc.build(story)
print(PDF)
