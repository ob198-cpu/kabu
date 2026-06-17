from __future__ import annotations

import csv
import subprocess
from pathlib import Path

import pypdfium2 as pdfium


ROOT = Path(__file__).resolve().parents[1]
RULES_CSV = ROOT / "107_capital_allocation_rules.csv"
ALLOCATION_CSV = ROOT / "108_capital_allocation_by_ticker.csv"
HTML_OUT = ROOT / "one_year_money_flow_simulation_20260616.html"
PDF_OUT = ROOT / "one_year_money_flow_simulation_20260616.pdf"
PREVIEW_PREFIX = ROOT / "one_year_money_flow_simulation_20260616_page"
EDGE_PATH = Path(r"C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe")

ATTACK_TICKERS = ["6857.T", "8035.T", "6762.T", "6146.T", "5803.T"]


def read_rules() -> dict[str, str]:
    with RULES_CSV.open("r", encoding="utf-8-sig", newline="") as file:
        return {row["rule"]: row["value"] for row in csv.DictReader(file)}


def read_allocations() -> list[dict[str, str]]:
    with ALLOCATION_CSV.open("r", encoding="utf-8-sig", newline="") as file:
        return list(csv.DictReader(file))


def yen(value: int) -> str:
    return f"{value:,}円"


def manen(value: int) -> str:
    return f"{value / 10000:.1f}万円"


def pct(value: float) -> str:
    return f"{value:.1f}%"


def parse_percent(text: str) -> float:
    return float(str(text).replace("%", "").replace("以上", "").strip())


def calc_target_yen(total_capital: int, weight_pct_text: str) -> int:
    return round(total_capital * float(weight_pct_text) / 100)


def build_html() -> str:
    rules = read_rules()
    allocations = read_allocations()

    total_capital = int(rules["total_capital_yen"])
    first_buy = sum(int(row["all_pass_allocation_yen"]) for row in allocations)
    yellow_buy = sum(int(row["attention_allocation_yen"]) for row in allocations)
    reserve_floor = round(total_capital * parse_percent(rules["reserve_pct"]) / 100)

    attack_extra_total = round(total_capital * parse_percent(rules["bull_attack_extra_pct"]) / 100)
    attack_second_total = round(total_capital * parse_percent(rules["bull_attack_second_pct"]) / 100)
    attack_cash_floor = round(total_capital * parse_percent(rules["bull_attack_cash_floor_pct"]) / 100)
    attack_extra_each = round(attack_extra_total / len(ATTACK_TICKERS))

    base_end = 2_660_000
    base_profit = base_end - total_capital
    base_return = base_profit / total_capital * 100

    attack_end = 2_712_000
    attack_profit = attack_end - total_capital
    attack_return = attack_profit / total_capital * 100

    target_rows = []
    for row in allocations:
        target_yen = calc_target_yen(total_capital, row["target_weight_pct"])
        green_yen = int(row["all_pass_allocation_yen"])
        yellow_yen = int(row["attention_allocation_yen"])
        attack_extra = attack_extra_each if row["ticker"] in ATTACK_TICKERS else 0
        attack_first = green_yen + attack_extra
        target_rows.append(
            {
                "ticker": row["ticker"].replace(".T", ""),
                "name": row["name"],
                "role": row["role"],
                "target_yen": target_yen,
                "green_yen": green_yen,
                "yellow_yen": yellow_yen,
                "attack_extra": attack_extra,
                "attack_first": attack_first,
            }
        )

    attack_table = "".join(
        f"""
        <tr>
          <td>{item["ticker"]}</td>
          <td>{item["name"]}</td>
          <td>{item["role"]}</td>
          <td>{manen(item["green_yen"])}</td>
          <td>{manen(item["attack_extra"])}</td>
          <td>{manen(item["attack_first"])}</td>
        </tr>
        """
        for item in target_rows
    )

    attack_conditions = [
        ("金利", "FOMC後の米10年金利上昇が +10bp以内", "金利急騰で高PER株が崩れる局面を避ける"),
        ("不安指数", "VIXが 18以下", "市場が落ち着いている時だけ攻める"),
        ("米ハイテク", "NASDAQとSOXの5営業日騰落率が両方プラス", "半導体・AIの追い風を確認する"),
        ("日本株", "日経平均とTOPIX代替ETFがイベント前水準以上", "日本側でも地合い悪化が起きていない"),
        ("候補10社", "10社のうち6社以上がTOPIX代替ETFに対して5営業日で優位", "個別株側の相対強さを確認する"),
    ]

    attack_condition_cards = "".join(
        f"""
        <div class="card">
          <div class="card-title">{name}</div>
          <p><strong>{rule}</strong></p>
          <p class="small">{reason}</p>
        </div>
        """
        for name, rule, reason in attack_conditions
    )

    scenario_rows = [
        {
            "date": "6/19",
            "event": "初回買付",
            "condition": "日銀・FOMC・指数反応が緑",
            "action": f"まず {manen(first_buy)} を入れる",
            "stock": 840000,
            "cash": 1560000,
            "total": 2400000,
            "memo": "ここまでは通常運転と同じ。",
        },
        {
            "date": "6/26",
            "event": "景気良好の攻めモード判定",
            "condition": "上の5条件をすべて通過",
            "action": f"攻め枠 {manen(attack_extra_total)} を追加",
            "stock": 1080000,
            "cash": 1320000,
            "total": 2430000,
            "memo": "半導体・AIインフラ・電線へ上乗せ。",
        },
        {
            "date": "8/20",
            "event": "1Q決算後の第2回",
            "condition": "10社平均がTOPIX代替ETFより +1%以上優位",
            "action": f"さらに {manen(attack_second_total)} を追加",
            "stock": 1560000,
            "cash": 840000,
            "total": 2520000,
            "memo": "攻めモード継続時だけ増やす。",
        },
        {
            "date": "10月",
            "event": "上がりすぎ銘柄の調整",
            "condition": "攻め枠銘柄が +25%超、かつ指数優位が続く",
            "action": "その銘柄だけ4分の1を利確候補",
            "stock": 1690000,
            "cash": 870000,
            "total": 2560000,
            "memo": "全部は売らず、勝ち筋を残す。",
        },
        {
            "date": "12月",
            "event": "攻めモード解除の確認",
            "condition": "SOX/NASDAQが5営業日で-5%以下、またはVIXが20超",
            "action": "攻め枠だけ半分に縮小候補",
            "stock": 1620000,
            "cash": 930000,
            "total": 2550000,
            "memo": "地合いが崩れたら元の守り比率へ戻す。",
        },
        {
            "date": "翌6月",
            "event": "1年終了時点",
            "condition": "攻めモードが大崩れせず継続した例",
            "action": "最終の見かけ上の評価額",
            "stock": 1872000,
            "cash": 840000,
            "total": 2712000,
            "memo": f"攻めモードでは {pct(attack_return)} を狙う設計。",
        },
    ]

    scenario_table = "".join(
        f"""
        <tr>
          <td>{row["date"]}</td>
          <td>{row["event"]}</td>
          <td>{row["condition"]}</td>
          <td>{row["action"]}</td>
          <td>{manen(int(row["stock"]))}</td>
          <td>{manen(int(row["cash"]))}</td>
          <td>{manen(int(row["total"]))}</td>
          <td>{row["memo"]}</td>
        </tr>
        """
        for row in scenario_rows
    )

    return f"""<!doctype html>
<html lang="ja">
<head>
  <meta charset="utf-8">
  <title>1年間のお金の動き シミュレーション</title>
  <style>
    @page {{
      size: A4 landscape;
      margin: 10mm;
    }}
    * {{
      box-sizing: border-box;
    }}
    body {{
      margin: 0;
      font-family: "Yu Gothic", "Meiryo", sans-serif;
      color: #102033;
      background: #ffffff;
      font-size: 18px;
      line-height: 1.6;
    }}
    .page {{
      page-break-after: always;
      min-height: 186mm;
      padding: 2mm 3mm 0;
    }}
    .page:last-child {{
      page-break-after: auto;
    }}
    h1 {{
      margin: 0 0 10px;
      font-size: 32px;
      color: #143f75;
      line-height: 1.3;
    }}
    h2 {{
      margin: 0 0 10px;
      font-size: 24px;
      color: #143f75;
      border-left: 10px solid #1e71cf;
      padding-left: 12px;
    }}
    p, li {{
      margin: 0 0 8px;
      font-size: 20px;
    }}
    .hero {{
      border: 4px solid #b8d7ff;
      border-radius: 24px;
      background: linear-gradient(135deg, #eef6ff 0%, #dcecff 100%);
      padding: 18px 22px;
      margin-bottom: 14px;
    }}
    .note {{
      border: 3px solid #efc63d;
      background: #fff6cc;
      border-radius: 18px;
      padding: 14px 16px;
      font-size: 23px;
      font-weight: 700;
      margin-bottom: 14px;
    }}
    .big {{
      font-size: 46px;
      font-weight: 800;
      color: #0d4e95;
      line-height: 1.2;
      margin: 6px 0;
    }}
    .grid-2 {{
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 14px;
      margin-top: 12px;
    }}
    .grid-3 {{
      display: grid;
      grid-template-columns: repeat(3, 1fr);
      gap: 14px;
      margin-top: 12px;
    }}
    .grid-5 {{
      display: grid;
      grid-template-columns: repeat(5, 1fr);
      gap: 12px;
      margin-top: 12px;
    }}
    .card {{
      border: 3px solid #d8e7fb;
      border-radius: 20px;
      background: #f8fbff;
      padding: 16px;
      page-break-inside: avoid;
    }}
    .card-title {{
      font-size: 21px;
      font-weight: 800;
      color: #174f8e;
      margin-bottom: 8px;
    }}
    .rule-box {{
      border-radius: 20px;
      padding: 16px;
      color: #fff;
      min-height: 182px;
    }}
    .green {{ background: #1f7e56; }}
    .yellow {{ background: #c97b00; }}
    .red {{ background: #a63f3f; }}
    .blue {{ background: #1559ad; }}
    .rule-box .label {{
      font-size: 19px;
      font-weight: 800;
      opacity: 0.95;
    }}
    .rule-box .value {{
      font-size: 40px;
      font-weight: 800;
      line-height: 1.2;
      margin: 10px 0 6px;
    }}
    table {{
      width: 100%;
      border-collapse: collapse;
      table-layout: fixed;
      margin-top: 10px;
    }}
    th, td {{
      border: 2px solid #d8e7fb;
      padding: 10px 10px;
      vertical-align: top;
      font-size: 16px;
      word-break: break-word;
    }}
    th {{
      background: #eaf4ff;
      color: #143f75;
      font-weight: 800;
    }}
    .small {{
      font-size: 17px;
      color: #49627c;
    }}
    .result {{
      border: 4px solid #94d0a6;
      border-radius: 22px;
      background: #eff9f1;
      padding: 16px 18px;
      margin-top: 14px;
    }}
    .result-grid {{
      display: grid;
      grid-template-columns: repeat(3, 1fr);
      gap: 12px;
      margin-top: 12px;
    }}
    .result-card {{
      border: 2px solid #cde5d4;
      border-radius: 18px;
      background: #ffffff;
      text-align: center;
      padding: 14px;
    }}
    .result-card .mini {{
      font-size: 16px;
      color: #4a6651;
      font-weight: 700;
    }}
    .result-card .num {{
      font-size: 34px;
      font-weight: 800;
      color: #14603a;
      line-height: 1.25;
      margin-top: 6px;
    }}
    .footer-note {{
      font-size: 16px;
      color: #5b6f85;
      margin-top: 8px;
    }}
  </style>
</head>
<body>
  <section class="page">
    <div class="note">この版では、通常運転の 10.8% だけでなく、景気が良い時だけ発動する「攻めモード」を追加しました。</div>
    <div class="hero">
      <h1>1年間のお金の動き<br>景気が良い時は攻める版</h1>
      <p>元手は <strong>{manen(total_capital)}</strong>。ただ持つだけではなく、<strong>景気が良い時だけ個別株を増やす</strong> ルールを入れています。</p>
      <div class="big">通常 10.8% → 攻めモード 13.0%前後を狙う</div>
      <p>通常運転の例は <strong>{manen(total_capital)} → {manen(base_end)}</strong>。攻めモードの例は <strong>{manen(total_capital)} → {manen(attack_end)}</strong> です。</p>
    </div>

    <div class="grid-2">
      <div class="card">
        <div class="card-title">通常運転</div>
        <p>まずは <strong>{manen(first_buy)}</strong> で開始し、守りを重視します。</p>
        <p class="big" style="font-size:38px;">+ {manen(base_profit)} / {pct(base_return)}</p>
      </div>
      <div class="card">
        <div class="card-title">攻めモード</div>
        <p>景気が良い時だけ、追加で <strong>{manen(attack_extra_total)}</strong> を攻め枠へ入れます。</p>
        <p class="big" style="font-size:38px;">+ {manen(attack_profit)} / {pct(attack_return)}</p>
      </div>
    </div>

    <div class="grid-2">
      <div class="card">
        <div class="card-title">今回使う10社</div>
        <p>8053 住友商事 / 8316 三井住友FG / 6501 日立製作所 / 6503 三菱電機 / 6857 アドバンテスト</p>
        <p>8035 東京エレクトロン / 7011 三菱重工業 / 6762 TDK / 6146 ディスコ / 5803 フジクラ</p>
      </div>
      <div class="card">
        <div class="card-title">攻め枠にする5社</div>
        <p>6857 アドバンテスト / 8035 東京エレクトロン / 6762 TDK / 6146 ディスコ / 5803 フジクラ</p>
        <p class="small">景気が良い時に伸びやすい、半導体・AIインフラ・電線系を攻め枠とします。</p>
      </div>
    </div>
  </section>

  <section class="page">
    <h2>景気が良い時だけ攻める 5つの条件</h2>
    <div class="grid-5">
      {attack_condition_cards}
    </div>
    <div class="note" style="margin-top:14px;">5つの条件が <strong>全部そろった時だけ</strong> 攻めモードに入ります。1つでも外れたら、通常運転のままです。</div>

    <div class="grid-2">
      <div class="card">
        <div class="card-title">攻める時にやること</div>
        <ul>
          <li>初回買付のあと、さらに <strong>{manen(attack_extra_total)}</strong> を追加する</li>
          <li>追加先は攻め枠5社にしぼる</li>
          <li>8月の第2回も、最大 <strong>{manen(attack_second_total)}</strong> まで広げる</li>
          <li>現金は最低でも <strong>{manen(attack_cash_floor)}</strong> は残す</li>
        </ul>
      </div>
      <div class="card">
        <div class="card-title">攻めモードをやめる条件</div>
        <ul>
          <li>SOXかNASDAQが 5営業日で <strong>-5%</strong> 以下</li>
          <li>VIXが <strong>20超</strong></li>
          <li>10社のうちTOPIX代替ETFに勝つ銘柄が <strong>5社未満</strong></li>
          <li>個別の悪材料で <strong>-10%</strong> に到達</li>
        </ul>
      </div>
    </div>
  </section>

  <section class="page">
    <h2>10社への入れ方</h2>
    <p>下の表は、通常運転の初回金額と、攻めモードで追加する金額です。</p>
    <table>
      <thead>
        <tr>
          <th style="width:8%;">コード</th>
          <th style="width:16%;">銘柄</th>
          <th style="width:16%;">役割</th>
          <th style="width:14%;">通常の初回</th>
          <th style="width:14%;">攻め追加</th>
          <th style="width:16%;">攻め時の初回合計</th>
        </tr>
      </thead>
      <tbody>
        {attack_table}
      </tbody>
    </table>
    <p class="footer-note">攻め追加は、攻め枠5社だけに各 <strong>{manen(attack_extra_each)}</strong> を上乗せします。中心候補3社は土台として維持し、攻める時だけ高感応度の5社を増やします。</p>

    <h2 style="margin-top:20px;">売買ルール</h2>
    <div class="grid-3">
      <div class="rule-box green">
        <div class="label">通常の緑</div>
        <div class="value">{manen(first_buy)}</div>
        <div class="sub">6月イベント通過後の通常スタート金額です。</div>
      </div>
      <div class="rule-box blue">
        <div class="label">景気が良い時の攻め追加</div>
        <div class="value">{manen(attack_extra_total)}</div>
        <div class="sub">5条件を全部通った時だけ、攻め枠5社へ追加します。</div>
      </div>
      <div class="rule-box red">
        <div class="label">赤の時</div>
        <div class="value">0円</div>
        <div class="sub">買いません。本人確認未了、NISA区分不明でも同じです。</div>
      </div>
    </div>

    <div class="grid-2">
      <div class="card">
        <div class="card-title">守りの共通ルール</div>
        <ul>
          <li><strong>-5%</strong> で追加買い停止</li>
          <li><strong>-10%</strong> かつ悪材料ありで半分に縮小候補</li>
          <li>ストップ安や急落日は、その日に買い増ししない</li>
          <li>3か月で指数に 1%以上負けたら追加停止</li>
        </ul>
      </div>
      <div class="card">
        <div class="card-title">攻め枠だけの上値ルール</div>
        <ul>
          <li>通常は <strong>+20%</strong> で一部利確候補</li>
          <li>攻めモード中の5社は、まず <strong>+25%</strong> まで引っ張る</li>
          <li>ただし VIX悪化、SOX/NASDAQ失速なら先に戻す</li>
          <li>利益を残しつつ、過熱で全部降りない設計</li>
        </ul>
      </div>
    </div>
  </section>

  <section class="page">
    <h2>1年間のお金の動き 攻めモードの例</h2>
    <table>
      <thead>
        <tr>
          <th style="width:7%;">時点</th>
          <th style="width:15%;">できごと</th>
          <th style="width:19%;">その時の条件</th>
          <th style="width:15%;">やること</th>
          <th style="width:9%;">株</th>
          <th style="width:9%;">現金</th>
          <th style="width:9%;">合計</th>
          <th style="width:17%;">ひとこと</th>
        </tr>
      </thead>
      <tbody>
        {scenario_table}
      </tbody>
    </table>

    <div class="result">
      <div class="card-title">この設計の見え方</div>
      <div class="result-grid">
        <div class="result-card">
          <div class="mini">通常運転</div>
          <div class="num">{manen(base_end)}<br>{pct(base_return)}</div>
        </div>
        <div class="result-card">
          <div class="mini">攻めモード</div>
          <div class="num">{manen(attack_end)}<br>{pct(attack_return)}</div>
        </div>
        <div class="result-card">
          <div class="mini">差</div>
          <div class="num">{manen(attack_end - base_end)}<br>+{pct(attack_return - base_return)}</div>
        </div>
      </div>
    </div>

    <p class="footer-note">この版の考え方は、「いつでも強気」ではなく、「景気が良いと数字で確認できた時だけ、攻め枠5社を増やして 13%前後を狙う」です。</p>
  </section>
</body>
</html>
"""


def write_html(html: str) -> None:
    HTML_OUT.write_text(html, encoding="utf-8")


def build_pdf() -> None:
    command = [
        str(EDGE_PATH),
        "--headless",
        f"--print-to-pdf={PDF_OUT}",
        str(HTML_OUT),
    ]
    subprocess.run(command, check=True)


def render_previews() -> None:
    pdf = pdfium.PdfDocument(str(PDF_OUT))
    for old in ROOT.glob(f"{PREVIEW_PREFIX.name}*.png"):
        old.unlink()
    for index in range(len(pdf)):
        page = pdf[index]
        bitmap = page.render(scale=2.0)
        image = bitmap.to_pil()
        image.save(ROOT / f"{PREVIEW_PREFIX.name}{index + 1}.png")


def main() -> None:
    html = build_html()
    write_html(html)
    build_pdf()
    render_previews()
    print(HTML_OUT)
    print(PDF_OUT)


if __name__ == "__main__":
    main()
