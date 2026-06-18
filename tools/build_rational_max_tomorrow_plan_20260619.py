from __future__ import annotations

import csv
import html
import subprocess
from datetime import datetime
from pathlib import Path

import pypdfium2 as pdfium


ROOT = Path(__file__).resolve().parents[1]
DATA_ROOT = ROOT.parent
HTML_OUT = ROOT / "rational_max_tomorrow_buy_plan_20260619.html"
PDF_OUT = ROOT / "rational_max_tomorrow_buy_plan_20260619.pdf"
PREVIEW_PREFIX = ROOT / "rational_max_tomorrow_buy_plan_20260619_page"
EDGE_PATH = Path(r"C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe")


CAPITAL = 2_400_000
TOMORROW_CAP = 360_000


SELECTED = [
    {
        "code": "8316",
        "ticker": "8316.T",
        "name": "三井住友FG",
        "stage1": 4,
        "stage2": 4,
        "role": "中心",
        "why": "100社再選定点80.1、財務pass、イベント後反応+4.31%。金利テーマが実際の株価反応にも出たため中心に残す。",
    },
    {
        "code": "8053",
        "ticker": "8053.T",
        "name": "住友商事",
        "stage1": 4,
        "stage2": 4,
        "role": "中心",
        "why": "100社再選定点82.4で上位。直近反応は小幅安だが、商社・資源・還元の分散枠として残す。",
    },
    {
        "code": "8306",
        "ticker": "8306.T",
        "name": "三菱UFJ FG",
        "stage1": 8,
        "stage2": 8,
        "role": "差替",
        "why": "100社再選定点78.7。銀行枠を三井住友FGだけに寄せず、同じ金利テーマ内で分散するため追加。",
    },
    {
        "code": "1605",
        "ticker": "1605.T",
        "name": "INPEX",
        "stage1": 7,
        "stage2": 7,
        "role": "差替",
        "why": "100社再選定点78.4。地政学・資源価格のヘッジとして入り、既存候補より初回の説明がしやすい。",
    },
    {
        "code": "6501",
        "ticker": "6501.T",
        "name": "日立製作所",
        "stage1": 5,
        "stage2": 4,
        "role": "中心",
        "why": "財務pass、AIインフラ・電力・デジタルの横断テーマ。過度な半導体単独リスクを薄めるため残す。",
    },
    {
        "code": "6503",
        "ticker": "6503.T",
        "name": "三菱電機",
        "stage1": 3,
        "stage2": 3,
        "role": "条件付き",
        "why": "100社再選定点77.8、イベント後反応+3.29%。FA・電力制御・防衛でテーマ性はあるが、財務確認はpartialなので小口。",
    },
    {
        "code": "5802",
        "ticker": "5802.T",
        "name": "住友電工",
        "stage1": 1,
        "stage2": 2,
        "role": "攻め小口",
        "why": "100社再選定点83.7で高い。データセンター・電線テーマを入れるが、急騰後反動確認が必要なため小口に限定。",
    },
    {
        "code": "6762",
        "ticker": "6762.T",
        "name": "TDK",
        "stage1": 4,
        "stage2": 4,
        "role": "条件付き",
        "why": "100社再選定点66.1。電子部品・電池・AI端末テーマを少額で確認。財務確認partialのため比率は上げない。",
    },
]


REMOVED = [
    {
        "ticker": "7011.T",
        "name": "三菱重工業",
        "treatment": "初回買付から外す",
        "reason": "100社再選定表で除外。直近1年でS&P500に劣後、60日騰落も弱い。イベント反応だけで初回資金を入れない。",
    },
    {
        "ticker": "8035.T",
        "name": "東京エレクトロン",
        "treatment": "初回買付から外す",
        "reason": "100社再選定表で監視。6/18反応は強いが、1株金額が大きく360,000円枠の中でリスク集中しやすい。",
    },
    {
        "ticker": "6857.T",
        "name": "アドバンテスト",
        "treatment": "保留",
        "reason": "半導体検査装置の有力候補だが、高PER・高ボラ。SOX/NASDAQと米金利の確認後に小口再検討。",
    },
    {
        "ticker": "6146.T",
        "name": "ディスコ",
        "treatment": "保留",
        "reason": "構造優位はあるが、再選定表で除外。直近60日が弱く、5年最大下落率も大きいため初回は買わない。",
    },
    {
        "ticker": "5803.T",
        "name": "フジクラ",
        "treatment": "保留",
        "reason": "データセンター・電線テーマは強いが、急騰後反動の警戒が大きい。反発確認後に再審査。",
    },
]


WAITING_FOR_PRICE = [
    {
        "ticker": "8002.T",
        "name": "丸紅",
        "score": "81.9",
        "reason": "100社再選定点は高いが、6/18価格スナップショットが今回の注文表にないため明日の数量表には入れない。",
    },
    {
        "ticker": "8058.T",
        "name": "三菱商事",
        "score": "80.6",
        "reason": "上位候補だが、明日の発注数量を確定するには証券画面または最新価格の再確認が必要。",
    },
    {
        "ticker": "8031.T",
        "name": "三井物産",
        "score": "76.1",
        "reason": "商社枠の差替候補。価格取得後、住友商事・INPEXとの重複を見て再配分する。",
    },
    {
        "ticker": "8411.T",
        "name": "みずほFG",
        "score": "75.9",
        "reason": "銀行枠の追加候補。三井住友FG・三菱UFJとの集中を見て使う。",
    },
    {
        "ticker": "8725.T",
        "name": "MS&AD",
        "score": "75.4",
        "reason": "保険枠候補。金融内の分散候補だが、今回は価格未確認のため待機。",
    },
]


def read_latest_prices() -> dict[str, dict[str, str]]:
    path = DATA_ROOT / "data" / "intraday_snapshots.csv"
    latest: dict[str, dict[str, str]] = {}
    with path.open("r", encoding="utf-8-sig", newline="") as f:
        reader = csv.reader(f)
        for row in reader:
            if len(row) < 12:
                continue
            date, time, code = row[0], row[1], row[2]
            try:
                datetime.strptime(date + " " + time, "%Y-%m-%d %H:%M")
                float(row[4])
            except Exception:
                continue
            latest[code] = {
                "date": date,
                "time": time,
                "code": code,
                "name": row[3],
                "price": row[4],
                "change": row[5],
                "change_pct": row[6],
                "high": row[7],
                "low": row[8],
                "volume": row[9],
                "source": row[10],
                "memo": row[11],
            }
    return latest


def read_universe_metrics() -> dict[str, dict[str, str]]:
    path = ROOT / "780_universe100_reselection_metrics_20260528.csv"
    out: dict[str, dict[str, str]] = {}
    with path.open("r", encoding="utf-8-sig", newline="") as f:
        for row in csv.DictReader(f):
            out[row["コード"]] = row
    return out


def read_event_metrics() -> dict[str, dict[str, str]]:
    path = ROOT / "106_june_event_engine_output.csv"
    out: dict[str, dict[str, str]] = {}
    with path.open("r", encoding="utf-8-sig", newline="") as f:
        for row in csv.DictReader(f):
            out[row["ticker"]] = row
    return out


def yen(value: float | int) -> str:
    return f"{round(value):,}円"


def pct(value: str | float | int) -> str:
    try:
        v = float(str(value).replace("%", ""))
    except Exception:
        return str(value)
    sign = "+" if v > 0 else ""
    return f"{sign}{v:.2f}%"


def esc(value: object) -> str:
    return html.escape(str(value), quote=True)


def build_rows() -> tuple[list[dict[str, object]], int, int, int]:
    prices = read_latest_prices()
    universe = read_universe_metrics()
    events = read_event_metrics()
    rows: list[dict[str, object]] = []
    stage1_total = 0
    stage2_total = 0
    for item in SELECTED:
        price_row = prices[item["code"]]
        price = float(price_row["price"])
        s1 = int(round(price * item["stage1"]))
        s2 = int(round(price * item["stage2"]))
        stage1_total += s1
        stage2_total += s2
        u = universe.get(item["ticker"], {})
        e = events.get(item["ticker"], {})
        rows.append(
            {
                **item,
                "price": price,
                "change_pct": price_row["change_pct"],
                "high": price_row["high"],
                "low": price_row["low"],
                "source_time": price_row["date"] + " " + price_row["time"],
                "score": u.get("再選定点", ""),
                "status": u.get("最終扱い", ""),
                "cagr5": u.get("5年CAGR", ""),
                "cagr10": u.get("10年CAGR", ""),
                "max_dd": u.get("5年最大下落率", ""),
                "event_change": e.get("one_day_change_pct", ""),
                "event_signal": e.get("market_signal", ""),
                "s1_amount": s1,
                "s2_amount": s2,
                "total_amount": s1 + s2,
                "total_shares": item["stage1"] + item["stage2"],
            }
        )
    return rows, stage1_total, stage2_total, stage1_total + stage2_total


def build_html() -> str:
    rows, stage1_total, stage2_total, total = build_rows()
    generated_at = datetime.now().strftime("%Y/%m/%d %H:%M")
    cash_after = CAPITAL - total

    action_rows = []
    for row in rows:
        action_rows.append(
            f"""
            <tr>
              <td><b>{esc(row['ticker'])}</b><br>{esc(row['name'])}</td>
              <td>{esc(row['role'])}</td>
              <td>{yen(row['price'])}<br><span class="{ 'plus' if float(row['change_pct']) >= 0 else 'minus' }">{pct(row['change_pct'])}</span></td>
              <td>{esc(row['stage1'])}株<br>{yen(row['s1_amount'])}</td>
              <td>{esc(row['stage2'])}株<br>{yen(row['s2_amount'])}</td>
              <td><b>{esc(row['total_shares'])}株</b><br>{yen(row['total_amount'])}</td>
              <td>{esc(row['score'])}点<br>{esc(row['status'])}</td>
              <td>{esc(row['why'])}</td>
            </tr>
            """
        )

    evidence_rows = []
    for row in rows:
        evidence_rows.append(
            f"""
            <tr>
              <td><b>{esc(row['ticker'])}</b><br>{esc(row['name'])}</td>
              <td>{esc(row['score'])}</td>
              <td>{esc(row['cagr5'])}%</td>
              <td>{esc(row['cagr10'])}%</td>
              <td>{esc(row['max_dd'])}%</td>
              <td>{esc(row['event_change'])}</td>
              <td>{esc(row['source_time'])}</td>
            </tr>
            """
        )

    removed_rows = []
    for row in REMOVED:
        removed_rows.append(
            f"""
            <tr>
              <td><b>{esc(row['ticker'])}</b><br>{esc(row['name'])}</td>
              <td>{esc(row['treatment'])}</td>
              <td>{esc(row['reason'])}</td>
            </tr>
            """
        )

    waiting_rows = []
    for row in WAITING_FOR_PRICE:
        waiting_rows.append(
            f"""
            <tr>
              <td><b>{esc(row['ticker'])}</b><br>{esc(row['name'])}</td>
              <td>{esc(row['score'])}</td>
              <td>{esc(row['reason'])}</td>
            </tr>
            """
        )

    return f"""<!doctype html>
<html lang="ja">
<head>
  <meta charset="utf-8">
  <title>6月19日 初回購入計画 差替版</title>
  <style>
    @page {{ size: A4 landscape; margin: 8mm; }}
    * {{ box-sizing: border-box; }}
    body {{
      margin: 0;
      font-family: "Yu Gothic", "Meiryo", sans-serif;
      color: #071827;
      background: #fff;
      font-size: 16px;
      line-height: 1.38;
    }}
    .page {{
      page-break-after: always;
      padding: 3mm 5mm;
    }}
    .page:last-child {{ page-break-after: auto; }}
    h1 {{
      margin: 0 0 10px;
      font-size: 32px;
      line-height: 1.15;
      color: #063b63;
      letter-spacing: 0;
    }}
    h2 {{
      margin: 0 0 9px;
      font-size: 23px;
      color: #063b63;
      border-left: 8px solid #0b67a3;
      padding-left: 10px;
      break-after: avoid;
    }}
    p {{ margin: 0 0 8px; }}
    .lead {{
      font-size: 19px;
      font-weight: 900;
      border: 2px solid #c7d9e8;
      background: #f5f9fc;
      padding: 11px 13px;
      border-radius: 10px;
    }}
    .cards {{
      display: grid;
      grid-template-columns: repeat(5, 1fr);
      gap: 8px;
      margin: 9px 0 12px;
    }}
    .card {{
      border: 2px solid #c7d9e8;
      background: #fbfdff;
      border-radius: 10px;
      padding: 8px 9px;
      min-height: 78px;
    }}
    .card .label {{
      display: block;
      color: #063b63;
      font-size: 13px;
      font-weight: 900;
    }}
    .card .value {{
      display: block;
      color: #0b67a3;
      font-size: 25px;
      line-height: 1.22;
      font-weight: 950;
    }}
    .rule {{
      border: 2px solid #d6a84d;
      background: #fff8e7;
      border-radius: 10px;
      padding: 9px 12px;
      font-weight: 900;
      margin: 8px 0 10px;
    }}
    table {{
      width: 100%;
      border-collapse: collapse;
      table-layout: fixed;
      margin: 8px 0 12px;
    }}
    tr, .block {{ break-inside: avoid; page-break-inside: avoid; }}
    th, td {{
      border: 1.4px solid #c9dceb;
      padding: 5px 6px;
      vertical-align: top;
      overflow-wrap: anywhere;
    }}
    th {{
      background: #e6f1fa;
      color: #063b63;
      text-align: left;
      font-size: 14px;
    }}
    td {{ font-size: 13.8px; }}
    .plus {{ color: #087a54; font-weight: 950; }}
    .minus {{ color: #b42318; font-weight: 950; }}
    .small {{
      font-size: 13px;
      color: #30485b;
      font-weight: 800;
    }}
    .flow {{
      display: grid;
      grid-template-columns: repeat(5, 1fr);
      gap: 7px;
      margin: 8px 0 10px;
    }}
    .step {{
      border: 2px solid #bcd5e8;
      background: #f7fbfe;
      border-radius: 9px;
      padding: 8px;
      font-size: 14px;
      font-weight: 900;
      min-height: 80px;
    }}
    .step b {{ display: block; color: #063b63; font-size: 16px; margin-bottom: 3px; }}
  </style>
</head>
<body>
  <section class="page">
    <h1>6月19日 初回購入計画 差替版</h1>
    <p class="lead">目的は、初期候補に固定せず、同じ審査を通した候補から明日の初回買付枠を最大限合理化することです。6月18日時点のイベント後データと価格が確認できる銘柄だけで、360,000円以内の実行表に組み直しました。</p>
    <div class="cards">
      <div class="card"><span class="label">1口座の前提資金</span><span class="value">{yen(CAPITAL)}</span><p>今回のNISAテスト前提</p></div>
      <div class="card"><span class="label">明日の上限</span><span class="value">{yen(TOMORROW_CAP)}</span><p>イベント注意ありのため15%</p></div>
      <div class="card"><span class="label">実行予定額</span><span class="value">{yen(total)}</span><p>上限内で再配分</p></div>
      <div class="card"><span class="label">購入候補</span><span class="value">8銘柄</span><p>同一審査通過分</p></div>
      <div class="card"><span class="label">残す現金</span><span class="value">{yen(cash_after)}</span><p>追加判断・急落対応</p></div>
    </div>
    <div class="flow">
      <div class="step"><b>1. 母集団</b>100社前後の再選定表を見る</div>
      <div class="step"><b>2. 除外</b>除外・保留・価格未確認を分ける</div>
      <div class="step"><b>3. イベント</b>6/18後の反応を見る</div>
      <div class="step"><b>4. 金額化</b>価格がある銘柄だけ数量化</div>
      <div class="step"><b>5. 発注前停止</b>証券画面で価格・口座・NISA区分を確認</div>
    </div>
    <div class="rule">今回の結論: 三菱重工業・東京エレクトロンを初回買付から外し、三菱UFJ FG・INPEX・住友電工を加える。理由は、イベント反応だけでなく、100社再選定点、除外判定、価格取得可否、初回買付リスクを同時に見たためです。</div>
    <h2>差替の要点</h2>
    <table>
      <thead><tr><th style="width:24%;">判断</th><th style="width:28%;">対象</th><th>理由</th></tr></thead>
      <tbody>
        <tr><td>中心に残す</td><td>三井住友FG、住友商事、日立製作所</td><td>既存候補の中で、財務確認・テーマ性・イベント後反応の説明が比較的そろっている。</td></tr>
        <tr><td>新しく入れる</td><td>三菱UFJ FG、INPEX、住友電工</td><td>100社再選定表で上位にあり、最新価格も取得済み。既存候補より初回買付の説明がしやすい。</td></tr>
        <tr><td>小口で確認</td><td>三菱電機、TDK</td><td>テーマ性とイベント後反応はあるが、財務確認がpartialなので比率を上げない。</td></tr>
      </tbody>
    </table>

  </section>

  <section class="page">
    <h2>明日の実行表</h2>
    <table>
      <thead>
        <tr>
          <th style="width:10%;">銘柄</th>
          <th style="width:7%;">扱い</th>
          <th style="width:10%;">参照価格</th>
          <th style="width:9%;">9:35</th>
          <th style="width:9%;">12:45</th>
          <th style="width:9%;">合計</th>
          <th style="width:9%;">再選定</th>
          <th>採用理由</th>
        </tr>
      </thead>
      <tbody>{''.join(action_rows)}</tbody>
    </table>
    <p class="small">生成日時: {generated_at}。参照価格はシステム内の6/18取得値です。実発注時は証券会社画面の現在値で360,000円以内に再調整します。</p>
  </section>

  <section class="page">
    <h2>再計算で見た根拠</h2>
    <table>
      <thead>
        <tr>
          <th style="width:13%;">銘柄</th>
          <th style="width:9%;">再選定点</th>
          <th style="width:9%;">5年CAGR</th>
          <th style="width:9%;">10年CAGR</th>
          <th style="width:10%;">5年最大下落</th>
          <th style="width:12%;">イベント後反応</th>
          <th style="width:16%;">価格取得時刻</th>
        </tr>
      </thead>
      <tbody>{''.join(evidence_rows)}</tbody>
    </table>
    <div class="rule">CAGRは「平均すると毎年何%増えたか」です。高いほど成長実績は強い一方、最大下落率が大きい銘柄は、初回買付では比率を抑えます。</div>

  </section>

  <section class="page">
    <h2>初回から外す銘柄</h2>
    <table>
      <thead><tr><th style="width:16%;">銘柄</th><th style="width:14%;">明日の扱い</th><th>理由</th></tr></thead>
      <tbody>{''.join(removed_rows)}</tbody>
    </table>

    <h2>価格確認後の差替候補</h2>
    <table>
      <thead><tr><th style="width:16%;">銘柄</th><th style="width:10%;">再選定点</th><th>扱い</th></tr></thead>
      <tbody>{''.join(waiting_rows)}</tbody>
    </table>

  </section>

  <section class="page">
    <h2>買わない条件</h2>
    <table>
      <thead><tr><th style="width:30%;">条件</th><th>対応</th></tr></thead>
      <tbody>
        <tr><td>寄付き後、日経平均またはTOPIXが急落し、9:30時点で-1.5%以上</td><td>第1回注文を止める。12:45に再確認し、戻らなければ買わない。</td></tr>
        <tr><td>対象銘柄が前日比-5%以上で下落理由が不明</td><td>その銘柄だけ買わない。理由が確認できるまで翌営業日以降へ回す。</td></tr>
        <tr><td>円高ショック、米金利急騰、半導体指数の大幅悪化が同時に出る</td><td>電子部品・半導体・輸出寄りの銘柄を止め、銀行・商社・資源中心に限定する。</td></tr>
        <tr><td>本人別NISA口座、注文口座区分、買付余力、取引パスワードが未確認</td><td>実注文はしない。計画表の確認だけで止める。</td></tr>
        <tr><td>価格上昇で予定額が360,000円を超える</td><td>TDK、三菱電機、住友電工の順に株数を1株ずつ減らす。</td></tr>
      </tbody>
    </table>
    <p class="small">この資料は購入判断の補助資料です。利回り保証、投資助言、発注指示、自動売買ではありません。発注前に証券会社画面の価格、NISA区分、買付余力、最新ニュースを確認します。</p>
  </section>
</body>
</html>
"""


def write_pdf_from_html() -> None:
    if not EDGE_PATH.exists():
        raise FileNotFoundError(f"Edge not found: {EDGE_PATH}")
    HTML_OUT.write_text(build_html(), encoding="utf-8")
    if PDF_OUT.exists():
        PDF_OUT.unlink()
    cmd = [
        str(EDGE_PATH),
        "--headless",
        "--disable-gpu",
        f"--print-to-pdf={PDF_OUT}",
        "--print-to-pdf-no-header",
        str(HTML_OUT),
    ]
    subprocess.run(cmd, check=True)


def render_previews() -> list[Path]:
    pdf = pdfium.PdfDocument(str(PDF_OUT))
    paths: list[Path] = []
    for i in range(len(pdf)):
        page = pdf[i]
        bitmap = page.render(scale=1.4).to_pil()
        out = ROOT / f"{PREVIEW_PREFIX.name}_{i + 1}.png"
        bitmap.save(out)
        paths.append(out)
    return paths


def main() -> None:
    write_pdf_from_html()
    pages = render_previews()
    print(f"HTML: {HTML_OUT}")
    print(f"PDF: {PDF_OUT}")
    print("Preview pages:")
    for page in pages:
        print(page)


if __name__ == "__main__":
    main()
