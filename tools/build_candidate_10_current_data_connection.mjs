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
  return text
    .split('\n')
    .map((line) => line.replace(/[ \t]+$/g, ''))
    .join('\n');
}

function present(value) {
  const text = String(value ?? '').trim();
  return text !== '' && text !== '未取得' && text !== '未確認' && text !== '未算出';
}

function pctText(value) {
  const text = String(value ?? '').trim();
  if (!text) return '';
  return text.endsWith('%') ? text : `${text}%`;
}

const quantRows = readCsv('466_candidate_10_quantitative_evidence.csv');
const reactionRows = readCsv('273_top20_earnings_reaction_completed.csv');
const reactionByTicker = new Map(reactionRows.map((row) => [row.ticker, row]));

const matrixRows = quantRows.map((row) => {
  const reaction = reactionByTicker.get(row.ticker) || {};
  const hasReactionDetail = present(reaction.excess_1d_pct) && present(reaction.excess_5d_pct);
  const has20d = present(reaction.excess_20d_pct);
  const reactionStatus = has20d
    ? '20営業日到達'
    : hasReactionDetail
      ? '1日/5日まで接続済み'
      : present(reaction.earnings_reaction_score)
        ? '反応スコアのみ接続'
        : '未接続';
  const essentialFields = [
    row.per,
    row.pbr,
    row.roe_pct,
    row.revenue_yoy_pct,
    row.profit_yoy_pct,
    row.max_drawdown60_pct,
    row.data_confidence,
  ];
  const completed = essentialFields.filter(present).length;
  const essentialRate = Math.round((completed / essentialFields.length) * 100);
  const gapItems = [];
  if (!present(row.per)) gapItems.push('PER');
  if (!present(row.sector_per_median)) gapItems.push('業種中央値');
  if (!has20d) gapItems.push('決算後20営業日反応');
  gapItems.push('イベント実績層');
  return {
    updated_at: generatedAt,
    rank: row.selection_rank,
    ticker: row.ticker,
    company: row.company,
    sector: row.sector,
    quantitative_grade: row.quantitative_grade,
    nisa_score: row.nisa_score,
    priority_score: row.priority_score,
    data_confidence: row.data_confidence,
    per: row.per,
    pbr: row.pbr,
    roe_pct: row.roe_pct,
    revenue_yoy_pct: row.revenue_yoy_pct,
    profit_yoy_pct: row.profit_yoy_pct,
    ret1y_pct: row.ret1y_pct,
    max_drawdown60_pct: row.max_drawdown60_pct,
    sector_per_median: row.sector_per_median,
    reaction_status: reactionStatus,
    reaction_1d_excess_pct: reaction.excess_1d_pct || '',
    reaction_5d_excess_pct: reaction.excess_5d_pct || '',
    reaction_20d_excess_pct: reaction.excess_20d_pct || '',
    essential_completion_pct: `${essentialRate}%`,
    remaining_gap: gapItems.join(' / '),
    current_use: essentialRate >= 85 ? '量的比較に使用可・補完継続' : '補完後に使用',
    purchase_status: '購入判断ではない',
  };
});

const gapRows = [
  {
    updated_at: generatedAt,
    gap: 'PER未取得',
    count: matrixRows.filter((row) => !present(row.per)).length,
    handling: '公式資料、J-Quants、EPSと株価から再確認。未取得のまま点数に入れない。',
  },
  {
    updated_at: generatedAt,
    gap: '業種中央値未取得',
    count: matrixRows.filter((row) => !present(row.sector_per_median)).length,
    handling: '同業2社以上でPER/PBR/ROEの相対位置を確認。基準が不十分なら説明補助に止める。',
  },
  {
    updated_at: generatedAt,
    gap: '決算後20営業日反応未到達または詳細不足',
    count: matrixRows.filter((row) => row.reaction_status !== '20営業日到達').length,
    handling: '1日/5日は別枠で記録。20日未到達は未到達として扱い、無理に補完しない。',
  },
  {
    updated_at: generatedAt,
    gap: 'イベント実績層未完了',
    count: matrixRows.length,
    handling: '質的仮説を加点せず、イベント日と株価反応の実績が取れたものだけ検証対象にする。',
  },
];

const useable = matrixRows.filter((row) => row.current_use.startsWith('量的比較に使用可')).length;
const needSupplement = matrixRows.filter((row) => row.remaining_gap !== '').length;
const summaryRows = [
  {
    updated_at: generatedAt,
    item: '対象銘柄',
    value: `${matrixRows.length}社`,
    interpretation: '候補10社すべてについて、現時点で入っている量的データを整理した。',
  },
  {
    updated_at: generatedAt,
    item: '量的比較に使用可',
    value: `${useable}社`,
    interpretation: '主要項目の入力率が高い銘柄。購入判断ではなく、比較の土台として使用する。',
  },
  {
    updated_at: generatedAt,
    item: '追加補完が必要',
    value: `${needSupplement}社`,
    interpretation: '主要な量的比較とは別に、PER、業種中央値、反応データ、イベント実績を補完する。',
  },
  {
    updated_at: generatedAt,
    item: '購入判断',
    value: '0社',
    interpretation: '6月の市場イベント実数と最終ゲート確認までは、購入判断に接続しない。',
  },
];

writeCsv('484_candidate_10_current_data_summary.csv', summaryRows, [
  'updated_at',
  'item',
  'value',
  'interpretation',
]);
writeCsv('485_candidate_10_current_data_matrix.csv', matrixRows, [
  'updated_at',
  'rank',
  'ticker',
  'company',
  'sector',
  'quantitative_grade',
  'nisa_score',
  'priority_score',
  'data_confidence',
  'per',
  'pbr',
  'roe_pct',
  'revenue_yoy_pct',
  'profit_yoy_pct',
  'ret1y_pct',
  'max_drawdown60_pct',
  'sector_per_median',
  'reaction_status',
  'reaction_1d_excess_pct',
  'reaction_5d_excess_pct',
  'reaction_20d_excess_pct',
  'essential_completion_pct',
  'remaining_gap',
  'current_use',
  'purchase_status',
]);
writeCsv('486_candidate_10_remaining_gap_counts.csv', gapRows, [
  'updated_at',
  'gap',
  'count',
  'handling',
]);

const html = cleanLines(`<!doctype html>
<html lang="ja">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>候補10社 現時点データ接続状況</title>
  <style>
    :root {
      --ink: #061a33;
      --muted: #4d6178;
      --line: #c8d9ea;
      --soft: #eef6ff;
      --blue: #0b66a0;
      --green: #087f5b;
      --amber: #b45309;
      --red: #b42318;
      --bg: #f6f9fc;
    }
    * { box-sizing: border-box; }
    body {
      margin: 0;
      font-family: "Yu Gothic", "Meiryo", system-ui, sans-serif;
      color: var(--ink);
      background: var(--bg);
      line-height: 1.75;
    }
    header {
      background: linear-gradient(135deg, #052c50, #0b668d);
      color: #fff;
      padding: 34px clamp(18px, 4vw, 58px);
    }
    h1 { margin: 0 0 8px; font-size: clamp(26px, 4vw, 42px); letter-spacing: 0; }
    header p { margin: 0; color: #eaf5ff; font-weight: 800; max-width: 980px; }
    main { width: min(1220px, calc(100% - 32px)); margin: 24px auto 56px; }
    section {
      background: #fff;
      border: 1px solid var(--line);
      border-radius: 8px;
      padding: 22px;
      margin: 18px 0;
      break-inside: avoid;
    }
    h2 {
      margin: 0 0 14px;
      padding-left: 12px;
      border-left: 8px solid var(--blue);
      font-size: 24px;
    }
    .summary {
      display: grid;
      grid-template-columns: repeat(4, minmax(0, 1fr));
      gap: 12px;
    }
    .metric {
      border: 1px solid var(--line);
      border-radius: 8px;
      padding: 14px;
      background: var(--soft);
      min-height: 110px;
    }
    .metric strong { display: block; font-size: 26px; color: var(--blue); }
    .notice {
      border-left: 8px solid var(--amber);
      background: #fff7ed;
      padding: 14px;
      border-radius: 8px;
      font-weight: 900;
    }
    .table-wrap { overflow-x: auto; border: 1px solid var(--line); border-radius: 8px; }
    table { width: 100%; border-collapse: collapse; min-width: 1120px; }
    th, td {
      border-bottom: 1px solid var(--line);
      padding: 9px;
      text-align: left;
      vertical-align: top;
      color: var(--ink);
      word-break: break-word;
    }
    th { background: #e6f1fb; font-weight: 900; }
    tr:last-child td { border-bottom: 0; }
    .ok { color: var(--green); font-weight: 900; }
    .pending { color: var(--amber); font-weight: 900; }
    .gap { color: var(--red); font-weight: 900; }
    @media (max-width: 860px) {
      .summary { grid-template-columns: 1fr; }
      main { width: min(100% - 20px, 1220px); }
      section { padding: 16px; }
    }
    @media print {
      body { background: #fff; }
      section { break-inside: avoid; }
      .table-wrap { overflow: visible; }
      table { min-width: 0; font-size: 10px; }
    }
  </style>
</head>
<body>
  <header>
    <h1>候補10社 現時点データ接続状況</h1>
    <p>既存CSVに入っている実データを候補10社へ接続し、使える数値と未完了の数値を分けた表です。</p>
  </header>
  <main>
    <section>
      <h2>概要</h2>
      <div class="summary">
        <div class="metric"><span>対象銘柄</span><strong>${matrixRows.length}社</strong><small>候補10社すべて</small></div>
        <div class="metric"><span>量的比較に使用可</span><strong>${useable}社</strong><small>主要項目が高めに接続済み</small></div>
        <div class="metric"><span>追加補完</span><strong>${needSupplement}社</strong><small>不足項目を明示</small></div>
        <div class="metric"><span>購入判断</span><strong>0社</strong><small>6月イベント後に別判定</small></div>
      </div>
      <p class="notice">ここで「使用可」としているのは、候補比較の材料として使えるという意味です。購入判断、推奨、実行指示ではありません。</p>
    </section>

    <section>
      <h2>銘柄別データ接続表</h2>
      <div class="table-wrap">
        <table>
          <thead>
            <tr>
              <th>順位</th><th>銘柄</th><th>量的評価</th><th>NISA点</th><th>信頼度</th><th>PER</th><th>PBR</th><th>ROE</th><th>売上成長</th><th>利益成長</th><th>1年騰落</th><th>60日最大下落</th><th>決算後反応</th><th>入力率</th><th>残課題</th><th>現時点の扱い</th>
            </tr>
          </thead>
          <tbody>
            ${matrixRows.map((row) => `
            <tr>
              <td>${esc(row.rank)}</td>
              <td>${esc(row.ticker)} ${esc(row.company)}</td>
              <td>${esc(row.quantitative_grade)}</td>
              <td>${esc(row.nisa_score)}</td>
              <td>${esc(row.data_confidence)}</td>
              <td class="${present(row.per) ? 'ok' : 'gap'}">${esc(row.per || '未取得')}</td>
              <td>${esc(row.pbr)}</td>
              <td>${esc(pctText(row.roe_pct))}</td>
              <td>${esc(pctText(row.revenue_yoy_pct))}</td>
              <td>${esc(pctText(row.profit_yoy_pct))}</td>
              <td>${esc(pctText(row.ret1y_pct))}</td>
              <td>${esc(pctText(row.max_drawdown60_pct))}</td>
              <td class="${row.reaction_status === '20営業日到達' ? 'ok' : 'pending'}">${esc(row.reaction_status)}</td>
              <td>${esc(row.essential_completion_pct)}</td>
              <td>${esc(row.remaining_gap)}</td>
              <td>${esc(row.current_use)}</td>
            </tr>`).join('')}
          </tbody>
        </table>
      </div>
    </section>

    <section>
      <h2>残課題の件数</h2>
      <div class="table-wrap">
        <table>
          <thead><tr><th>残課題</th><th>件数</th><th>扱い</th></tr></thead>
          <tbody>
            ${gapRows.map((row) => `
            <tr>
              <td>${esc(row.gap)}</td>
              <td>${esc(row.count)}</td>
              <td>${esc(row.handling)}</td>
            </tr>`).join('')}
          </tbody>
        </table>
      </div>
    </section>
  </main>
</body>
</html>`);

fs.writeFileSync(path.join(ROOT, 'candidate_10_current_data_connection_20260526.html'), html, 'utf8');

console.log(`created candidate_10_current_data_connection_20260526.html, rows=${matrixRows.length}`);
