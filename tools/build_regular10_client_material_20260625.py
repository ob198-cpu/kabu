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
    widths = [30, 95, 68, 105, 45, 45, 58, 230, 150]
    x0, y0 = 30, 496
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
        "初回は資金の30〜40%まで。240万円の場合は72万〜96万円を上限にします。",
        "初回主力5社を中心に、1銘柄の初回比率は資金全体の6〜8%を目安にします。",
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
        ("当日", "30〜40%", "主力5社を中心に初回買付。買わない条件に該当すれば延期。"),
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
    title(c, "期待値と確認項目", "初年度の評価目標")
    text = (
        "現時点の設計では、初年度の検証目標を年+10〜13%程度に置きます。"
        "この数値は利益の約束ではなく、個別株を選ぶ意味があるかを測るための評価ラインです。"
        "主要インデックスが強い場合は、インデックスとの差も合わせて確認します。"
    )
    draw_wrapped(c, text, 46, 474, 746, 12, 18, INK)

    c.setFillColor(NAVY)
    c.setFont(FONT, 13)
    c.drawString(46, 405, "240万円でのイメージ")
    scenarios = [
        ("防御", 0.03, "市場が不安定で買付を絞る"),
        ("基準", 0.10, "段階投入し、指数比較で継続"),
        ("目標", 0.13, "主力が機能し、指数を上回る"),
        ("悪化", -0.10, "急落・劣後で減額する"),
    ]
    x0, y0 = 60, 265
    base = 2_400_000
    max_bar = 2_750_000
    min_bar = 2_100_000
    for i, (label, rate, note) in enumerate(scenarios):
        amount = base * (1 + rate)
        y = y0 + i * 38
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
        c.drawString(x0 + 650, y + 4, note)

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


def build_pdf():
    c = canvas.Canvas(str(OUT_PDF), pagesize=landscape(A4))
    c.setTitle("正規10社 運用候補資料")
    add_page_1(c)
    add_page_2(c)
    add_page_3(c)
    add_page_4(c)
    add_page_5(c)
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
      <a class="btn" href="purchase_gate_exact10_v65_20260624.html">正規10社の元データ</a>
    </section>
    <section>
      <h2>要点</h2>
      <div class="cards">
        <div class="card"><b>対象</b><strong>正規10社</strong><span>同一基準を通過</span></div>
        <div class="card"><b>初回</b><strong>主力5社</strong><span>最初に確認する中心候補</span></div>
        <div class="card"><b>投入</b><strong>30〜40%</strong><span>初回は全額投入しない</span></div>
        <div class="card"><b>評価</b><strong>指数比較</strong><span>S&amp;P500・TOPIX等</span></div>
        <div class="card"><b>目安</b><strong>+10〜13%</strong><span>初年度の検証目標</span></div>
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
