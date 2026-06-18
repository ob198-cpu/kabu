from __future__ import annotations

import subprocess
from pathlib import Path

import pypdfium2 as pdfium


ROOT = Path(__file__).resolve().parents[1]
HTML_OUT = ROOT / "tomorrow_buy_plan_20260619.html"
PDF_OUT = ROOT / "tomorrow_buy_plan_20260619.pdf"
PREVIEW_PREFIX = ROOT / "tomorrow_buy_plan_20260619_page"
EDGE_PATH = Path(r"C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe")


stocks = [
    {"ticker": "8316", "name": "三井住友FG", "price": 6728, "stage1": 4, "stage2": 4, "role": "中心候補", "reason": "日銀後の銀行株反応が強く、金利テーマとの整合性がある。"},
    {"ticker": "8053", "name": "住友商事", "price": 6507, "stage1": 4, "stage2": 4, "role": "中心候補", "reason": "商社・資源・還元の複数材料。小幅安のため追い過ぎではない。"},
    {"ticker": "6501", "name": "日立製作所", "price": 4800, "stage1": 6, "stage2": 6, "role": "中心候補", "reason": "AIインフラ、電力、デジタルの横断テーマ。指数に対して大きく崩れていない。"},
    {"ticker": "6503", "name": "三菱電機", "price": 6056, "stage1": 4, "stage2": 4, "role": "確認候補", "reason": "FA、電力制御、防衛。イベント後反応は良好だが、事業寄与確認を残す。"},
    {"ticker": "7011", "name": "三菱重工業", "price": 3968, "stage1": 6, "stage2": 6, "role": "確認候補", "reason": "防衛、電力、エネルギーの構造需要。短期過熱には注意して小さく入る。"},
    {"ticker": "6762", "name": "TDK", "price": 3855, "stage1": 3, "stage2": 3, "role": "確認候補", "reason": "電子部品、AI端末、電池。反応は小幅のため少額で確認する。"},
    {"ticker": "8035", "name": "東京エレクトロン", "price": 76080, "stage1": 0, "stage2": 1, "role": "確認候補", "reason": "装置株代表。反応は強いが高PER注意のため、午後条件通過時に1株だけ。"},
]

hold_stocks = [
    {"ticker": "6857", "name": "アドバンテスト", "reason": "AI半導体検査装置の有力候補だが、高PER・高ボラで米国休場前後の確認が不足。"},
    {"ticker": "6146", "name": "ディスコ", "reason": "構造優位はあるが値動きが大きく、明日の初回小口購入では保留。"},
    {"ticker": "5803", "name": "フジクラ", "reason": "イベント後に前日比-5.67%の下落が出ており、反発確認まで初回対象外。"},
]


def yen(value: int | float) -> str:
    return f"{round(value):,}円"


def amount(row: dict, key: str) -> int:
    return int(row["price"] * row[key])


def build_html() -> str:
    stage1_total = sum(amount(row, "stage1") for row in stocks)
    stage2_total = sum(amount(row, "stage2") for row in stocks)
    total = stage1_total + stage2_total

    stock_rows = []
    for row in stocks:
        s1 = amount(row, "stage1")
        s2 = amount(row, "stage2")
        total_shares = row["stage1"] + row["stage2"]
        stock_rows.append(
            f"""
            <tr>
              <td>{row["ticker"]}</td>
              <td><b>{row["name"]}</b><br><span>{row["role"]}</span></td>
              <td>{yen(row["price"])}</td>
              <td>{row["stage1"]}株<br>{yen(s1)}</td>
              <td>{row["stage2"]}株<br>{yen(s2)}</td>
              <td><b>{total_shares}株</b><br>{yen(s1 + s2)}</td>
              <td>{row["reason"]}</td>
            </tr>
            """
        )

    hold_rows = []
    for row in hold_stocks:
        hold_rows.append(
            f"""
            <tr>
              <td>{row["ticker"]}</td>
              <td><b>{row["name"]}</b></td>
              <td>0円</td>
              <td>{row["reason"]}</td>
            </tr>
            """
        )

    return f"""<!doctype html>
<html lang="ja">
<head>
  <meta charset="utf-8">
  <title>6月19日 初回購入計画書</title>
  <style>
    @page {{ size: A4 landscape; margin: 8mm; }}
    * {{ box-sizing: border-box; }}
    body {{
      margin: 0;
      font-family: "Yu Gothic", "Meiryo", sans-serif;
      color: #061827;
      background: #fff;
      font-size: 18px;
      line-height: 1.42;
    }}
    .page {{
      page-break-after: always;
      padding: 4mm 6mm;
    }}
    .page:last-child {{ page-break-after: auto; }}
    h1 {{
      margin: 0 0 10px;
      font-size: 36px;
      line-height: 1.15;
      color: #0b3b63;
    }}
    h2 {{
      margin: 0 0 10px;
      font-size: 26px;
      color: #0b3b63;
      border-left: 9px solid #0b67a3;
      padding-left: 12px;
    }}
    h3 {{
      margin: 10px 0 8px;
      font-size: 24px;
      color: #0b3b63;
    }}
    p {{ margin: 0 0 10px; }}
    .lead {{
      font-size: 21px;
      font-weight: 900;
      color: #061827;
      border: 2px solid #c9dceb;
      background: #f4f8fb;
      padding: 14px 16px;
      border-radius: 12px;
    }}
    .cards {{
      display: grid;
      grid-template-columns: repeat(4, 1fr);
      gap: 10px;
      margin: 10px 0;
    }}
    .card {{
      border: 2px solid #c9dceb;
      background: #fbfdff;
      border-radius: 12px;
      padding: 9px;
      min-height: 84px;
    }}
    .card .label {{
      display: block;
      font-size: 16px;
      font-weight: 900;
      color: #0b3b63;
    }}
    .card .value {{
      display: block;
      font-size: 28px;
      font-weight: 950;
      color: #0b67a3;
      line-height: 1.25;
    }}
    table {{
      width: 100%;
      border-collapse: collapse;
      table-layout: fixed;
      margin: 10px 0 14px;
    }}
    tr {{ page-break-inside: avoid; }}
    th, td {{
      border: 1.5px solid #c9dceb;
      padding: 4px 6px;
      vertical-align: top;
      overflow-wrap: anywhere;
      word-break: normal;
    }}
    th {{
      background: #e6f1fa;
      color: #063b63;
      text-align: left;
      font-size: 15px;
    }}
    td {{ font-size: 15px; }}
    .ok {{ color: #116b4f; font-weight: 950; }}
    .warn {{ color: #9a5b00; font-weight: 950; }}
    .bad {{ color: #b42318; font-weight: 950; }}
    .note {{
      border: 2px solid #d8b365;
      background: #fff8e8;
      border-radius: 12px;
      padding: 10px 12px;
      font-size: 17px;
      font-weight: 900;
    }}
    .small {{ font-size: 16px; color: #2f4558; font-weight: 800; }}
    ol {{ margin: 6px 0 0 28px; padding: 0; }}
    li {{ margin: 0 0 8px; font-weight: 850; }}
  </style>
</head>
<body>
  <section class="page">
    <h1>6月19日 初回購入計画書</h1>
    <p class="lead">明日買う場合の計画です。結論は、全10社を買うのではなく、保留銘柄を外し、確認できている7社だけを単元未満株で2回に分けて買う案です。</p>
    <div class="cards">
      <div class="card"><span class="label">前提資金</span><span class="value">240万円</span><p>1口座あたり</p></div>
      <div class="card"><span class="label">明日の上限</span><span class="value">36万円</span><p>イベント注意ありの15%</p></div>
      <div class="card"><span class="label">実際の予定額</span><span class="value">{yen(total)}</span><p>価格変動時は36万円以内に調整</p></div>
      <div class="card"><span class="label">注文方式</span><span class="value">単元未満</span><p>S株・かぶミニ等が前提</p></div>
    </div>
    <div class="note">100株単元だけで買う場合、この36万円計画は実行できません。候補銘柄は100株単位だと最低購入額が大きいため、明日の計画は単元未満株を使う場合だけ成立します。</div>

    <h2>明日の時間割</h2>
    <table>
      <thead><tr><th style="width:16%;">時間</th><th style="width:28%;">作業</th><th>判断</th></tr></thead>
      <tbody>
        <tr><td>8:20〜8:50</td><td>為替、日経先物、金利、ニュースを確認</td><td>円高ショック、指数急落、候補銘柄の悪材料があれば買わない。</td></tr>
        <tr><td>9:00〜9:30</td><td>寄付き直後は注文しない</td><td>米国市場が休場のため、朝一の値動きだけで判断しない。</td></tr>
        <tr><td>9:35目安</td><td>第1回注文</td><td>中心候補を中心に約14.1万円。半導体の大型注文はまだ入れない。</td></tr>
        <tr><td>12:45目安</td><td>第2回注文</td><td>前場で崩れていなければ約21.7万円を追加。東京エレクトロンはここで1株だけ。</td></tr>
        <tr><td>14:45〜15:00</td><td>終値前チェック</td><td>明日は追加しない。記録だけ残し、翌営業日に再判定する。</td></tr>
      </tbody>
    </table>
  </section>

  <section class="page">
    <h2>買う候補と金額</h2>
    <table>
      <thead>
        <tr>
          <th style="width:8%;">コード</th>
          <th style="width:15%;">銘柄</th>
          <th style="width:10%;">参考株価</th>
          <th style="width:12%;">9:35</th>
          <th style="width:12%;">12:45</th>
          <th style="width:12%;">合計</th>
          <th>理由</th>
        </tr>
      </thead>
      <tbody>
        {''.join(stock_rows)}
      </tbody>
    </table>
    <div class="note">金額確認: 第1回 {yen(stage1_total)} / 第2回 {yen(stage2_total)} / 合計 {yen(total)} / 残す現金 {yen(2_400_000 - total)}。実際の発注時は証券会社画面の価格で36万円以内に調整します。</div>
  </section>

  <section class="page">
    <h2>明日は買わない候補</h2>
    <table>
      <thead><tr><th style="width:12%;">コード</th><th style="width:20%;">銘柄</th><th style="width:12%;">明日</th><th>理由</th></tr></thead>
      <tbody>
        {''.join(hold_rows)}
      </tbody>
    </table>

    <h2>買わない条件</h2>
    <table>
      <thead><tr><th style="width:30%;">条件</th><th>対応</th></tr></thead>
      <tbody>
        <tr><td>日経平均またはTOPIXが9:30時点で-1.5%以上</td><td>第1回注文を中止。午後に再確認。</td></tr>
        <tr><td>ドル円が158.5円以下、または急な円高</td><td>輸出・半導体・電子部品を買わない。全体も原則停止。</td></tr>
        <tr><td>対象銘柄が寄付き後+5%以上</td><td>追わない。翌営業日以降に回す。</td></tr>
        <tr><td>対象銘柄が-5%以上で下落理由不明</td><td>押し目買いにしない。理由確認まで保留。</td></tr>
        <tr><td>本人別NISA口座、注文画面、残枠、入金が未確認</td><td>実注文しない。計画表の確認だけで止める。</td></tr>
      </tbody>
    </table>
    <p class="small">参考株価は2026年6月18日にシステムへ反映した値です。実際の発注時は証券会社画面の価格で36万円以内に調整します。本資料は投資助言・利益保証・自動売買指示ではありません。</p>
  </section>
</body>
</html>
"""


def build_pdf() -> None:
    subprocess.run(
        [
            str(EDGE_PATH),
            "--headless",
            f"--print-to-pdf={PDF_OUT}",
            str(HTML_OUT),
        ],
        check=True,
    )


def render_previews() -> None:
    for old in ROOT.glob(f"{PREVIEW_PREFIX.name}*.png"):
        old.unlink()
    pdf = pdfium.PdfDocument(str(PDF_OUT))
    for index in range(len(pdf)):
        page = pdf[index]
        image = page.render(scale=2).to_pil()
        image.save(ROOT / f"{PREVIEW_PREFIX.name}{index + 1}.png")


def main() -> None:
    HTML_OUT.write_text(build_html(), encoding="utf-8")
    build_pdf()
    render_previews()
    print(HTML_OUT)
    print(PDF_OUT)


if __name__ == "__main__":
    main()
