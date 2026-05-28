import fs from 'node:fs';
import path from 'node:path';

const ROOT = process.cwd();
const OUT = path.join(ROOT, 'selection_change_report_20260528.html');

const names = {
  '8316.T': ['三井住友FG', '銀行'],
  '8766.T': ['東京海上HD', '保険'],
  '8058.T': ['三菱商事', '商社'],
  '8306.T': ['三菱UFJ FG', '銀行'],
  '8031.T': ['三井物産', '商社'],
  '8001.T': ['伊藤忠商事', '商社'],
  '6501.T': ['日立製作所', '総合電機・IT'],
  '7011.T': ['三菱重工', '重工・防衛'],
  '5802.T': ['住友電工', '電線・通信'],
  '5801.T': ['古河電工', '電線・通信']
};

function parseCsv(text) {
  if (text.charCodeAt(0) === 0xfeff) text = text.slice(1);
  const rows = [];
  let row = [];
  let cell = '';
  let quoted = false;
  for (let i = 0; i < text.length; i += 1) {
    const ch = text[i];
    const next = text[i + 1];
    if (quoted) {
      if (ch === '"' && next === '"') {
        cell += '"';
        i += 1;
      } else if (ch === '"') quoted = false;
      else cell += ch;
    } else if (ch === '"') quoted = true;
    else if (ch === ',') {
      row.push(cell);
      cell = '';
    } else if (ch === '\n') {
      row.push(cell.replace(/\r$/, ''));
      rows.push(row);
      row = [];
      cell = '';
    } else cell += ch;
  }
  if (cell.length || row.length) row.push(cell.replace(/\r$/, ''));
  return rows.filter((items) => items.some((item) => String(item).trim() !== ''));
}

function readRows(name) {
  return parseCsv(fs.readFileSync(path.join(ROOT, name), 'utf8')).slice(1);
}

function num(value) {
  const parsed = Number(String(value ?? '').replaceAll(',', '').replace('%', '').trim());
  return Number.isFinite(parsed) ? parsed : null;
}

function pct(value, digits = 1) {
  if (value === null || value === undefined || Number.isNaN(value)) return '未取得';
  return `${Number(value).toFixed(digits).replace(/\.0$/, '')}%`;
}

function yen(value) {
  return `${Math.round(value).toLocaleString('ja-JP')}円`;
}

function esc(value) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;');
}

function table(headers, rows) {
  return `<div class="table-wrap"><table><thead><tr>${headers.map((h) => `<th>${esc(h)}</th>`).join('')}</tr></thead><tbody>${rows.map((row) => `<tr>${headers.map((h) => `<td>${esc(row[h])}</td>`).join('')}</tr>`).join('')}</tbody></table></div>`;
}

const longRows = readRows('728_universe100_long_term_stability_score.csv');
const weightRows = readRows('771_provisional_target_weights.csv');
const currentRows = readRows('764_morning_recalc_top10.csv');

const longByTicker = new Map(longRows.map((row) => [row[1], row]));
const currentByTicker = new Map(currentRows.map((row) => [row[2], row]));

let weightedBase = 0;
let weightedPractical = 0;
let investedWeight = 0;
const detailRows = [];

for (const weightRow of weightRows) {
  const ticker = weightRow[0];
  if (ticker === 'CASH') continue;

  const [company, industry] = names[ticker] || [ticker, ''];
  const long = longByTicker.get(ticker);
  const current = currentByTicker.get(ticker);
  const weight = num(weightRow[3]) ?? 0;
  const cagr5 = num(long?.[6]);
  const cagr10 = num(long?.[7]);
  const spDiff5 = num(long?.[8]);
  const vol5 = num(long?.[10]);
  const maxDrawdown5 = num(long?.[11]);
  const monthlyWin = num(long?.[12]);
  const base = cagr5 !== null && cagr10 !== null ? cagr5 * 0.6 + cagr10 * 0.4 : null;
  const overheat = current && (String(current[12] || '').includes('過') || String(current[12] || '').includes('驕'));

  let multiplier = 0.35;
  const penalties = ['過去実績を65%割引'];
  if (overheat) {
    multiplier *= 0.55;
    penalties.push('過熱補正');
  }
  if (maxDrawdown5 !== null && maxDrawdown5 <= -45) {
    multiplier *= 0.75;
    penalties.push('大幅下落歴補正');
  }
  if (vol5 !== null && vol5 >= 40) {
    multiplier *= 0.8;
    penalties.push('高ボラ補正');
  }
  const practical = base === null ? null : Math.min(base * multiplier, 18);

  if (base !== null) weightedBase += base * weight / 100;
  if (practical !== null) weightedPractical += practical * weight / 100;
  investedWeight += weight;

  detailRows.push({
    銘柄: `${ticker} ${company}`,
    業種: industry,
    比率: `${weight}%`,
    '5年CAGR': pct(cagr5),
    '10年CAGR': pct(cagr10),
    '実績基準年率': pct(base),
    '実用年率試算': pct(practical),
    '5年S&P差': pct(spDiff5),
    '最大下落': pct(maxDrawdown5),
    '月次勝率': pct(monthlyWin),
    補正: penalties.join(' / ')
  });
}

const capital = 2_000_000;
const cashWeight = 100 - investedWeight;
const practicalProfit = capital * weightedPractical / 100;
const benchmarkSp = 10;
const targetPlusOne = benchmarkSp + 1;
const targetProfit = capital * targetPlusOne / 100;
const gapToTarget = practicalProfit - targetProfit;

const summaryRows = [
  {
    項目: '過去実績をそのまま使った年率',
    数値: pct(weightedBase),
    見方: '5年CAGRを60%、10年CAGRを40%で合成。これは楽観的に見えすぎるため、採用値ではなく上限確認として扱う。'
  },
  {
    項目: '実用年率試算',
    数値: pct(weightedPractical),
    見方: '過去実績を65%割引し、過熱・最大下落・ボラティリティで追加補正した現在10社の確かめ算。'
  },
  {
    項目: '200万円の場合の年利益試算',
    数値: yen(practicalProfit),
    見方: '現金10%を残した比率で計算。税金はNISA前提のためここでは控除しない。'
  },
  {
    項目: 'S&P500長期平均10%に+1%を足した目標',
    数値: `${pct(targetPlusOne)} / ${yen(targetProfit)}`,
    見方: gapToTarget >= 0
      ? `現時点の実用試算では目標を${yen(gapToTarget)}上回る。`
      : `現時点の実用試算では目標に${yen(Math.abs(gapToTarget))}不足する。`
  }
];

const scenarioRows = [
  {
    シナリオ: '強め',
    年率: pct(Math.min(weightedBase * 0.6, 20)),
    '200万円の概算': yen(capital * Math.min(weightedBase * 0.6, 20) / 100),
    前提: '過去実績の継続性が比較的残り、6月イベント後も市場が崩れない場合。'
  },
  {
    シナリオ: '標準',
    年率: pct(weightedPractical),
    '200万円の概算': yen(practicalProfit),
    前提: '過去実績を大きく割り引き、過熱銘柄を抑えて見る場合。今回の中心試算。'
  },
  {
    シナリオ: '弱め',
    年率: pct(weightedPractical - 12),
    '200万円の概算': yen(capital * (weightedPractical - 12) / 100),
    前提: 'CPI・金利・日銀・FOMC後に市場が悪化し、個別株比率を下げる必要がある場合。'
  }
];

const formulaRows = [
  {
    項目: '実績基準年率',
    数式: '5年CAGR × 60% + 10年CAGR × 40%',
    目的: '直近5年の勢いを重視しつつ、10年の継続性も入れる。'
  },
  {
    項目: '実用年率試算',
    数式: '実績基準年率 × 35% × 過熱補正 × 下落補正 × ボラ補正',
    目的: '過去の上昇をそのまま未来に置かず、かなり保守的に割り引く。'
  },
  {
    項目: 'ポートフォリオ年率',
    数式: 'Σ（各銘柄の実用年率試算 × 投入比率） + 現金0%',
    目的: '現在の10社を実際の比率で持った場合の全体年率を出す。'
  },
  {
    項目: '+1%目標との比較',
    数式: '実用年率試算 - 11%',
    目的: 'S&P500長期平均10%前後に対して、最低+1%上回る説明が成立するかを見る。'
  }
];

const detailA = detailRows.slice(0, 5);
const detailB = detailRows.slice(5);
const generatedAt = new Intl.DateTimeFormat('ja-JP', {
  timeZone: 'Asia/Tokyo',
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit'
}).format(new Date());

const html = `<!doctype html>
<html lang="ja">
<head>
  <meta charset="utf-8">
  <title>5月28日 作業報告</title>
  <style>
    @page { size: A4 landscape; margin: 10mm; }
    * { box-sizing: border-box; }
    body { margin: 0; font-family: "Noto Sans JP", "Meiryo", "Yu Gothic", Arial, sans-serif; color:#050b14; background:#fff; line-height:1.58; font-size:11px; }
    .page { page-break-after: always; }
    .page:last-child { page-break-after: auto; }
    .page, section, .card, .note, table, thead, tbody, tr, td, th { break-inside: avoid; page-break-inside: avoid; }
    thead { display: table-header-group; }
    h1 { margin:0 0 12px; font-size:30px; letter-spacing:0; }
    h2 { margin:0 0 10px; padding-left:8px; border-left:6px solid #0b5f96; color:#123d63; font-size:18px; }
    .cover { min-height:180mm; padding:20mm; background:#123d63; color:#fff; }
    .cover h2 { color:#fff; border-color:#8fd3ff; }
    .lead { font-size:15px; max-width:920px; }
    .cards { display:grid; grid-template-columns:repeat(4,1fr); gap:8px; margin:14px 0; }
    .card { border:1px solid #cbd8e6; background:#f8fbff; border-radius:8px; padding:10px; }
    .cover .card { background:rgba(255,255,255,.08); border-color:rgba(255,255,255,.3); color:#fff; }
    .value { display:block; font-size:24px; font-weight:900; color:#0b5f96; }
    .cover .value { color:#fff; }
    .note { border-left:6px solid #a85b00; background:#fff8ec; padding:8px; margin:8px 0 12px; }
    .caution { border-left:6px solid #b42318; background:#fff4f2; padding:8px; margin:8px 0 12px; }
    table { width:100%; border-collapse:collapse; table-layout:fixed; margin:6px 0 12px; }
    th,td { border:1px solid #cbd8e6; padding:5px; vertical-align:top; overflow-wrap:break-word; }
    th { background:#e6f1fb; color:#123d63; text-align:left; }
    .narrow th:nth-child(1), .narrow td:nth-child(1) { width:16%; }
    .small { color:#34465b; font-size:10px; }
  </style>
</head>
<body>
  <section class="page cover">
    <h1>5月28日 作業報告</h1>
    <h2>2026年5月28日</h2>
    <p class="lead">現在の候補10社について、過去5年・10年の実績から「この10社なら年利でどの程度になりそうか」を確認するための試算を追加しました。単純な過去実績ではなく、過熱・最大下落・ボラティリティを差し引いた保守的な確かめ算として整理しています。</p>
    <div class="cards">
      <div class="card"><b>候補数</b><span class="value">10社</span><p>現金待機10%を別枠で保持</p></div>
      <div class="card"><b>過去実績基準</b><span class="value">${pct(weightedBase)}</span><p>そのまま採用しない参考値</p></div>
      <div class="card"><b>実用年率試算</b><span class="value">${pct(weightedPractical)}</span><p>今回の中心確認値</p></div>
      <div class="card"><b>200万円概算</b><span class="value">${yen(practicalProfit)}</span><p>標準シナリオの年利益</p></div>
    </div>
    <p class="caution">この試算は購入可否を確定するものではありません。6月のCPI、日銀会合、FOMC後に市場環境を再確認し、個別銘柄の決算・割高感・下落リスクを再判定します。</p>
  </section>

  <section class="page">
    <h2>1. 今回の確かめ算の結論</h2>
    ${table(['項目', '数値', '見方'], summaryRows)}
    <p class="note">結論として、現在10社の実用年率試算は約${pct(weightedPractical)}です。S&P500長期平均を10%前後と置き、最低+1%上回る目標を11%前後とすると、現時点ではほぼ目標近辺です。ただし余裕は大きくないため、6月イベント後に金利・為替・指数の状態が悪ければ、個別株比率を下げる判断が必要です。</p>
    <h2>2. 計算式</h2>
    ${table(['項目', '数式', '目的'], formulaRows)}
  </section>

  <section class="page">
    <h2>3. 銘柄別の年率試算 前半5社</h2>
    ${table(['銘柄', '業種', '比率', '5年CAGR', '10年CAGR', '実績基準年率', '実用年率試算', '5年S&P差', '最大下落', '月次勝率', '補正'], detailA)}
  </section>

  <section class="page">
    <h2>4. 銘柄別の年率試算 後半5社</h2>
    ${table(['銘柄', '業種', '比率', '5年CAGR', '10年CAGR', '実績基準年率', '実用年率試算', '5年S&P差', '最大下落', '月次勝率', '補正'], detailB)}
  </section>

  <section class="page">
    <h2>5. シナリオ別の見方</h2>
    ${table(['シナリオ', '年率', '200万円の概算', '前提'], scenarioRows)}
    <h2>6. 現時点の扱い</h2>
    <div class="card">
      <p>現在の10社は、過去実績だけで自動確定したものではありません。量的データを主軸に、6月イベント後の市場環境、決算後反応、同業比較、割高感を再確認する前提の候補です。</p>
      <p>今回の確かめ算で分かることは、「現時点の候補10社を現在比率で持つなら、保守補正後でも年率約${pct(weightedPractical)}程度を狙う説明は一応成立する」という点です。一方で、目標11%に対する余裕は薄いため、弱い市場環境では個別株比率を下げ、インデックスまたは現金比率を高める運用分岐が必要です。</p>
    </div>
    <p class="small">作成日時: ${esc(generatedAt)}</p>
  </section>
</body>
</html>`;

fs.writeFileSync(OUT, html, 'utf8');
console.log(JSON.stringify({
  output: OUT,
  weightedBase: Number(weightedBase.toFixed(2)),
  weightedPractical: Number(weightedPractical.toFixed(2)),
  practicalProfit: Math.round(practicalProfit)
}, null, 2));
