import fs from 'node:fs';
import path from 'node:path';

const ROOT = process.cwd();
const generatedAt = new Intl.DateTimeFormat('ja-JP', {
  timeZone: 'Asia/Tokyo',
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
}).format(new Date());

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
  if (cell.length || row.length) {
    row.push(cell.replace(/\r$/, ''));
    rows.push(row);
  }
  const headers = rows.shift() || [];
  return rows
    .filter((items) => items.some((item) => String(item).trim() !== ''))
    .map((items) => Object.fromEntries(headers.map((header, index) => [header, items[index] || ''])));
}

function readCsv(name) {
  return parseCsv(fs.readFileSync(path.join(ROOT, name), 'utf8'));
}

function escCsv(value) {
  const text = String(value ?? '');
  if (/[",\n\r]/.test(text)) return `"${text.replaceAll('"', '""')}"`;
  return text;
}

function writeCsv(name, rows, headers) {
  const body = [headers.join(',')]
    .concat(rows.map((row) => headers.map((header) => escCsv(row[header])).join(',')))
    .join('\n');
  fs.writeFileSync(path.join(ROOT, name), `\uFEFF${body}\n`, 'utf8');
}

function esc(value) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;');
}

function cleanLines(text) {
  return text.split('\n').map((line) => line.replace(/[ \t]+$/g, '')).join('\n');
}

function table(headers, rows, className = '') {
  return `
    <div class="table-wrap ${className}">
      <table>
        <thead><tr>${headers.map((header) => `<th>${esc(header.label)}</th>`).join('')}</tr></thead>
        <tbody>${rows.map((row) => `<tr>${headers.map((header) => `<td>${esc(row[header.key])}</td>`).join('')}</tr>`).join('')}</tbody>
      </table>
    </div>`;
}

function factScore(row) {
  if (row.source_type.includes('決算') || row.source_type.includes('会社IR') || row.source_type.includes('日銀') || row.source_type.includes('SEC') || row.source_type.includes('商品市況')) return 85;
  if (row.source_type.includes('業界統計') || row.source_type.includes('CPI')) return 75;
  return 60;
}

function relevanceScore(row) {
  if (row.affected_ticker.includes('TDK') && row.qualitative_theme.includes('HBM')) return 88;
  if (row.affected_ticker.includes('東京海上') && row.qualitative_theme.includes('バフェット')) return 82;
  if (row.affected_ticker.includes('三井住友') && row.qualitative_theme.includes('金利')) return 80;
  if (row.affected_ticker.includes('味の素') && row.qualitative_theme.includes('食品')) return 78;
  if (row.affected_ticker.includes('三菱電機') && row.qualitative_theme.includes('データセンター')) return 72;
  if (row.affected_ticker.includes('ENEOS') && row.qualitative_theme.includes('原油')) return 70;
  return 60;
}

function reactionNeed(row) {
  if (row.alert_level === '通知') return 75;
  if (row.alert_level === '確認待ち') return 60;
  return 45;
}

function refutationRisk(row) {
  let risk = 35;
  if (row.reject_condition.includes('指数劣後')) risk += 15;
  if (row.reject_condition.includes('PER')) risk += 12;
  if (row.reject_condition.includes('全売却') || row.event_id.includes('SELL')) risk += 18;
  if (row.reject_condition.includes('原油急落') || row.reject_condition.includes('在庫評価損')) risk += 14;
  return Math.min(90, risk);
}

function classify(total, risk, row) {
  if (row.event_id.includes('SELL') || risk >= 70) return '通知・警戒';
  if (total >= 78) return '通知・重点確認';
  if (total >= 65) return '確認待ち';
  if (total >= 52) return '保留';
  return '除外候補';
}

function actionFor(classification) {
  if (classification === '通知・警戒') return '新規買い停止。対象銘柄の量的データ、指数反応、関連ニュースを再確認する。';
  if (classification === '通知・重点確認') return '当日中に確認数字を入力し、候補順位と売買ルールへの影響を確認する。';
  if (classification === '確認待ち') return '候補抽出に留め、決算資料または株価反応で確認する。';
  if (classification === '保留') return 'スコアへ混ぜず、週次確認リストに残す。';
  return '銘柄選出には使わない。反証情報として記録する。';
}

const sampleRows = readCsv('618_qual_event_sample_cases.csv');
const scoredRows = sampleRows.map((row) => {
  const fact = factScore(row);
  const relevance = relevanceScore(row);
  const reaction = reactionNeed(row);
  const risk = refutationRisk(row);
  const total = Math.round((fact * 0.3 + relevance * 0.3 + reaction * 0.25 + (100 - risk) * 0.15) * 10) / 10;
  const classification = classify(total, risk, row);
  return {
    generated_at: generatedAt,
    event_id: row.event_id,
    qualitative_theme: row.qualitative_theme,
    affected_ticker: row.affected_ticker,
    expected_direction: row.expected_direction,
    fact_score: fact,
    relevance_score: relevance,
    reaction_check_score: reaction,
    refutation_risk: risk,
    event_total_score: total,
    classification,
    action: actionFor(classification),
    required_numbers: row.required_numbers,
    reject_condition: row.reject_condition,
  };
});

const formulaRows = [
  {
    item: 'イベント総合点',
    formula: '事実スコア30% + 関連性スコア30% + 実績反応確認25% + 反証リスク控除15%',
    meaning: '公式性、銘柄への接続、株価反応、反証リスクを分けて扱う。',
  },
  {
    item: '事実スコア',
    formula: '公式資料・統計・決算・SECを高く、報道のみを中、噂を低く扱う',
    meaning: '出典の強さを先に確認する。',
  },
  {
    item: '関連性スコア',
    formula: '対象銘柄の売上・受注・利益率に直接接続するほど高い',
    meaning: '連想だけのテーマを上げすぎない。',
  },
  {
    item: '実績反応確認',
    formula: '通知対象は当日確認、確認待ちは決算・株価反応待ち',
    meaning: '株価への影響を指数比較で見る。',
  },
  {
    item: '反証リスク',
    formula: '指数劣後、PER過熱、全売却、原油急落などを控除要因にする',
    meaning: '都合のよい材料だけで候補を上げない。',
  },
];

const summaryRows = [
  {
    generated_at: generatedAt,
    item: '目的',
    detail: '質的イベントを、客観的な分類とアクションに変換する。',
  },
  {
    generated_at: generatedAt,
    item: '対象',
    detail: `サンプルイベント${scoredRows.length}件を判定。`,
  },
  {
    generated_at: generatedAt,
    item: '出力',
    detail: '通知・重点確認、通知・警戒、確認待ち、保留、除外候補に分類。',
  },
  {
    generated_at: generatedAt,
    item: '注意',
    detail: 'サンプル判定であり、実際のイベント発生や売買判断を意味しない。',
  },
];

writeCsv('620_qual_event_scoring_engine_summary.csv', summaryRows, ['generated_at', 'item', 'detail']);
writeCsv('621_qual_event_scoring_formula.csv', formulaRows, ['item', 'formula', 'meaning']);
writeCsv('622_qual_event_scored_cases.csv', scoredRows, [
  'generated_at',
  'event_id',
  'qualitative_theme',
  'affected_ticker',
  'expected_direction',
  'fact_score',
  'relevance_score',
  'reaction_check_score',
  'refutation_risk',
  'event_total_score',
  'classification',
  'action',
  'required_numbers',
  'reject_condition',
]);

const html = cleanLines(`<!doctype html>
<html lang="ja">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>質的イベント判定エンジン 2026年5月27日</title>
  <style>
    :root { --ink:#061e38; --line:#cbdff0; --blue:#0b5e94; --bg:#f4f8fb; --orange:#b45309; }
    * { box-sizing:border-box; }
    body { margin:0; background:var(--bg); color:var(--ink); font-family:"Yu Gothic","Meiryo",system-ui,sans-serif; line-height:1.65; }
    main { max-width:1320px; margin:0 auto; padding:24px 18px 48px; }
    header { background:#082f53; color:#fff; border-radius:14px; padding:26px; margin-bottom:16px; }
    h1 { margin:0 0 8px; font-size:clamp(26px,4vw,40px); line-height:1.2; }
    h2 { margin:0 0 10px; font-size:22px; border-left:7px solid var(--blue); padding-left:12px; }
    .lead { margin:0; max-width:1040px; color:#edf7ff; font-weight:700; }
    section { background:#fff; border:1px solid var(--line); border-radius:12px; box-shadow:0 8px 20px rgba(20,60,90,.08); padding:18px; margin-top:14px; }
    .table-wrap { overflow-x:auto; border:1px solid var(--line); border-radius:10px; }
    table { width:100%; border-collapse:collapse; background:#fff; min-width:900px; }
    .wide table { min-width:2050px; }
    th,td { border-bottom:1px solid var(--line); border-right:1px solid var(--line); padding:9px 11px; vertical-align:top; color:#031f3b; }
    th { background:#e7f2fb; text-align:left; white-space:nowrap; }
    tr:last-child td { border-bottom:0; }
    .note { border:1px solid #f5c77a; border-left:8px solid var(--orange); background:#fff8eb; border-radius:10px; padding:12px 14px; font-weight:700; margin-top:12px; }
    .actions { display:flex; flex-wrap:wrap; gap:10px; margin-top:14px; }
    .actions a { display:inline-flex; align-items:center; justify-content:center; min-height:42px; padding:9px 14px; border-radius:8px; background:var(--blue); color:#fff; text-decoration:none; font-weight:700; }
    @media (max-width:900px) { main { padding:12px 10px 36px; } header,section { padding:16px; } }
  </style>
</head>
<body>
  <main>
    <header>
      <h1>質的イベント判定エンジン</h1>
      <p class="lead">ニュース・イベントを、事実性、銘柄関連性、反応確認、反証リスクに分けて点数化し、通知・確認待ち・保留・除外候補へ分類します。</p>
    </header>
    <section>
      <h2>1. 概要</h2>
      ${table([
        { key: 'item', label: '項目' },
        { key: 'detail', label: '内容' },
      ], summaryRows)}
      <div class="note">これは質的イベントを整理する判定表です。実際の売買判断は、6月イベント後の最新決算・株価・証券会社画面で再確認します。</div>
    </section>
    <section>
      <h2>2. 判定式</h2>
      ${table([
        { key: 'item', label: '項目' },
        { key: 'formula', label: '式・ルール' },
        { key: 'meaning', label: '意味' },
      ], formulaRows, 'wide')}
    </section>
    <section>
      <h2>3. サンプルイベント判定結果</h2>
      ${table([
        { key: 'event_id', label: 'ID' },
        { key: 'qualitative_theme', label: '質的テーマ' },
        { key: 'affected_ticker', label: '対象銘柄' },
        { key: 'expected_direction', label: '方向' },
        { key: 'fact_score', label: '事実' },
        { key: 'relevance_score', label: '関連性' },
        { key: 'reaction_check_score', label: '反応確認' },
        { key: 'refutation_risk', label: '反証リスク' },
        { key: 'event_total_score', label: '総合点' },
        { key: 'classification', label: '分類' },
        { key: 'action', label: 'アクション' },
        { key: 'required_numbers', label: '確認数字' },
        { key: 'reject_condition', label: '反証条件' },
      ], scoredRows, 'wide')}
      <div class="actions">
        <a href="620_qual_event_scoring_engine_summary.csv">概要CSV</a>
        <a href="621_qual_event_scoring_formula.csv">判定式CSV</a>
        <a href="622_qual_event_scored_cases.csv">判定結果CSV</a>
        <a href="qual_event_sample_cases_20260527.html">サンプルへ</a>
      </div>
    </section>
  </main>
</body>
</html>`);

fs.writeFileSync(path.join(ROOT, 'qual_event_scoring_engine_20260527.html'), html, 'utf8');

console.log(JSON.stringify({
  generatedAt,
  rows: scoredRows.length,
  output: 'qual_event_scoring_engine_20260527.html',
}, null, 2));
