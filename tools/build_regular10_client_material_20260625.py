from __future__ import annotations

import html
import math
from pathlib import Path

from reportlab.lib import colors
from reportlab.lib.pagesizes import A4, landscape
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.cidfonts import UnicodeCIDFont
from reportlab.pdfgen import canvas


ROOT = Path(__file__).resolve().parents[1]
OUT_PDF = ROOT / "regular10_client_material_20260625.pdf"
OUT_HTML = ROOT / "regular10_client_material_20260625.html"


pdfmetrics.registerFont(UnicodeCIDFont("HeiseiKakuGo-W5"))
FONT = "HeiseiKakuGo-W5"

NAVY = colors.HexColor("#123A5A")
BLUE = colors.HexColor("#0B67A3")
LIGHT_BLUE = colors.HexColor("#EAF4FB")
PALE = colors.HexColor("#F6FAFD")
INK = colors.HexColor("#071927")
GREEN = colors.HexColor("#11704F")
AMBER = colors.HexColor("#A26000")
RED = colors.HexColor("#B42318")
LINE = colors.HexColor("#BFD5E8")
GRAY = colors.HexColor("#4A5568")


CANDIDATES = [
    {
        "rank": 1,
        "ticker": "3099.T",
        "name": "三越伊勢丹HD",
        "sector": "消費・インバウンド",
        "role": "初回主力",
        "ev": 33.27,
        "risk": 66.0,
        "d5": 10.03,
        "d20": 22.63,
        "reason": "決算後の対TOPIX反応が強く、消費・インバウンド回復の確認材料がある。",
        "rule": "初回主力。急騰日は追わず、指値または翌営業日確認。",
    },
    {
        "rank": 2,
        "ticker": "5333.T",
        "name": "日本ガイシ",
        "sector": "電力・セラミック・産業部材",
        "role": "初回主力",
        "ev": 16.83,
        "risk": 60.7,
        "d5": 8.57,
        "d20": 22.18,
        "reason": "電力・産業部材のテーマ接続があり、決算後20営業日の反応が良い。",
        "rule": "初回主力。ただしEVは中位のため過熱時は買いを分ける。",
    },
    {
        "rank": 3,
        "ticker": "6479.T",
        "name": "ミネベアミツミ",
        "sector": "電子部品・機械",
        "role": "初回主力",
        "ev": 27.63,
        "risk": 54.0,
        "d5": 5.64,
        "d20": 15.27,
        "reason": "電子部品・機械の需要回復仮説と、決算後の対指数反応がそろう。",
        "rule": "初回主力。半導体・電子部品市況の悪化時は減額。",
    },
    {
        "rank": 4,
        "ticker": "8316.T",
        "name": "三井住友FG",
        "sector": "銀行・金利",
        "role": "初回主力",
        "ev": 37.23,
        "risk": 73.3,
        "d5": -0.14,
        "d20": 5.79,
        "reason": "銀行枠の中でEVと財務面の説明力が高い。金利テーマの中心候補。",
        "rule": "初回主力。ただし銀行合計比率に上限を置く。",
    },
    {
        "rank": 5,
        "ticker": "1942.T",
        "name": "関電工",
        "sector": "電力設備・データセンター周辺",
        "role": "初回主力",
        "ev": 40.48,
        "risk": 60.9,
        "d5": 5.41,
        "d20": 2.93,
        "reason": "電力設備・データセンター周辺需要との接続があり、EVが高い。",
        "rule": "初回主力。短期反応は中程度のため、買付後の出来高確認を続ける。",
    },
    {
        "rank": 6,
        "ticker": "8306.T",
        "name": "三菱UFJ FG",
        "sector": "銀行・金利",
        "role": "小口・追加",
        "ev": 34.88,
        "risk": 78.1,
        "d5": -0.73,
        "d20": 4.71,
        "reason": "銀行・金利テーマの補完候補。20営業日では指数を上回る。",
        "rule": "小口または第2回追加。銀行枠の買いすぎを避ける。",
    },
    {
        "rank": 7,
        "ticker": "8750.T",
        "name": "第一生命HD",
        "sector": "保険・金利",
        "role": "小口・追加",
        "ev": 28.15,
        "risk": 82.0,
        "d5": -2.31,
        "d20": 2.81,
        "reason": "保険・金利テーマの補完候補。リスク点は高いが短期反応は弱め。",
        "rule": "小口候補。保険枠の集中を避け、追加は反応確認後。",
    },
    {
        "rank": 8,
        "ticker": "8630.T",
        "name": "SOMPO HD",
        "sector": "保険・防御",
        "role": "小口・追加",
        "ev": 30.61,
        "risk": 81.9,
        "d5": 0.62,
        "d20": 2.64,
        "reason": "保険枠の防御候補。短期反応は大きくないが安定補完の役割。",
        "rule": "小口候補。攻め枠ではなく全体の揺れを抑える目的。",
    },
    {
        "rank": 9,
        "ticker": "8795.T",
        "name": "T&D HD",
        "sector": "保険・金利",
        "role": "小口・追加",
        "ev": 14.60,
        "risk": 63.1,
        "d5": -1.19,
        "d20": 10.43,
        "reason": "20営業日反応は良いがEVは低め。保険枠内の追加候補として扱う。",
        "rule": "小口候補。5日反応が弱いため一括では買わない。",
    },
    {
        "rank": 10,
        "ticker": "8411.T",
        "name": "みずほFG",
        "sector": "銀行・金利",
        "role": "小口・追加",
        "ev": 8.57,
        "risk": 50.9,
        "d5": -2.23,
        "d20": 5.96,
        "reason": "銀行枠の追加候補。EVと短期反応は弱いため比率は抑える。",
        "rule": "小口候補。主力銀行枠の補完としてのみ検討。",
    },
]

TARGET_WEIGHTS = {
    "3099.T": 9,
    "5333.T": 7,
    "6479.T": 8,
    "8316.T": 10,
    "1942.T": 10,
    "8306.T": 8,
    "8750.T": 7,
    "8630.T": 7,
    "8795.T": 5,
    "8411.T": 4,
}

AGGRESSIVE_ADD = {"1942.T": 2, "8316.T": 2, "3099.T": 2, "8306.T": 2, "6479.T": 2}
BASE_CAPITAL = 2_400_000


def portfolio_expected(weights: dict[str, float]) -> float:
    ev_by_ticker = {row["ticker"]: row["ev"] for row in CANDIDATES}
    return sum(weights[t] * ev_by_ticker[t] / 100 for t in weights)


def scaled_weights(weights: dict[str, float], target_total: float) -> dict[str, float]:
    current_total = sum(weights.values())
    return {ticker: weight * target_total / current_total for ticker, weight in weights.items()}


def aggressive_weights() -> dict[str, float]:
    weights = dict(TARGET_WEIGHTS)
    for ticker, add in AGGRESSIVE_ADD.items():
        weights[ticker] += add
    return weights

def wrap_lines(text: str, width: float, font_size: float) -> list[str]:
    lines: list[str] = []
    current = ""
    for ch in text:
        trial = current + ch
        if pdfmetrics.stringWidth(trial, FONT, font_size) <= width:
            current = trial
        else:
            if current:
                lines.append(current)
            current = ch
    if current:
        lines.append(current)
    return lines


def draw_wrapped(
    c: canvas.Canvas,
    text: str,
    x: float,
    y: float,
    width: float,
    font_size: float = 11,
    leading: float | None = None,
    color=INK,
    max_lines: int | None = None,
) -> float:
    leading = leading or font_size * 1.45
    c.setFont(FONT, font_size)
    c.setFillColor(color)
    lines = wrap_lines(text, width, font_size)
    if max_lines is not None and len(lines) > max_lines:
        lines = lines[:max_lines]
        if lines:
            lines[-1] = lines[-1].rstrip("、。") + "…"
    for line in lines:
        c.drawString(x, y, line)
        y -= leading
    return y


def rounded_box(c: canvas.Canvas, x: float, y: float, w: float, h: float, fill, stroke=LINE, radius: float = 10):
    c.setFillColor(fill)
    c.setStrokeColor(stroke)
    c.roundRect(x, y, w, h, radius, fill=1, stroke=1)


def title(c: canvas.Canvas, text: str, subtitle: str | None = None):
    c.setFillColor(NAVY)
    c.rect(0, 535, 842, 60, fill=1, stroke=0)
    c.setFillColor(colors.white)
    c.setFont(FONT, 22)
    c.drawString(36, 565, text)
    if subtitle:
        c.setFont(FONT, 10)
        c.drawRightString(806, 565, subtitle)


def footer(c: canvas.Canvas, page_no: int):
    c.setFont(FONT, 8)
    c.setFillColor(GRAY)
    c.drawString(36, 20, "本資料は投資判断の補助資料です。利益を保証するものではありません。発注前に証券会社画面と最新情報を確認します。")
    c.drawRightString(806, 20, f"{page_no}")


def add_page_1(c: canvas.Canvas):
    c.setFillColor(NAVY)
    c.rect(0, 0, 842, 595, fill=1, stroke=0)
    c.setFillColor(colors.white)
    c.setFont(FONT, 30)
    c.drawString(48, 505, "正規10社 運用候補資料")
    c.setFont(FONT, 14)
    c.drawString(50, 474, "2026年6月25日版 / 初回検討用")
    c.setStrokeColor(colors.white)
    c.setLineWidth(1.2)
    c.line(50, 452, 792, 452)

    rounded_box(c, 50, 300, 742, 125, colors.white, colors.white, 12)
    c.setFont(FONT, 16)
    c.setFillColor(NAVY)
    c.drawString(72, 394, "本資料の位置づけ")
    body = (
        "本資料は、NISAでの個別株運用を検討するために、同一の確認手順を通過した10銘柄を整理したものです。"
        "候補は、財務・事業テーマ・価格リスク・期待値の4項目を同じ基準で確認し、条件を満たした銘柄に限定しています。"
        "購入を確定する資料ではなく、発注前に最新株価、口座区分、本人確認、注文内容を確認するための説明資料です。"
    )
    draw_wrapped(c, body, 72, 365, 690, 12, 18, INK)

    cards = [
        ("対象", "正規10社", "同一基準を通過"),
        ("初回", "主力5社", "最初に確認する中心候補"),
        ("追加", "小口5社", "状況確認後に追加検討"),
        ("投入", "30〜40%", "初回は全額投入しない"),
        ("評価", "指数比較", "S&P500・TOPIX等と比較"),
        ("目安", "+10〜13%", "初年度の検証目標"),
    ]
    x0, y0 = 50, 170
    for i, (k, v, s) in enumerate(cards):
        x = x0 + (i % 3) * 248
        y = y0 - (i // 3) * 82
        rounded_box(c, x, y, 226, 64, colors.HexColor("#F5FAFE"), colors.HexColor("#8CC2E3"), 10)
        c.setFillColor(BLUE)
        c.setFont(FONT, 10)
        c.drawString(x + 16, y + 42, k)
        c.setFillColor(NAVY)
        c.setFont(FONT, 20)
        c.drawString(x + 16, y + 20, v)
        c.setFillColor(GRAY)
        c.setFont(FONT, 8.5)
        c.drawRightString(x + 210, y + 22, s)

    c.setFillColor(colors.white)
    c.setFont(FONT, 9)
    c.drawString(50, 48, "評価目標は、個別株を選ぶ合理性を確認するための運用上の物差しです。市場環境が悪い場合は、買付を減額または延期します。")
    footer(c, 1)
    c.showPage()


def add_page_2(c: canvas.Canvas):
    title(c, "選定プロセス", "正規10社の抽出手順")
    y = 492
    intro = "正規10社は、候補母集団から同じ確認手順で絞り込んだ銘柄です。途中で別表補完銘柄を混ぜず、同一条件を通過したものだけを採用しています。"
    draw_wrapped(c, intro, 48, y, 746, 12.5, 18, INK)

    steps = [
        ("1", "母集団", "業績、流動性、時価総額、テーマ適合で候補を作る"),
        ("2", "量的確認", "CAGR、指数差、下落率、PER/PBR/ROE等を見る"),
        ("3", "質的確認", "公式資料・ニュース・事業構造との接続を見る"),
        ("4", "イベント反応", "決算後・市場イベント後に指数比で確認する"),
        ("5", "期待値", "上昇余地、下落余地、リスク点を比較する"),
        ("6", "購入前ゲート", "買わない条件、比率、口座確認を通す"),
    ]
    x = 44
    y = 345
    w = 118
    for i, (num, head, text) in enumerate(steps):
        rounded_box(c, x + i * 128, y, w, 90, PALE, LINE, 10)
        c.setFillColor(BLUE)
        c.circle(x + i * 128 + 18, y + 68, 12, fill=1, stroke=0)
        c.setFillColor(colors.white)
        c.setFont(FONT, 10)
        c.drawCentredString(x + i * 128 + 18, y + 64, num)
        c.setFillColor(NAVY)
        c.setFont(FONT, 13)
        c.drawString(x + i * 128 + 36, y + 62, head)
        draw_wrapped(c, text, x + i * 128 + 12, y + 42, w - 24, 8.5, 12, INK, max_lines=3)
        if i < len(steps) - 1:
            c.setStrokeColor(BLUE)
            c.setLineWidth(1.5)
            c.line(x + i * 128 + w + 3, y + 45, x + (i + 1) * 128 - 8, y + 45)
            c.line(x + (i + 1) * 128 - 8, y + 45, x + (i + 1) * 128 - 15, y + 50)
            c.line(x + (i + 1) * 128 - 8, y + 45, x + (i + 1) * 128 - 15, y + 40)

    c.setFont(FONT, 15)
    c.setFillColor(NAVY)
    c.drawString(48, 270, "4つの通過条件")
    gates = [
        ("財務・業績", "売上、利益、EPS、ROE、PER/PBR等で無理のある候補を外す。"),
        ("事業テーマ", "AI、半導体、電力、金利等を、公式資料と実際の事業で確認する。"),
        ("価格リスク", "最大下落率、ボラティリティ、短期過熱、同業集中を確認する。"),
        ("期待値", "上昇確率、上昇幅、下落確率、下落幅、コストを比較する。"),
    ]
    for i, (head, text) in enumerate(gates):
        bx = 48 + (i % 2) * 380
        by = 205 - (i // 2) * 82
        rounded_box(c, bx, by, 352, 58, colors.white, LINE, 8)
        c.setFillColor(GREEN)
        c.setFont(FONT, 13)
        c.drawString(bx + 14, by + 36, f"PASS: {head}")
        draw_wrapped(c, text, bx + 14, by + 20, 320, 9.5, 13, INK, max_lines=2)

    footer(c, 2)
    c.showPage()


def add_page_3(c: canvas.Canvas):
    title(c, "正規10社一覧", "同一ゲート通過銘柄")
    headers = ["No", "銘柄", "役割", "業種・テーマ", "EV", "リスク", "20日指数差", "主な根拠", "運用上の扱い"]
    widths = [28, 92, 62, 100, 42, 42, 58, 222, 150]
    x0, y0 = 24, 496
    row_h = 43
    c.setFillColor(LIGHT_BLUE)
    c.rect(x0, y0, sum(widths), 28, fill=1, stroke=0)
    c.setStrokeColor(LINE)
    c.setLineWidth(0.6)
    xx = x0
    c.setFont(FONT, 8.8)
    c.setFillColor(NAVY)
    for h, w in zip(headers, widths):
        c.rect(xx, y0, w, 28, fill=0, stroke=1)
        c.drawString(xx + 4, y0 + 9, h)
        xx += w

    y = y0 - row_h
    for i, row in enumerate(CANDIDATES):
        c.setFillColor(colors.white if i % 2 == 0 else colors.HexColor("#FBFDFF"))
        c.rect(x0, y, sum(widths), row_h, fill=1, stroke=0)
        xx = x0
        vals = [
            str(row["rank"]),
            f"{row['ticker']}\n{row['name']}",
            row["role"],
            row["sector"],
            f"{row['ev']:.1f}%",
            f"{row['risk']:.1f}",
            f"{row['d20']:.2f}pt",
            row["reason"],
            row["rule"],
        ]
        for val, w in zip(vals, widths):
            c.setStrokeColor(LINE)
            c.rect(xx, y, w, row_h, fill=0, stroke=1)
            color = GREEN if row["role"] == "初回主力" and val == row["role"] else AMBER if val == row["role"] else INK
            draw_wrapped(c, val, xx + 4, y + row_h - 13, w - 8, 7.8, 10.2, color, max_lines=3)
            xx += w
        y -= row_h

    c.setFillColor(AMBER)
    c.setFont(FONT, 9.5)
    c.drawString(32, 32, "注: EVは候補間比較用の期待値指標です。将来リターンを保証する数値ではありません。")
    footer(c, 3)
    c.showPage()


def add_page_4(c: canvas.Canvas):
    title(c, "運用ルール", "数字で確認する初回買付と停止条件")
    c.setFillColor(NAVY)
    c.setFont(FONT, 15)
    c.drawString(46, 498, "初回買付の考え方")
    bullets = [
        "初回は基本案40%で960,000円、慎重案30%で720,000円を上限にします。",
        "基本案40%は三越196,000円、日本ガイシ153,000円、ミネベア175,000円、SMFG218,000円、関電工218,000円です。",
        "小口・追加候補5社は、5営業日・20営業日の指数差と同業集中を見て追加判断します。",
        "現金は最低30%残し、急落時・追加確認時・見送り時の余力にします。",
    ]
    y = 468
    for b in bullets:
        c.setFillColor(BLUE)
        c.circle(52, y + 4, 3, fill=1, stroke=0)
        y = draw_wrapped(c, b, 62, y, 720, 11.5, 17, INK)
        y -= 3

    phases = [
        ("当日", "72万〜96万円", "主力5社に銘柄別金額を割当。条件不一致分は現金待機。"),
        ("5営業日後", "+0〜20%", "対TOPIXでマイナス、悪材料、急落なら追加しない。"),
        ("20営業日後", "+0〜20%", "指数差・決算後反応・出来高を確認して追加。"),
        ("月次", "見直し", "指数に劣後、テーマ崩れ、急落兆候があれば比率を落とす。"),
    ]
    y = 300
    for i, (when, pct, text) in enumerate(phases):
        bx = 48 + i * 190
        rounded_box(c, bx, y, 170, 88, colors.white, LINE, 10)
        c.setFillColor(BLUE)
        c.setFont(FONT, 12)
        c.drawString(bx + 14, y + 60, when)
        c.setFillColor(NAVY)
        c.setFont(FONT, 20)
        c.drawString(bx + 14, y + 35, pct)
        draw_wrapped(c, text, bx + 14, y + 20, 142, 8.5, 11, INK, max_lines=3)

    c.setFillColor(NAVY)
    c.setFont(FONT, 15)
    c.drawString(46, 235, "買わない条件・減額条件")
    rules = [
        ("市場", "日経平均またはTOPIXが当日-2%以上、または米金利・為替が急変した日は新規買付を停止。"),
        ("個別", "対象銘柄が当日+3%以上急騰している場合は追わず、翌営業日に再確認。"),
        ("下落", "保有後-7%または対TOPIXで-5pt以上劣後したら追加停止。-10%で半分減額を検討。"),
        ("急落", "ストップ安または大幅売り気配では成行で売らず、理由・出来高・翌日の気配を確認してから判断。"),
        ("利確", "+15%以上かつ出来高急増・過熱判定なら20〜30%を利益確定。テーマ継続なら一部を残す。"),
    ]
    y = 208
    for head, text in rules:
        rounded_box(c, 48, y - 26, 746, 32, PALE, LINE, 7)
        c.setFillColor(RED if head in ("下落", "急落") else BLUE)
        c.setFont(FONT, 10)
        c.drawString(60, y - 6, head)
        draw_wrapped(c, text, 110, y - 6, 660, 9.5, 12, INK, max_lines=2)
        y -= 39

    footer(c, 4)
    c.showPage()


def add_page_5(c: canvas.Canvas):
    title(c, "期待値と確認項目", "初年度の採用ライン")
    text = (
        "年+10%は比較対象であり、個別株運用の目標にはしません。採用下限は年+15%、本命目標は年+20%前後です。"
        "+15%を下回る見込みなら、個別株比率を上げず、指数・現金・延期を優先します。"
        "この数値は利益保証ではなく、リスクを取る価値があるかを確認するための評価基準です。"
    )
    draw_wrapped(c, text, 46, 474, 746, 12, 18, INK)

    c.setFillColor(NAVY)
    c.setFont(FONT, 13)
    c.drawString(46, 405, "240万円でのイメージ")
    scenarios = [
        ("指数想定", 0.10, "比較対象"),
        ("採用下限", 0.15, "下限"),
        ("本命目標", 0.20, "主目標"),
        ("強気上振れ", 0.25, "上振れ"),
        ("悪化", -0.10, "減額"),
    ]
    x0, y0 = 60, 365
    base = 2_400_000
    max_bar = 3_050_000
    min_bar = 2_100_000
    for i, (label, rate, note) in enumerate(scenarios):
        amount = base * (1 + rate)
        y = y0 - i * 34
        c.setFillColor(GRAY)
        c.setFont(FONT, 10)
        c.drawString(x0, y + 4, label)
        c.setFillColor(colors.HexColor("#E6EEF5"))
        c.rect(x0 + 60, y, 430, 18, fill=1, stroke=0)
        bw = max(20, (amount - min_bar) / (max_bar - min_bar) * 430)
        c.setFillColor(GREEN if rate >= 0 else RED)
        c.rect(x0 + 60, y, bw, 18, fill=1, stroke=0)
        c.setFillColor(INK)
        c.setFont(FONT, 10)
        c.drawString(x0 + 505, y + 4, f"{amount:,.0f}円 ({rate*100:+.0f}%)")
        c.setFillColor(GRAY)
        draw_wrapped(c, note, x0 + 650, y + 10, 85, 8.2, 10, GRAY, max_lines=2)

    c.setFillColor(NAVY)
    c.setFont(FONT, 15)
    c.drawString(46, 210, "運用中に必ず見る項目")
    checks = [
        "候補10社の最新株価、出来高、指数差",
        "5営業日・20営業日の対TOPIX反応",
        "銀行・保険・電力設備など同業集中の偏り",
        "米金利、為替、日銀・FRB関連イベント",
        "注文口座区分がNISAになっているか、本人が最終確認したか",
    ]
    y = 182
    for chk in checks:
        c.setFillColor(BLUE)
        c.circle(52, y + 4, 3, fill=1, stroke=0)
        y = draw_wrapped(c, chk, 62, y, 720, 11, 16, INK)
        y -= 2

    rounded_box(c, 46, 42, 746, 52, colors.HexColor("#FFF8E7"), colors.HexColor("#E3B15C"), 8)
    c.setFillColor(AMBER)
    c.setFont(FONT, 11)
    c.drawString(60, 72, "発注前の最終確認")
    draw_wrapped(c, "証券会社画面で銘柄、株数、価格、口座区分、買付余力を確認します。条件に合わない場合は買わず、翌営業日に再判定します。", 60, 55, 700, 10, 13, INK, max_lines=2)
    footer(c, 5)
    c.showPage()




def add_page_6_plan(c: canvas.Canvas):
    title(c, "15%・20%・25%の根拠", "投入比率で作る運用計画")
    floor_weights = scaled_weights(TARGET_WEIGHTS, 55)
    target_weights = dict(TARGET_WEIGHTS)
    bull_weights = aggressive_weights()
    floor_ev = portfolio_expected(floor_weights)
    target_ev = portfolio_expected(target_weights)
    bull_ev = portfolio_expected(bull_weights)
    intro = (
        "+20%前後を狙うには、銘柄を選ぶだけでは足りません。EVの高い候補に資金を厚くし、"
        "条件がそろわない時は現金を残す必要があります。計算式は 期待リターン = Σ(投入比率 × EV) です。"
    )
    draw_wrapped(c, intro, 46, 500, 746, 12, 18, INK)

    rounded_box(c, 46, 422, 746, 48, colors.HexColor("#FFF8E7"), colors.HexColor("#E3B15C"), 8)
    c.setFillColor(AMBER)
    c.setFont(FONT, 11)
    c.drawString(60, 452, "根拠式")
    draw_wrapped(c, "正規10社のEVを使い、投入比率を掛けて全体の期待値を出します。現金部分は0%として扱うため、投入比率が低いほど期待値も下がります。", 60, 434, 700, 9.8, 12.5, INK, max_lines=2)

    cards = [
        ("採用下限", floor_ev, "55%投入", "条件が弱い時はここまで。+15%を下回るなら追加しない。"),
        ("本命計画", target_ev, "75%投入", "5日・20日反応、指数、悪材料を確認して段階的に到達。"),
        ("強気上振れ", bull_ev, "85%投入", "強い地合い時だけ、EV上位5社へ各+2%追加。"),
    ]
    for i, (label, ev, exposure, note) in enumerate(cards):
        x = 46 + i * 252
        rounded_box(c, x, 342, 235, 62, PALE, LINE, 8)
        c.setFillColor(BLUE if i < 2 else AMBER)
        c.setFont(FONT, 10)
        c.drawString(x + 12, 382, label)
        c.setFillColor(NAVY)
        c.setFont(FONT, 17)
        c.drawString(x + 12, 360, f"{ev:.1f}% / {exposure}")
        draw_wrapped(c, note, x + 116, 382, 104, 7.5, 9, GRAY, max_lines=3)

    c.setFillColor(NAVY)
    c.setFont(FONT, 14)
    c.drawString(46, 316, "本命計画 75%投入時の比率")
    headers = ["銘柄", "EV", "比率", "240万円換算", "役割"]
    widths = [150, 55, 55, 90, 400]
    x0, y0 = 46, 58
    row_h = 23
    header_h = 24
    top = y0 + row_h * len(CANDIDATES)
    c.setFillColor(LIGHT_BLUE)
    c.rect(x0, top, sum(widths), header_h, fill=1, stroke=0)
    xx = x0
    c.setFillColor(NAVY)
    c.setFont(FONT, 8.5)
    for h, w in zip(headers, widths):
        c.setStrokeColor(LINE)
        c.rect(xx, top, w, header_h, fill=0, stroke=1)
        c.drawString(xx + 5, top + 8, h)
        xx += w
    for idx, row in enumerate(CANDIDATES):
        y = y0 + row_h * (len(CANDIDATES) - idx - 1)
        ticker = row["ticker"]
        weight = TARGET_WEIGHTS[ticker]
        amount = int(BASE_CAPITAL * weight / 100)
        vals = [f"{ticker} {row['name']}", f"{row['ev']:.1f}%", f"{weight:.0f}%", f"{amount:,}円", row["rule"]]
        c.setFillColor(colors.white if idx % 2 == 0 else colors.HexColor("#FBFDFF"))
        c.rect(x0, y, sum(widths), row_h, fill=1, stroke=0)
        xx = x0
        for val, w in zip(vals, widths):
            c.setStrokeColor(LINE)
            c.rect(xx, y, w, row_h, fill=0, stroke=1)
            draw_wrapped(c, val, xx + 5, y + row_h - 8, w - 10, 7.2, 8.3, INK, max_lines=2)
            xx += w
    footer(c, 6)
    c.showPage()


def add_page_7_initial_buy(c: canvas.Canvas):
    title(c, "初回買付の具体案", "240万円の場合")
    intro = (
        "初回は正規10社のうち、EVと購入前ゲートの根拠が強い主力5社だけを対象にします。"
        "金額は本命計画75%の比率を初回資金へ縮小して配分します。"
        "条件に合わない銘柄の金額は現金待機とし、ほかの銘柄へ穴埋めしません。"
    )
    draw_wrapped(c, intro, 46, 500, 746, 12, 18, INK)

    basic_rows = [
        ("3099.T", "三越伊勢丹HD", "196,000円", "消費・インバウンド枠。EVと価格反応を確認して初回対象。"),
        ("5333.T", "日本ガイシ", "153,000円", "電力・セラミック材料枠。過熱を抑えて小さめに開始。"),
        ("6479.T", "ミネベアミツミ", "175,000円", "精密部品・電動化枠。テーマ性と価格反応を確認。"),
        ("8316.T", "三井住友FG", "218,000円", "金融主力枠。金利環境と財務耐性を評価。"),
        ("1942.T", "関電工", "218,000円", "電力インフラ枠。EVが高く、初回主力に設定。"),
    ]
    cautious_rows = [
        ("3099.T", "三越伊勢丹HD", "146,000円", "基本案より25%縮小。"),
        ("5333.T", "日本ガイシ", "115,000円", "基本案より25%縮小。"),
        ("6479.T", "ミネベアミツミ", "131,000円", "基本案より25%縮小。"),
        ("8316.T", "三井住友FG", "164,000円", "基本案より25%縮小。"),
        ("1942.T", "関電工", "164,000円", "基本案より25%縮小。"),
    ]

    c.setFillColor(NAVY)
    c.setFont(FONT, 15)
    c.drawString(46, 458, "基本案40%: 合計960,000円")
    draw_initial_buy_table(c, basic_rows, 46, 315)

    c.setFillColor(NAVY)
    c.setFont(FONT, 15)
    c.drawString(46, 285, "慎重案30%: 合計720,000円")
    draw_initial_buy_table(c, cautious_rows, 46, 142)

    rounded_box(c, 46, 52, 746, 62, colors.HexColor("#FFF8E7"), colors.HexColor("#E3B15C"), 8)
    c.setFillColor(AMBER)
    c.setFont(FONT, 11)
    c.drawString(60, 92, "当日の実行条件")
    note = (
        "当日+3%以上急騰、指数急落、米金利急騰、円高ショック、重大悪材料がある場合は買いません。"
        "買わなかった分は現金待機です。5営業日・20営業日の対TOPIX反応が弱ければ、次の追加買付を止めます。"
    )
    draw_wrapped(c, note, 60, 74, 700, 10, 13, INK, max_lines=2)
    footer(c, 7)
    c.showPage()


def draw_initial_buy_table(c: canvas.Canvas, rows, x0, y0):
    headers = ["銘柄コード", "銘柄名", "初回金額", "根拠・扱い"]
    widths = [90, 150, 105, 400]
    row_h = 23
    header_h = 24
    top = y0 + row_h * len(rows)
    c.setFillColor(LIGHT_BLUE)
    c.rect(x0, top, sum(widths), header_h, fill=1, stroke=0)
    xx = x0
    c.setFillColor(NAVY)
    c.setFont(FONT, 8.8)
    for h, w in zip(headers, widths):
        c.setStrokeColor(LINE)
        c.rect(xx, top, w, header_h, fill=0, stroke=1)
        c.drawString(xx + 5, top + 8, h)
        xx += w
    for idx, row in enumerate(rows):
        y = y0 + row_h * (len(rows) - idx - 1)
        c.setFillColor(colors.white if idx % 2 == 0 else colors.HexColor("#FBFDFF"))
        c.rect(x0, y, sum(widths), row_h, fill=1, stroke=0)
        xx = x0
        for val, w in zip(row, widths):
            c.setStrokeColor(LINE)
            c.rect(xx, y, w, row_h, fill=0, stroke=1)
            draw_wrapped(c, val, xx + 5, y + row_h - 8, w - 10, 7.8, 9.2, INK, max_lines=2)
            xx += w

def add_page_6(c: canvas.Canvas):
    title(c, "6月30日開始の1年間シミュレーション", "月ごとの資産目安")
    intro = (
        "6月30日に初回買付を行う場合の、1年間の確認予定です。資金240万円を例に、初回は基本案96万円または慎重案72万円を投入し、"
        "5営業日後、20営業日後、月次、決算時点で追加・停止・減額を判断します。"
    )
    draw_wrapped(c, intro, 46, 500, 746, 12, 18, INK)

    base = 2_400_000
    months = ["6/30", "7月", "8月", "9月", "10月", "11月", "12月", "1月", "2月", "3月", "4月", "5月", "6月"]
    index_line = [base * (1.10 ** (i / 12)) for i in range(13)]
    floor_line = [base * (1.15 ** (i / 12)) for i in range(13)]
    target = [base * (1.20 ** (i / 12)) for i in range(13)]
    bull_line = [base * (1.25 ** (i / 12)) for i in range(13)]

    chart_x, chart_y, chart_w, chart_h = 58, 210, 720, 220
    min_v, max_v = 2_350_000, 3_050_000
    c.setFillColor(colors.white)
    c.setStrokeColor(LINE)
    c.roundRect(chart_x - 10, chart_y - 34, chart_w + 20, chart_h + 72, 10, fill=1, stroke=1)
    c.setFont(FONT, 10)
    c.setFillColor(NAVY)
    c.drawString(chart_x, chart_y + chart_h + 28, "240万円で見た場合の資産推移目安")

    for v in [2_400_000, 2_550_000, 2_700_000, 2_850_000, 3_000_000]:
        yy = chart_y + (v - min_v) / (max_v - min_v) * chart_h
        c.setStrokeColor(colors.HexColor("#D8E7F2"))
        c.line(chart_x, yy, chart_x + chart_w, yy)
        c.setFillColor(GRAY)
        c.setFont(FONT, 8)
        c.drawRightString(chart_x - 8, yy - 3, f"{v/10000:.0f}万円")

    def xy(i, val):
        x = chart_x + chart_w * i / 12
        y = chart_y + (val - min_v) / (max_v - min_v) * chart_h
        return x, y

    def draw_line(vals, color, label):
        c.setStrokeColor(color)
        c.setLineWidth(2.2)
        pts = [xy(i, vals[i]) for i in range(13)]
        for (x1, y1), (x2, y2) in zip(pts, pts[1:]):
            c.line(x1, y1, x2, y2)
        c.setFillColor(color)
        for x, y in pts:
            c.circle(x, y, 2.5, fill=1, stroke=0)
        c.setFont(FONT, 9)
        c.drawString(pts[-1][0] - 52, pts[-1][1] + 8, label)

    draw_line(index_line, colors.HexColor("#7A8B99"), "指数想定 +10%")
    draw_line(floor_line, BLUE, "採用下限 +15%")
    draw_line(target, GREEN, "本命目標 +20%")
    draw_line(bull_line, AMBER, "強気上振れ +25%")

    c.setStrokeColor(NAVY)
    c.setLineWidth(1)
    c.line(chart_x, chart_y, chart_x + chart_w, chart_y)
    c.line(chart_x, chart_y, chart_x, chart_y + chart_h)
    for i, m in enumerate(months):
        x, _ = xy(i, min_v)
        c.setStrokeColor(LINE)
        c.line(x, chart_y - 4, x, chart_y)
        c.setFillColor(INK)
        c.setFont(FONT, 8.2)
        c.drawCentredString(x, chart_y - 18, m)

    markers = [(0, "初回\n72万〜96万"), (1, "5日/20日\n追加判定"), (2, "決算\n確認"), (5, "中間決算\n確認"), (8, "3Q\n確認"), (12, "1年\n評価")]
    for i, label in markers:
        x, y = xy(i, target[i])
        c.setStrokeColor(AMBER)
        c.setLineWidth(1)
        c.line(x, y + 8, x, chart_y + chart_h + 8)
        c.setFillColor(colors.HexColor("#FFF8E7"))
        c.setStrokeColor(colors.HexColor("#E3B15C"))
        c.roundRect(x - 36, chart_y + chart_h + 10, 72, 34, 6, fill=1, stroke=1)
        draw_wrapped(c, label, x - 30, chart_y + chart_h + 34, 60, 7.4, 9, INK, max_lines=2)

    rounded_box(c, 46, 64, 746, 74, colors.HexColor("#F6FAFD"), LINE, 8)
    c.setFillColor(NAVY)
    c.setFont(FONT, 11)
    c.drawString(60, 114, "読み方")
    note = "グラフは資産管理の目安です。指数想定+10%は比較対象であり、目標ではありません。採用下限+15%を下回るなら追加しません。本命+20%は75%投入、強気+25%は強い地合いで85%投入する場合だけの上振れ計画です。"
    draw_wrapped(c, note, 60, 94, 700, 10, 14, INK, max_lines=3)
    footer(c, 8)
    c.showPage()


def add_page_7(c: canvas.Canvas):
    title(c, "6月30日購入時の行動表", "いつ何をするか")
    intro = "以下は、6月30日に初回買付を行った場合の運用表です。買付日は固定せず、当日の急騰・急落・悪材料に該当すれば翌営業日に延期します。"
    draw_wrapped(c, intro, 46, 500, 746, 12, 18, INK)

    rows = [
        ("6/30", "初回買付", "基本案96万円。三越19.6万、日本ガイシ15.3万、ミネベア17.5万、SMFG21.8万、関電工21.8万。", "条件不一致分は現金待機。急騰+3%以上、指数急落、悪材料なら買わない。"),
        ("7月", "5営業日・20営業日確認", "追加0〜20%。対TOPIX、出来高、悪材料を確認。", "対TOPIX-5pt以下なら追加停止。"),
        ("8月", "4〜6月期決算確認", "決算が良い銘柄だけ追加候補。", "下方修正、利益率悪化、テーマ崩れは減額。"),
        ("9月", "月次点検", "保有比率と業種偏りを確認。", "銀行・保険など同業集中が強ければ追加しない。"),
        ("10月", "中間決算前確認", "決算またぎリスクを確認。", "過熱銘柄は20〜30%利益確定を検討。"),
        ("11月", "中間決算後確認", "決算後5日・20日の指数差を確認。", "決算失望なら追加停止、-10%なら半分減額を検討。"),
        ("12月", "年末点検", "NISA枠、現金比率、含み損益を確認。", "NISA損失は損益通算できないため無理に損出ししない。"),
        ("1月", "新年方針確認", "前年末の指数差とテーマ継続を確認。", "指数に劣後していれば個別株比率を下げる。"),
        ("2月", "3Q決算確認", "強い銘柄は維持、弱い銘柄は減額候補。", "決算後反応が弱い場合は追加しない。"),
        ("3月", "年度末リスク確認", "需給、権利、為替、金利を確認。", "急騰後の出来高増加下落は警戒。"),
        ("4月", "本決算前確認", "決算またぎをする銘柄と減額する銘柄を分ける。", "高PER・高ボラ銘柄は比率を抑える。"),
        ("5月", "本決算後確認", "次年度計画、配当、自己株買い、受注を確認。", "会社計画が弱い銘柄は入れ替え候補。"),
        ("6月", "1年評価", "S&P500/TOPIXとの差を確認し継続・縮小・入替。", "+1%以上上回れない場合は個別株比率を下げる。"),
    ]
    draw_schedule_table(c, rows, 48, 72)
    rounded_box(c, 48, 34, 746, 30, colors.HexColor("#FFF8E7"), colors.HexColor("#E3B15C"), 8)
    draw_wrapped(c, "この表は6月30日開始時の運用計画です。実際には、当日の株価、指数、為替、金利、ニュース、証券会社画面の注文条件を確認してから発注します。", 62, 54, 710, 9.2, 11.5, INK, max_lines=2)
    footer(c, 9)
    c.showPage()


def draw_schedule_table(c: canvas.Canvas, rows, x0, y_bottom):
    headers = ["時期", "作業", "行動", "停止・減額条件"]
    widths = [65, 130, 290, 260]
    y0 = 450
    row_h = 29
    c.setFillColor(LIGHT_BLUE)
    c.rect(x0, y0, sum(widths), 26, fill=1, stroke=0)
    c.setStrokeColor(LINE)
    xx = x0
    c.setFillColor(NAVY)
    c.setFont(FONT, 9)
    for h, w in zip(headers, widths):
        c.rect(xx, y0, w, 26, fill=0, stroke=1)
        c.drawString(xx + 5, y0 + 8, h)
        xx += w
    y = y0 - row_h
    for idx, row in enumerate(rows):
        c.setFillColor(colors.white if idx % 2 == 0 else colors.HexColor("#FBFDFF"))
        c.rect(x0, y, sum(widths), row_h, fill=1, stroke=0)
        xx = x0
        for val, w in zip(row, widths):
            c.setStrokeColor(LINE)
            c.rect(xx, y, w, row_h, fill=0, stroke=1)
            draw_wrapped(c, val, xx + 5, y + row_h - 10, w - 10, 7.8, 9.7, INK, max_lines=3)
            xx += w
        y -= row_h


def add_page_8(c: canvas.Canvas):
    title(c, "買い増し・売却の具体例", "条件に応じた行動例")
    intro = "以下は、6月30日に初回買付を行った後の具体例です。実際の金額は口座残高、株価、単元未満株の可否で調整しますが、判断の考え方はこの表に沿って確認します。"
    draw_wrapped(c, intro, 46, 500, 746, 12, 18, INK)

    c.setFillColor(NAVY)
    c.setFont(FONT, 14)
    c.drawString(46, 438, "買い増しの例")
    buy_rows = [
        ("例1: 20営業日後に強い", "初回10万円で購入。20営業日後に株価+8%、TOPIX+3%。対指数+5pt、悪材料なし。", "追加で資金全体の2〜3%、240万円なら約5万〜7万円を上限に買い増し。"),
        ("例2: 決算確認後に強い", "決算で会社計画が上振れ、営業利益率も改善。決算後5日で対TOPIX+3pt以上。", "一度に大きく買わず、候補1銘柄あたり3〜5万円を追加。業種集中が高い場合は半分にする。"),
        ("例3: 上がっているが過熱", "株価+12%だが、当日+4%以上急騰、出来高急増、ニュースで短期人気化。", "追い買いしない。翌営業日以降、出来高と価格が落ち着いてから再判定。"),
    ]
    draw_example_table(c, buy_rows, 46, 300, [130, 340, 270], ["場面", "確認内容", "行動"])

    c.setFillColor(NAVY)
    c.setFont(FONT, 14)
    c.drawString(46, 255, "売却・減額の例")
    sell_rows = [
        ("例1: 損失を抑える", "購入後-7%、または対TOPIXで-5pt以上劣後。理由が個別悪材料。", "追加停止。-10%に達したら保有の半分を売却候補にし、残りは翌営業日も確認。"),
        ("例2: 利益を一部守る", "購入後+15%以上。出来高急増、短期過熱、指数に対して急に伸びすぎ。", "保有の20〜30%を利益確定。テーマが継続していれば全売却ではなく一部を残す。"),
        ("例3: ストップ安・大幅売り気配", "寄付前から売り気配。理由が決算失望、事故、規制、急な悪材料。", "成行で慌てて売らない。理由、出来高、翌日の気配を確認。構造悪化なら減額、全体急落なら一時保留。"),
    ]
    draw_example_table(c, sell_rows, 46, 92, [130, 340, 270], ["場面", "確認内容", "行動"])

    rounded_box(c, 46, 34, 746, 38, colors.HexColor("#F6FAFD"), LINE, 8)
    note = "買い増しは、指数より強いこと、決算・材料が続くこと、過熱していないことを確認して小さく行います。売却は、損失拡大を止める売却と、利益を守る売却を分けます。"
    draw_wrapped(c, note, 60, 57, 710, 9.5, 12, INK, max_lines=2)
    footer(c, 10)
    c.showPage()


def draw_example_table(c: canvas.Canvas, rows, x0, y0, widths, headers):
    header_h = 24
    row_h = 56
    c.setFillColor(LIGHT_BLUE)
    c.rect(x0, y0 + row_h * len(rows), sum(widths), header_h, fill=1, stroke=0)
    xx = x0
    c.setStrokeColor(LINE)
    c.setFillColor(NAVY)
    c.setFont(FONT, 9)
    for h, w in zip(headers, widths):
        c.rect(xx, y0 + row_h * len(rows), w, header_h, fill=0, stroke=1)
        c.drawString(xx + 6, y0 + row_h * len(rows) + 8, h)
        xx += w
    for idx, row in enumerate(rows):
        y = y0 + row_h * (len(rows) - idx - 1)
        c.setFillColor(colors.white if idx % 2 == 0 else colors.HexColor("#FBFDFF"))
        c.rect(x0, y, sum(widths), row_h, fill=1, stroke=0)
        xx = x0
        for val, w in zip(row, widths):
            c.setStrokeColor(LINE)
            c.rect(xx, y, w, row_h, fill=0, stroke=1)
            draw_wrapped(c, val, xx + 6, y + row_h - 13, w - 12, 8.6, 11.5, INK, max_lines=4)
            xx += w


def add_page_9(c: canvas.Canvas):
    title(c, "日々の監視項目", "買った後に何を見るか")
    intro = "購入後は、株価だけで判断しません。指数、出来高、為替、金利、決算情報を同じ順番で確認し、追加・維持・減額を判断します。"
    draw_wrapped(c, intro, 46, 500, 746, 12, 18, INK)

    rows = [
        ("毎営業日", "個別株価", "前日比、出来高、寄付後の値動き", "+3%以上急騰なら追い買いしない。-5%以上下落なら理由確認。", "短期の過熱・悪材料を避けるため。"),
        ("毎営業日", "TOPIX/日経平均", "候補10社が指数より強いか", "対TOPIXで-5pt以上劣後なら追加停止。", "個別株を選ぶ意味が薄くなるため。"),
        ("毎営業日", "為替", "ドル円が急な円高/円安になっていないか", "1日で2円以上の円高は輸出・外需系を減額確認。", "為替で利益見通しが変わるため。"),
        ("毎営業日", "米10年金利", "金利が急騰していないか", "0.15%以上の急騰は高PER・グロースの追加停止。", "割高株が売られやすくなるため。"),
        ("週1回", "セクター集中", "銀行・保険・電力設備に偏りすぎていないか", "同一テーマ合計35%超は新規追加を抑制。", "同じ材料で一斉下落するリスクを抑えるため。"),
        ("月1回", "決算・会社計画", "売上、利益、EPS、配当、自己株買い", "下方修正、利益率悪化、受注悪化なら入替候補。", "株価の根拠となる業績が崩れたかを見るため。"),
    ]
    draw_monitor_table(c, rows, 36, 122)

    rounded_box(c, 46, 42, 746, 54, colors.HexColor("#FFF8E7"), colors.HexColor("#E3B15C"), 8)
    note = "監視の目的は、値動きに反応して売買を増やすことではなく、最初の選定根拠が崩れていないかを確認することです。根拠が崩れていない下落は保留、根拠が崩れた下落は減額・入替候補にします。"
    draw_wrapped(c, note, 60, 75, 710, 10, 13, INK, max_lines=3)
    footer(c, 11)
    c.showPage()


def draw_monitor_table(c: canvas.Canvas, rows, x0, y0):
    headers = ["頻度", "項目", "見る内容", "判断基準", "根拠"]
    widths = [58, 82, 200, 205, 185]
    row_h = 54
    header_h = 25
    top = y0 + row_h * len(rows)
    c.setFillColor(LIGHT_BLUE)
    c.rect(x0, top, sum(widths), header_h, fill=1, stroke=0)
    xx = x0
    c.setFillColor(NAVY)
    c.setFont(FONT, 8.5)
    for h, w in zip(headers, widths):
        c.setStrokeColor(LINE)
        c.rect(xx, top, w, header_h, fill=0, stroke=1)
        c.drawString(xx + 4, top + 8, h)
        xx += w
    for idx, row in enumerate(rows):
        y = y0 + row_h * (len(rows) - idx - 1)
        c.setFillColor(colors.white if idx % 2 == 0 else colors.HexColor("#FBFDFF"))
        c.rect(x0, y, sum(widths), row_h, fill=1, stroke=0)
        xx = x0
        for val, w in zip(row, widths):
            c.setStrokeColor(LINE)
            c.rect(xx, y, w, row_h, fill=0, stroke=1)
            draw_wrapped(c, val, xx + 4, y + row_h - 12, w - 8, 7.8, 10.2, INK, max_lines=4)
            xx += w


def add_page_10(c: canvas.Canvas):
    title(c, "入れ替え基準と利益影響", "どの条件で銘柄を替えるか")
    intro = "入れ替えは、気分やニュースの印象ではなく、選定時の根拠が崩れたか、より条件の良い候補が出たかで判断します。"
    draw_wrapped(c, intro, 46, 500, 746, 12, 18, INK)

    rows = [
        ("維持", "対TOPIXが±5pt以内、決算未悪化、出来高急増下落なし", "売買しない", "売買回数を増やさず、根拠が残る銘柄を維持。"),
        ("追加停止", "対TOPIX-5pt以下、または5営業日で弱い反応", "新規追加を停止", "弱い銘柄へ資金を足さない。"),
        ("一部減額", "購入後-10%、または決算失望・下方修正", "保有の50%を売却候補", "損失拡大を止め、資金を強い候補へ移す。"),
        ("利益確定", "+15%以上、かつ出来高急増・短期過熱", "20〜30%を売却", "利益を一部守り、残りで上昇継続を狙う。"),
        ("入れ替え", "A候補が既存銘柄よりEV+5pt以上、かつリスク同等以下", "弱い銘柄から5〜10%分を移す", "より期待値の高い候補へ資金効率を上げる。"),
    ]
    draw_replace_table(c, rows, 46, 245)

    c.setFillColor(NAVY)
    c.setFont(FONT, 14)
    c.drawString(46, 205, "利益見込みの変化例 240万円の場合")
    impact_rows = [
        ("弱い10%枠を維持", "10%枠=24万円、期待+3%", "+7,200円", "弱い銘柄をそのまま保有した場合"),
        ("強い候補へ入替", "10%枠=24万円、期待+10%", "+24,000円", "条件を満たすA候補へ入れ替えた場合"),
        ("差額", "期待差+7pt", "+16,800円", "1銘柄10%分の入替で増える期待利益"),
        ("2銘柄入替", "合計20%枠=48万円、期待差+7pt", "+33,600円", "2枠を改善できた場合の目安"),
        ("損失回避", "-10%銘柄を半分減額", "損失拡大を約12,000円抑制", "24万円枠の半分を早めに逃がした場合"),
    ]
    draw_impact_table(c, impact_rows, 46, 54)
    footer(c, 12)
    c.showPage()


def draw_replace_table(c: canvas.Canvas, rows, x0, y0):
    headers = ["判定", "条件", "行動", "根拠"]
    widths = [70, 310, 160, 210]
    row_h = 42
    header_h = 24
    top = y0 + row_h * len(rows)
    c.setFillColor(LIGHT_BLUE)
    c.rect(x0, top, sum(widths), header_h, fill=1, stroke=0)
    xx = x0
    c.setFillColor(NAVY)
    c.setFont(FONT, 8.8)
    for h, w in zip(headers, widths):
        c.setStrokeColor(LINE)
        c.rect(xx, top, w, header_h, fill=0, stroke=1)
        c.drawString(xx + 5, top + 8, h)
        xx += w
    for idx, row in enumerate(rows):
        y = y0 + row_h * (len(rows) - idx - 1)
        c.setFillColor(colors.white if idx % 2 == 0 else colors.HexColor("#FBFDFF"))
        c.rect(x0, y, sum(widths), row_h, fill=1, stroke=0)
        xx = x0
        for val, w in zip(row, widths):
            c.setStrokeColor(LINE)
            c.rect(xx, y, w, row_h, fill=0, stroke=1)
            draw_wrapped(c, val, xx + 5, y + row_h - 12, w - 10, 8, 10.5, INK, max_lines=3)
            xx += w


def draw_impact_table(c: canvas.Canvas, rows, x0, y0):
    headers = ["ケース", "前提", "1年の利益目安", "意味"]
    widths = [120, 230, 150, 250]
    row_h = 30
    header_h = 24
    top = y0 + row_h * len(rows)
    c.setFillColor(LIGHT_BLUE)
    c.rect(x0, top, sum(widths), header_h, fill=1, stroke=0)
    xx = x0
    c.setFillColor(NAVY)
    c.setFont(FONT, 8.8)
    for h, w in zip(headers, widths):
        c.setStrokeColor(LINE)
        c.rect(xx, top, w, header_h, fill=0, stroke=1)
        c.drawString(xx + 5, top + 8, h)
        xx += w
    for idx, row in enumerate(rows):
        y = y0 + row_h * (len(rows) - idx - 1)
        c.setFillColor(colors.white if idx % 2 == 0 else colors.HexColor("#FBFDFF"))
        c.rect(x0, y, sum(widths), row_h, fill=1, stroke=0)
        xx = x0
        for j, (val, w) in enumerate(zip(row, widths)):
            c.setStrokeColor(LINE)
            c.rect(xx, y, w, row_h, fill=0, stroke=1)
            color = GREEN if j == 2 and "+" in val else INK
            draw_wrapped(c, val, xx + 5, y + row_h - 11, w - 10, 8, 10, color, max_lines=2)
            xx += w
def build_pdf():
    c = canvas.Canvas(str(OUT_PDF), pagesize=landscape(A4))
    c.setTitle("正規10社 運用候補資料")
    add_page_1(c)
    add_page_2(c)
    add_page_3(c)
    add_page_4(c)
    add_page_5(c)
    add_page_6_plan(c)
    add_page_7_initial_buy(c)
    add_page_6(c)
    add_page_7(c)
    add_page_8(c)
    add_page_9(c)
    add_page_10(c)
    c.save()


def build_html():
    rows = "\n".join(
        f"""
        <tr>
          <td>{r['rank']}</td>
          <td><strong>{html.escape(r['ticker'])}</strong><br>{html.escape(r['name'])}</td>
          <td>{html.escape(r['role'])}</td>
          <td>{html.escape(r['sector'])}</td>
          <td>{r['ev']:.1f}%</td>
          <td>{r['risk']:.1f}</td>
          <td>{r['d20']:.2f}pt</td>
          <td>{html.escape(r['reason'])}</td>
          <td>{html.escape(r['rule'])}</td>
        </tr>
        """
        for r in CANDIDATES
    )
    html_text = f"""<!doctype html>
<html lang="ja">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>正規10社 運用候補資料</title>
  <style>
    :root{{--ink:#071927;--navy:#123a5a;--blue:#0b67a3;--line:#bfd5e8;--bg:#f4f8fb;--paper:#fff;--green:#11704f;--amber:#a26000;--red:#b42318}}
    *{{box-sizing:border-box}}
    body{{margin:0;background:var(--bg);color:var(--ink);font-family:-apple-system,BlinkMacSystemFont,"Segoe UI","Noto Sans JP",Meiryo,sans-serif;font-size:18px;line-height:1.75}}
    header{{background:linear-gradient(135deg,#123a5a,#0b67a3);color:#fff;padding:34px}}
    header h1{{margin:0 0 8px;font-size:42px;letter-spacing:0}}
    header p{{margin:0;max-width:1100px;font-weight:800}}
    main{{max-width:1180px;margin:0 auto;padding:24px}}
    section{{background:#fff;border:1px solid var(--line);border-radius:14px;padding:22px;margin:0 0 18px;box-shadow:0 8px 20px rgba(20,60,90,.08)}}
    h2{{margin:0 0 14px;border-left:8px solid var(--blue);padding-left:12px;color:var(--navy);font-size:28px}}
    .lead{{font-size:20px;font-weight:800}}
    .cards{{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:14px}}
    .card{{background:#f6fafd;border:1px solid var(--line);border-radius:12px;padding:16px}}
    .card b{{display:block;color:var(--blue);font-size:15px}}
    .card strong{{display:block;color:var(--navy);font-size:28px;line-height:1.2}}
    table{{width:100%;border-collapse:collapse;table-layout:fixed}}
    th,td{{border:1px solid var(--line);padding:10px;vertical-align:top;overflow-wrap:anywhere;font-size:14px}}
    th{{background:#eaf4fb;color:#123a5a;text-align:left}}
    .note{{border-left:6px solid var(--amber);background:#fff8e7;padding:14px;border-radius:10px;font-weight:850}}
    .btn{{display:inline-block;margin:8px 10px 0 0;padding:10px 14px;border:1px solid #8cc2e3;border-radius:10px;background:#f5fafe;color:#123a5a;text-decoration:none;font-weight:900}}
  </style>
</head>
<body>
  <header>
    <h1>正規10社 運用候補資料</h1>
    <p>同一の確認手順を通過した10銘柄を、初回検討用に整理した資料です。購入を確定するものではなく、発注前確認のために使用します。</p>
  </header>
  <main>
    <section>
      <h2>本資料の位置づけ</h2>
      <p class="lead">NISAでの個別株運用を検討するために、財務・事業テーマ・価格リスク・期待値の4項目を同じ基準で確認した10銘柄を整理しています。</p>
      <p>比較対象は主要インデックスです。個別株を選ぶ価値があるかを確認するため、運用後はS&amp;P500・TOPIX等との比較で継続評価します。</p>
      <a class="btn" href="regular10_client_material_20260625.pdf">PDFを開く</a>
      <a class="btn" href="regular10_return_target_execution_plan_20260625.csv">15/20/25計画CSV</a>
      <a class="btn" href="regular10_target_allocation_20260625.csv">投入比率CSV</a>
      <a class="btn" href="regular10_initial_buy_plan_20260625.csv">初回買付CSV</a>
      <a class="btn" href="purchase_gate_exact10_v65_20260624.html">正規10社の元データ</a>
    </section>
    <section>
      <h2>要点</h2>
      <div class="cards">
        <div class="card"><b>対象</b><strong>正規10社</strong><span>同一基準を通過</span></div>
        <div class="card"><b>初回</b><strong>主力5社</strong><span>基本案96万円 / 慎重案72万円</span></div>
        <div class="card"><b>投入</b><strong>30〜40%</strong><span>初回は全額投入しない</span></div>
        <div class="card"><b>評価</b><strong>指数比較</strong><span>S&amp;P500・TOPIX等</span></div>
        <div class="card"><b>採用下限</b><strong>+15%</strong><span>下回るなら追加しない</span></div>
        <div class="card"><b>本命目標</b><strong>+20%</strong><span>75%投入時の中心計画</span></div>
        <div class="card"><b>強気上振れ</b><strong>+25%</strong><span>強い地合いで85%まで</span></div>
        <div class="card"><b>運用</b><strong>条件分岐</strong><span>買わない条件を明文化</span></div>
      </div>
    </section>
    <section>
      <h2>正規10社一覧</h2>
      <table>
        <thead><tr><th>順位</th><th>銘柄</th><th>役割</th><th>業種</th><th>EV</th><th>リスク</th><th>20日指数差</th><th>主な根拠</th><th>運用上の扱い</th></tr></thead>
        <tbody>{rows}</tbody>
      </table>
      <p class="note">EVは候補間比較用の期待値指標であり、将来リターンを保証する数値ではありません。</p>
    </section>
  </main>
</body>
</html>
"""
    OUT_HTML.write_text(html_text, encoding="utf-8")


if __name__ == "__main__":
    build_pdf()
    build_html()
    print(OUT_PDF)
    print(OUT_HTML)
