import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const generatedAt = new Intl.DateTimeFormat("ja-JP", {
  timeZone: "Asia/Tokyo",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
}).format(new Date());

function read(file) {
  return fs.readFileSync(path.join(root, file), "utf8");
}

function write(file, text) {
  fs.writeFileSync(path.join(root, file), text, "utf8");
}

function parseCsv(text) {
  if (text.charCodeAt(0) === 0xfeff) text = text.slice(1);
  const rows = [];
  let row = [];
  let cell = "";
  let quoted = false;
  for (let i = 0; i < text.length; i += 1) {
    const c = text[i];
    const n = text[i + 1];
    if (quoted) {
      if (c === '"' && n === '"') {
        cell += '"';
        i += 1;
      } else if (c === '"') quoted = false;
      else cell += c;
    } else if (c === '"') quoted = true;
    else if (c === ",") {
      row.push(cell);
      cell = "";
    } else if (c === "\n") {
      row.push(cell.replace(/\r$/, ""));
      rows.push(row);
      row = [];
      cell = "";
    } else cell += c;
  }
  if (cell.length || row.length) {
    row.push(cell.replace(/\r$/, ""));
    rows.push(row);
  }
  const header = rows.shift() ?? [];
  return rows
    .filter((r) => r.some((v) => String(v).trim() !== ""))
    .map((r) => Object.fromEntries(header.map((h, i) => [h, r[i] ?? ""])));
}

function csvEscape(value) {
  const s = value == null ? "" : String(value);
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

function toCsv(rows) {
  const header = Object.keys(rows[0] ?? {});
  return `${header.join(",")}\n${rows.map((r) => header.map((h) => csvEscape(r[h])).join(",")).join("\n")}\n`;
}

function num(value) {
  const s = String(value ?? "").replace(/,/g, "").replace(/%/g, "").replace(/倍/g, "").trim();
  if (!s || s === "なし" || s === "未採点") return null;
  const m = s.match(/-?\d+(?:\.\d+)?/);
  if (!m) return null;
  const n = Number(m[0]);
  return Number.isFinite(n) ? n : null;
}

function mapByTicker(rows) {
  return new Map(rows.map((r) => [r.ticker, r]));
}

const selection = parseCsv(read("659_focus10_core_watch_selection.csv"));
const fundamentals = mapByTicker(parseCsv(read("655_focus10_live_fundamental_metrics.csv")));
const prices = mapByTicker(parseCsv(read("654_focus10_live_price_metrics.csv")));
const reactions = mapByTicker(parseCsv(read("656_focus10_reaction_metrics.csv")));

function sectorRole(ticker) {
  const roles = {
    "2802.T": "食品・生活防衛 / ABF・ヘルスケア確認",
    "8316.T": "銀行・金利上昇テーマ",
    "6762.T": "電子部品・AI/半導体周辺",
    "8053.T": "商社・資源/株主還元/バフェット関連",
    "8306.T": "銀行・金利上昇テーマの補欠",
    "7173.T": "地銀・金利上昇テーマの高反応確認",
    "9984.T": "AI投資・大型成長株の監視",
    "7735.T": "半導体製造装置の監視",
    "6146.T": "半導体製造装置の高収益監視",
    "7011.T": "防衛・重工テーマの監視",
  };
  return roles[ticker] ?? "個別確認";
}

function valuationCaution(f) {
  const out = [];
  const per = num(f.per);
  const pbr = num(f.pbr);
  if (per !== null && per >= 40) out.push(`PER${per}倍で割高確認`);
  else if (per !== null && per >= 30) out.push(`PER${per}倍でやや高め`);
  if (pbr !== null && pbr >= 6) out.push(`PBR${pbr}倍で割高確認`);
  return out;
}

function businessCaution(f) {
  const out = [];
  const sales = num(f.sales_yoy_pct);
  const profit = num(f.profit_yoy_pct);
  if (sales !== null && profit !== null && sales < 2 && profit < 5) {
    out.push(`成長確認: 売上${sales}% / 利益${profit}%`);
  }
  return out;
}

function cautionItems(row, f) {
  const base = row.warning_items && row.warning_items !== "なし" ? row.warning_items.split(" / ") : [];
  const has = (pattern) => base.some((item) => item.includes(pattern));
  const valuation = valuationCaution(f).filter((item) => {
    if (item.includes("PER") && has("PER")) return false;
    if (item.includes("PBR") && has("PBR")) return false;
    return true;
  });
  return [...base, ...valuation, ...businessCaution(f)];
}

function priority(row, f) {
  const cautions = cautionItems(row, f);
  const severe = cautions.some((c) => /1年上昇|決算後反応|60日最大下落|PBR12|利益成長マイナス/.test(c));
  if (row.final_group === "中心候補" && !severe) return cautions.length ? "A- 追加確認付き中心候補" : "A 中心候補";
  if (row.final_group === "条件付き中心候補") return "B 条件付き候補";
  return "C 監視候補";
}

function testRole(row, pr) {
  if (pr.startsWith("A")) return "6月再判定で優先確認する候補";
  if (pr.startsWith("B")) return "不足項目を補完してから中心候補へ戻す候補";
  return "条件改善まで購入候補にしない監視候補";
}

function basis(row, f, p) {
  const parts = [
    `最終補正${row.final_selection_score}点`,
    `データ${row.data_completion}`,
    f.per ? `PER${f.per}倍` : "PER未取得",
    f.pbr ? `PBR${f.pbr}倍` : "PBR未取得",
    f.roe_pct ? `ROE${f.roe_pct}%` : "ROE未取得",
    f.profit_yoy_pct ? `利益${f.profit_yoy_pct}%` : "",
    p.return_1y_pct ? `1年${p.return_1y_pct}%` : "",
    row.reaction_score ? `決算後反応${row.reaction_score}点` : "",
  ].filter(Boolean);
  return parts.join(" / ");
}

function passCondition(row, f, p) {
  const ticker = row.ticker;
  if (ticker === "2802.T") return "高PERを利益成長と決算後反応で説明でき、6月イベント後に大きく指数劣後しない。";
  if (ticker === "8316.T") return "日銀後に銀行株全体が崩れず、金利上昇メリットと信用コスト悪化が同時に出ない。";
  if (ticker === "6762.T") return "AI/電子部品テーマがSOXや半導体指数に連動しつつ、過熱下落が限定的。";
  if (ticker === "8053.T") return "商社・資源・還元テーマが維持され、決算後反応と株価維持が続く。";
  if (ticker === "8306.T") return "PER相当の確認または代替指標で割高感を説明し、銀行枠の重複を整理できる。";
  if (ticker === "9984.T") return "1年上昇の過熱が落ち着き、決算後20営業日反応と6月イベント後の価格維持を確認できる。";
  if (ticker === "7173.T") return "決算後反応の弱さが一時的と確認でき、出来高・銀行株指数・再反応が改善する。";
  if (ticker === "7735.T") return "利益成長マイナスを次期見通しや受注で補える。SOX下落時の耐性も確認する。";
  if (ticker === "6146.T") return "PERを補完し、PBR高を利益成長・受注・決算後反応で説明できる。";
  if (ticker === "7011.T") return "60日最大下落が改善し、200日線・出来高・防衛/重工テーマの再評価が確認できる。";
  return "6月イベント後に指数劣後せず、未取得項目が増えない。";
}

function stopCondition(row) {
  const ticker = row.ticker;
  if (ticker === "2802.T") return "高PERのまま利益成長鈍化、または決算後反応が日経平均比で悪化。";
  if (ticker === "8316.T" || ticker === "8306.T" || ticker === "7173.T") return "日銀後の銀行株下落、信用コスト悪化、金利上昇メリットの後退。";
  if (ticker === "6762.T" || ticker === "7735.T" || ticker === "6146.T") return "SOX下落、AI/半導体テーマの失速、決算後反応の指数劣後。";
  if (ticker === "8053.T") return "資源価格・為替・還元姿勢が悪化し、商社株全体が指数劣後。";
  if (ticker === "9984.T") return "過熱の反動、米金利上昇、AI関連株下落で大きく指数劣後。";
  if (ticker === "7011.T") return "直近下落が続き、200日線を明確に下回る。";
  return "6月イベント後に日経平均/TOPIXへ大きく劣後。";
}

const rows = selection.map((row) => {
  const f = fundamentals.get(row.ticker) ?? {};
  const p = prices.get(row.ticker) ?? {};
  const r = reactions.get(row.ticker) ?? {};
  const pr = priority(row, f);
  const cautions = cautionItems(row, f).join(" / ") || "大きな警戒なし";
  return {
    generated_at: generatedAt,
    ticker: row.ticker,
    company: row.company,
    june_test_priority: pr,
    test_role: testRole(row, pr),
    sector_role: sectorRole(row.ticker),
    final_selection_score: row.final_selection_score,
    data_completion: row.data_completion,
    key_numbers: basis(row, f, p),
    caution_items: cautions,
    pass_condition: passCondition(row, f, p),
    stop_condition: stopCondition(row),
    current_handling: pr.startsWith("C") ? "監視継続" : "6月再判定で優先確認",
  };
});

const order = { "A 中心候補": 0, "A- 追加確認付き中心候補": 1, "B 条件付き候補": 2, "C 監視候補": 3 };
const sorted = rows
  .sort((a, b) => (order[a.june_test_priority] ?? 9) - (order[b.june_test_priority] ?? 9)
    || (num(b.final_selection_score) ?? 0) - (num(a.final_selection_score) ?? 0))
  .map((row, index) => ({ plan_rank: index + 1, ...row }));

const summaryRows = [
  {
    generated_at: generatedAt,
    item: "候補抽出の状態",
    result: "解決済み",
    detail: "10社すべてに株価・出来高・業績・決算後反応が入り、中心候補/条件付き/監視に分けられる状態。",
  },
  {
    generated_at: generatedAt,
    item: "購入判断の状態",
    result: "未確定",
    detail: "6月CPI、日銀、FOMC、日経平均75日線、米金利、為替を通して再判定する。",
  },
  {
    generated_at: generatedAt,
    item: "目標との接続",
    result: "+1%超過を検証",
    detail: "S&P500投信・日経平均/TOPIXをただ持つ場合より、1年で+1%上回る根拠が説明できるか確認する。",
  },
];

const allocationRows = [
  {
    generated_at: generatedAt,
    bucket: "A中心候補",
    role: "6月再判定の主比較対象",
    candidate_count: sorted.filter((r) => r.june_test_priority.startsWith("A")).length,
    handling: "市場イベント後に条件を満たした銘柄だけ、テスト対象候補として残す。",
  },
  {
    generated_at: generatedAt,
    bucket: "B条件付き候補",
    role: "不足項目補完後の補欠",
    candidate_count: sorted.filter((r) => r.june_test_priority.startsWith("B")).length,
    handling: "PERまたは代替指標を補完し、同業比較が通れば中心候補へ戻す。",
  },
  {
    generated_at: generatedAt,
    bucket: "C監視候補",
    role: "条件改善待ち",
    candidate_count: sorted.filter((r) => r.june_test_priority.startsWith("C")).length,
    handling: "過熱、反応弱さ、下落率などの警戒が改善するまで購入候補にしない。",
  },
];

const timelineRows = [
  {
    generated_at: generatedAt,
    date_window: "5月末",
    action: "10社候補案を固定し、A/B/Cの扱いと警戒条件を記録する。",
    output: "本ページ、候補CSV、説明カード",
  },
  {
    generated_at: generatedAt,
    date_window: "6月上旬",
    action: "CPI前に価格・出来高・日経平均比を更新する。",
    output: "中心候補の維持確認",
  },
  {
    generated_at: generatedAt,
    date_window: "6月10日以降",
    action: "米CPI結果と米金利を確認し、高PER・AI関連の扱いを再判定する。",
    output: "市場ゲート判定",
  },
  {
    generated_at: generatedAt,
    date_window: "6月18日以降",
    action: "日銀・FOMC後に、A候補を中心にテスト対象へ残すか再判定する。",
    output: "6月テスト対象の最終候補表",
  },
];

write("662_june_test_candidate_plan_summary.csv", toCsv(summaryRows));
write("663_june_test_candidate_plan_detail.csv", toCsv(sorted));
write("664_june_test_candidate_bucket_rules.csv", toCsv(allocationRows));
write("665_june_test_candidate_timeline.csv", toCsv(timelineRows));

const esc = (v) => String(v ?? "").replace(/[&<>"']/g, (m) => ({
  "&": "&amp;",
  "<": "&lt;",
  ">": "&gt;",
  '"': "&quot;",
  "'": "&#39;",
}[m]));

function table(rowsForTable) {
  const header = Object.keys(rowsForTable[0] ?? {});
  return `<table><thead><tr>${header.map((h) => `<th>${esc(h)}</th>`).join("")}</tr></thead><tbody>${rowsForTable
    .map((r) => `<tr>${header.map((h) => `<td>${esc(r[h])}</td>`).join("")}</tr>`)
    .join("")}</tbody></table>`;
}

const counts = sorted.reduce((acc, row) => {
  const key = row.june_test_priority.split(" ")[0];
  acc[key] = (acc[key] ?? 0) + 1;
  return acc;
}, {});

const html = `<!doctype html>
<html lang="ja">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>6月テスト候補案 2026年5月27日</title>
  <style>
    :root { --ink:#071f36; --blue:#0b6fa4; --line:#c9daea; --bg:#f7fafc; }
    * { box-sizing:border-box; }
    body { margin:0; font-family:"Yu Gothic","Meiryo",Arial,sans-serif; color:var(--ink); background:var(--bg); line-height:1.7; }
    header { background:#123f63; color:#fff; padding:28px 32px; }
    h1 { margin:0 0 8px; font-size:28px; }
    main { max-width:1220px; margin:0 auto; padding:24px; }
    section { background:#fff; border:1px solid var(--line); border-radius:10px; padding:22px; margin:0 0 18px; page-break-inside:avoid; }
    h2 { margin:0 0 12px; font-size:22px; border-left:8px solid var(--blue); padding-left:12px; }
    .grid { display:grid; grid-template-columns:repeat(4,minmax(0,1fr)); gap:12px; }
    .card { border:1px solid var(--line); border-radius:8px; padding:14px; background:#f9fcff; }
    .num { font-size:28px; font-weight:800; color:#064f79; }
    table { width:100%; border-collapse:collapse; table-layout:fixed; font-size:12.5px; }
    th, td { border:1px solid var(--line); padding:7px; vertical-align:top; word-break:break-word; overflow-wrap:anywhere; }
    th { background:#e7f1fa; text-align:left; color:#06395b; }
    .note { border-left:6px solid #d88b1f; background:#fff9ef; padding:12px 14px; margin-top:10px; color:#111; }
    .links a { display:inline-block; margin:4px 8px 4px 0; padding:8px 12px; border:1px solid #8bb9d6; border-radius:8px; color:#064f79; text-decoration:none; background:#fff; font-weight:700; }
    @media (max-width:760px){ .grid{grid-template-columns:1fr;} main{padding:14px;} table{font-size:12px;} }
  </style>
</head>
<body>
  <header>
    <h1>6月テスト候補案</h1>
    <div>作成: ${esc(generatedAt)} / 目的: 根拠付きで6月再判定に進める候補と、監視に止める候補を分ける</div>
  </header>
  <main>
    <section>
      <h2>1. 現在の判断</h2>
      <div class="grid">
        <div class="card"><div class="num">${counts.A ?? 0}</div><div><b>A候補</b></div><div>6月再判定で優先確認</div></div>
        <div class="card"><div class="num">${counts["A-"] ?? 0}</div><div><b>A-候補</b></div><div>中心だが追加確認付き</div></div>
        <div class="card"><div class="num">${counts.B ?? 0}</div><div><b>B候補</b></div><div>不足項目補完後に再評価</div></div>
        <div class="card"><div class="num">${counts.C ?? 0}</div><div><b>C候補</b></div><div>条件改善まで監視</div></div>
      </div>
      <div class="note">この資料は6月の再判定に向けた候補案です。購入対象の確定ではありません。S&P500投信・日経平均/TOPIXをただ持つ場合より+1%上回る根拠が説明できるかを、6月イベント後に確認します。</div>
    </section>
    <section>
      <h2>2. 銘柄別候補案</h2>
      ${table(sorted)}
    </section>
    <section>
      <h2>3. 区分ルール</h2>
      ${table(allocationRows)}
    </section>
    <section>
      <h2>4. 6月までの手順</h2>
      ${table(timelineRows)}
      <div class="links">
        <a href="662_june_test_candidate_plan_summary.csv">要約CSV</a>
        <a href="663_june_test_candidate_plan_detail.csv">候補案CSV</a>
        <a href="664_june_test_candidate_bucket_rules.csv">区分ルールCSV</a>
        <a href="665_june_test_candidate_timeline.csv">手順CSV</a>
      </div>
    </section>
  </main>
</body>
</html>`;

write("june_test_candidate_plan_20260527.html", html);

console.log(JSON.stringify({
  generatedAt,
  counts,
  output: "june_test_candidate_plan_20260527.html",
}, null, 2));
