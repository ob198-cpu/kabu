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
  return text !== '' && text !== '未取得' && text !== '未確認' && text !== '未接続';
}

const universeRows = readCsv('294_universe_membership_audit.csv');
const quantRows = readCsv('466_candidate_10_quantitative_evidence.csv');
const readinessRows = readCsv('494_candidate_10_selection_readiness_detail.csv');

const universeByTicker = new Map(universeRows.map((row) => [row.ticker, row]));
const readinessByTicker = new Map(readinessRows.map((row) => [row.ticker, row]));

const detailRows = quantRows.map((candidate) => {
  const universe = universeByTicker.get(candidate.ticker) || {};
  const readiness = readinessByTicker.get(candidate.ticker) || {};
  const inUniverse = Boolean(universe.ticker);
  return {
    updated_at: generatedAt,
    selection_rank: candidate.selection_rank,
    ticker: candidate.ticker,
    company: candidate.company,
    in_fixed_universe: inUniverse ? '採用済み' : '未確認',
    fixed_universe_id: universe.fixed_universe_id || '',
    universe_score: universe.universe_score || '',
    primary_purpose: universe.primary_purpose || '',
    usefulness_level: universe.usefulness_level || '',
    roles: universe.roles || '',
    fixed_reason: universe.fixed_reason || '',
    nisa_score_reference: candidate.nisa_score,
    quantitative_grade: candidate.quantitative_grade,
    data_readiness_score: readiness.data_readiness_score || '',
    current_gap: candidate.data_gap || '',
    lineage_note: inUniverse
      ? '固定母集団に採用済み。NISA 1年保有、時流テーマ、指数比較などの役割を持つ対象として10社確認へ進めている。'
      : '固定母集団との照合が必要。照合できるまで根拠付き選定には使わない。',
  };
});

const summaryRows = [
  {
    updated_at: generatedAt,
    item: '固定母集団',
    value: `${universeRows.length}社`,
    interpretation: '役割、データ取得状況、採用理由を持つ比較対象群。',
  },
  {
    updated_at: generatedAt,
    item: '現在の10社',
    value: `${detailRows.length}社`,
    interpretation: '6月テスト候補を検討するための詳細確認対象。',
  },
  {
    updated_at: generatedAt,
    item: '母集団照合済み',
    value: `${detailRows.filter((row) => row.in_fixed_universe === '採用済み').length}社`,
    interpretation: '固定母集団内の役割と採用理由に接続できた銘柄。',
  },
  {
    updated_at: generatedAt,
    item: '照合未確認',
    value: `${detailRows.filter((row) => row.in_fixed_universe !== '採用済み').length}社`,
    interpretation: '母集団との接続確認が必要な銘柄。',
  },
];

const ruleRows = [
  {
    rule: '100社は売買対象ではない',
    detail: '母集団は、指数代表、時流テーマ、NISA 1年保有、比較用などの役割を持つ検証対象群。',
  },
  {
    rule: '10社は固定母集団から説明する',
    detail: '10社の説明では、固定母集団上の役割、定量評価、データ準備状況をセットで示す。',
  },
  {
    rule: '照合できない銘柄は使わない',
    detail: '母集団との接続、データ出典、採用理由が確認できない銘柄は、根拠付きの候補説明に入れない。',
  },
  {
    rule: '数値結果を見て母集団を差し替えない',
    detail: '6月テスト前に母集団定義を固定し、後から都合よく入れ替えたように見えないように履歴を残す。',
  },
];

writeCsv('496_candidate_10_universe_lineage_summary.csv', summaryRows, [
  'updated_at',
  'item',
  'value',
  'interpretation',
]);

writeCsv('497_candidate_10_universe_lineage_detail.csv', detailRows, [
  'updated_at',
  'selection_rank',
  'ticker',
  'company',
  'in_fixed_universe',
  'fixed_universe_id',
  'universe_score',
  'primary_purpose',
  'usefulness_level',
  'roles',
  'fixed_reason',
  'nisa_score_reference',
  'quantitative_grade',
  'data_readiness_score',
  'current_gap',
  'lineage_note',
]);

writeCsv('498_candidate_10_universe_lineage_rules.csv', ruleRows, [
  'rule',
  'detail',
]);

const html = cleanLines(`<!doctype html>
<html lang="ja">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>候補10社 母集団からの選出経路 2026年5月26日</title>
  <style>
    :root {
      --ink: #061a33;
      --muted: #40536a;
      --line: #c8d9ea;
      --soft: #edf6ff;
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
      letter-spacing: 0;
    }
    header {
      background: linear-gradient(135deg, #062a4a, #0b668d);
      color: #fff;
      padding: 34px clamp(18px, 4vw, 58px);
    }
    h1 { margin: 0 0 8px; font-size: clamp(26px, 4vw, 42px); letter-spacing: 0; }
    header p { margin: 0; color: #eaf5ff; font-weight: 800; max-width: 1060px; }
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
      min-height: 120px;
    }
    .metric span { display: block; color: var(--muted); font-weight: 900; }
    .metric strong { display: block; font-size: 30px; color: var(--blue); }
    .notice {
      border-left: 8px solid var(--amber);
      background: #fff7ed;
      padding: 14px;
      border-radius: 8px;
      font-weight: 900;
      margin-top: 14px;
    }
    .toolbar { display: flex; flex-wrap: wrap; gap: 10px; margin-top: 14px; }
    .button {
      display: inline-flex;
      align-items: center;
      min-height: 38px;
      padding: 8px 12px;
      border-radius: 8px;
      border: 1px solid #9cc8ec;
      background: #fff;
      color: #062a4a;
      text-decoration: none;
      font-weight: 900;
      font-size: 13px;
    }
    .table-wrap { overflow-x: auto; border: 1px solid var(--line); border-radius: 8px; }
    table { width: 100%; border-collapse: collapse; min-width: 1160px; }
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
    <h1>候補10社 母集団からの選出経路</h1>
    <p>100社前後の固定母集団から、現在の10社がどの役割・採用理由で詳細確認へ進んでいるかを確認します。後から都合よく選んだように見えないための根拠台帳です。</p>
  </header>
  <main>
    <section>
      <h2>概要</h2>
      <div class="summary">
        ${summaryRows.map((row) => `
        <div class="metric">
          <span>${esc(row.item)}</span>
          <strong>${esc(row.value)}</strong>
          <small>${esc(row.interpretation)}</small>
        </div>`).join('')}
      </div>
      <p class="notice">扱い: このページは選出経路の説明であり、投資判断ではありません。10社の妥当性は、量的データ、質的仮説、決算後反応、6月市場イベントを合わせて再確認します。</p>
      <div class="toolbar">
        <a class="button" href="496_candidate_10_universe_lineage_summary.csv">496 要約CSV</a>
        <a class="button" href="497_candidate_10_universe_lineage_detail.csv">497 詳細CSV</a>
        <a class="button" href="498_candidate_10_universe_lineage_rules.csv">498 ルールCSV</a>
        <a class="button" href="candidate_10_selection_readiness_20260526.html">選出準備状況へ</a>
        <a class="button" href="index.html">メインページへ</a>
      </div>
    </section>

    <section>
      <h2>10社の母集団上の位置づけ</h2>
      <div class="table-wrap">
        <table>
          <thead>
            <tr>
              <th>選定順位</th><th>銘柄</th><th>母集団ID</th><th>役割</th><th>重要度</th><th>採用理由</th><th>参考NISA点</th><th>量的評価</th><th>準備点</th><th>残課題</th>
            </tr>
          </thead>
          <tbody>
            ${detailRows.map((row) => `
            <tr>
              <td>${esc(row.selection_rank)}</td>
              <td>${esc(row.ticker)} ${esc(row.company)}<br><small class="${row.in_fixed_universe === '採用済み' ? 'ok' : 'gap'}">${esc(row.in_fixed_universe)}</small></td>
              <td>${esc(row.fixed_universe_id || '未確認')}</td>
              <td>${esc(row.roles || row.primary_purpose || '未確認')}</td>
              <td>${esc(row.usefulness_level || '未確認')}</td>
              <td>${esc(row.fixed_reason || row.lineage_note)}</td>
              <td>${esc(row.nisa_score_reference)}</td>
              <td>${esc(row.quantitative_grade)}</td>
              <td>${esc(row.data_readiness_score || '未算出')}</td>
              <td>${esc(row.current_gap || '追加確認あり')}</td>
            </tr>`).join('')}
          </tbody>
        </table>
      </div>
    </section>

    <section>
      <h2>選出経路ルール</h2>
      <div class="table-wrap">
        <table>
          <thead><tr><th>ルール</th><th>内容</th></tr></thead>
          <tbody>
            ${ruleRows.map((row) => `<tr><td>${esc(row.rule)}</td><td>${esc(row.detail)}</td></tr>`).join('')}
          </tbody>
        </table>
      </div>
    </section>
  </main>
</body>
</html>`);

fs.writeFileSync(path.join(ROOT, 'candidate_10_universe_lineage_20260526.html'), html, 'utf8');

console.log(`created candidate_10_universe_lineage_20260526.html, rows=${detailRows.length}`);
