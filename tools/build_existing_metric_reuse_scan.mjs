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

const targets = [
  { ticker: '8306.T', company: '三菱UFJ FG', required: 'PER' },
  { ticker: '6146.T', company: 'ディスコ', required: 'PER' },
  { ticker: '4385.T', company: 'メルカリ', required: 'PER' },
  { ticker: '2802.T', company: '味の素', required: '同業中央値' },
  { ticker: '5020.T', company: 'ENEOS HD', required: '同業中央値' },
];

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
    .map((items, index) => ({
      rowNumber: index + 2,
      data: Object.fromEntries(headers.map((header, itemIndex) => [header, items[itemIndex] || ''])),
    }))
    .filter((row) => Object.values(row.data).some((item) => String(item).trim() !== ''));
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

function isMetricHeader(header) {
  const key = header.toLowerCase();
  return /per|pbr|roe|eps|revenue|profit|sales|income|margin|dividend|yield|cagr|growth/.test(key)
    || /PER|PBR|ROE|EPS|売上|利益|純利|営業|配当|利回り|成長/.test(header);
}

function isPerHeader(header) {
  const key = header.toLowerCase();
  return ['per', 'per_forecast', 'forecast_per', 'per_actual', 'actual_per'].includes(key)
    || header === 'PER'
    || header === '予想PER';
}

function goodValue(value) {
  const text = String(value ?? '').trim();
  return text !== '' && text !== '未取得' && text !== '未確認' && text !== '未算出' && text !== 'なし' && text !== '-';
}

const csvFiles = fs
  .readdirSync(ROOT)
  .filter((name) => name.endsWith('.csv'))
  .filter((name) => !/^(45[1-9]|46[0-9])_/.test(name))
  .sort();
const rowHits = [];
const perCandidates = [];

for (const file of csvFiles) {
  let parsed = [];
  try {
    parsed = parseCsv(fs.readFileSync(path.join(ROOT, file), 'utf8'));
  } catch {
    continue;
  }
  for (const row of parsed) {
    const valuesText = Object.values(row.data).join(' ');
    const target = targets.find((item) => valuesText.includes(item.ticker));
    if (!target) continue;
    const metricPairs = Object.entries(row.data).filter(([header, value]) => isMetricHeader(header) && goodValue(value));
    if (!metricPairs.length) continue;
    rowHits.push({
      updated_at: generatedAt,
      ticker: target.ticker,
      company: target.company,
      required: target.required,
      source_file: file,
      source_row: row.rowNumber,
      metric_columns: metricPairs.map(([header]) => header).join(' / '),
      metric_values: metricPairs.map(([header, value]) => `${header}=${value}`).join(' / '),
      use_decision: '要確認',
    });
    for (const [header, value] of metricPairs) {
      if (!isPerHeader(header)) continue;
      perCandidates.push({
        updated_at: generatedAt,
        ticker: target.ticker,
        company: target.company,
        source_file: file,
        source_row: row.rowNumber,
        per_column: header,
        per_value: value,
        use_decision: '未採用',
        reason: '列名と値は見つかったが、予想PER/実績PERの基準と出典確認が未完了',
      });
    }
  }
}

const perTargets = targets.filter((item) => item.required === 'PER');
const decisionRows = perTargets.map((target) => {
  const candidates = perCandidates.filter((row) => row.ticker === target.ticker);
  return {
    updated_at: generatedAt,
    ticker: target.ticker,
    company: target.company,
    missing_item: 'PER',
    candidate_count: candidates.length,
    current_decision: candidates.length ? '候補値あり・未採用' : '既存CSV内では未発見',
    score_connection: '未接続',
    next_action: candidates.length ? '基準日・予想/実績区分・出典を確認' : '公式IR/J-Quants/EDINET等から取得',
  };
});

const summaryRows = [
  {
    updated_at: generatedAt,
    item: 'スキャン対象CSV',
    value: `${csvFiles.length}件`,
    interpretation: '既存のCSVファイルを横断確認。',
  },
  {
    updated_at: generatedAt,
    item: '対象銘柄',
    value: `${targets.length}件`,
    interpretation: 'PER不足3件と同業中央値不足2件を優先確認。',
  },
  {
    updated_at: generatedAt,
    item: 'PER候補行',
    value: `${perCandidates.length}件`,
    interpretation: '値候補は見つけても、基準確認まではスコア未接続。',
  },
  {
    updated_at: generatedAt,
    item: 'スコアへ戻した件数',
    value: '0件',
    interpretation: '現時点では再利用候補の確認工程。採点にはまだ混ぜない。',
  },
];

writeCsv('456_existing_metric_reuse_scan_summary.csv', summaryRows, [
  'updated_at',
  'item',
  'value',
  'interpretation',
]);

writeCsv('457_existing_per_reuse_candidates.csv', perCandidates, [
  'updated_at',
  'ticker',
  'company',
  'source_file',
  'source_row',
  'per_column',
  'per_value',
  'use_decision',
  'reason',
]);

writeCsv('458_existing_metric_row_hits.csv', rowHits, [
  'updated_at',
  'ticker',
  'company',
  'required',
  'source_file',
  'source_row',
  'metric_columns',
  'metric_values',
  'use_decision',
]);

writeCsv('459_existing_metric_reuse_decision.csv', decisionRows, [
  'updated_at',
  'ticker',
  'company',
  'missing_item',
  'candidate_count',
  'current_decision',
  'score_connection',
  'next_action',
]);

function table(headers, rows) {
  return `
    <div class="table-wrap">
      <table>
        <thead><tr>${headers.map((header) => `<th>${esc(header.label)}</th>`).join('')}</tr></thead>
        <tbody>
          ${rows.length
            ? rows
                .map(
                  (row) => `
                    <tr>${headers.map((header) => `<td>${esc(row[header.key])}</td>`).join('')}</tr>
                  `,
                )
                .join('')
            : `<tr><td colspan="${headers.length}">該当なし</td></tr>`}
        </tbody>
      </table>
    </div>
  `;
}

const html = cleanLines(`<!doctype html>
<html lang="ja">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>既存CSV 指標再利用スキャン</title>
  <style>
    :root {
      --ink: #111827;
      --muted: #4b5563;
      --line: #cfdced;
      --bg: #f5f8fc;
      --panel: #ffffff;
      --navy: #113a5c;
      --blue: #176da3;
      --yellow: #fff7d6;
    }
    * { box-sizing: border-box; }
    body {
      margin: 0;
      font-family: "Yu Gothic", "Meiryo", Arial, sans-serif;
      color: var(--ink);
      background: var(--bg);
      line-height: 1.75;
      letter-spacing: 0;
    }
    main { width: min(1180px, calc(100% - 32px)); margin: 0 auto; padding: 28px 0 56px; }
    .hero {
      background: var(--navy);
      color: white;
      border-radius: 18px;
      padding: 26px;
      margin-bottom: 18px;
    }
    h1 { font-size: clamp(26px, 4vw, 42px); line-height: 1.2; margin: 0 0 10px; letter-spacing: 0; }
    h2 { font-size: 24px; color: var(--navy); margin: 0 0 10px; letter-spacing: 0; }
    p { margin: 0 0 12px; }
    .hero p { color: #e8f4ff; }
    .panel {
      background: var(--panel);
      border: 1px solid var(--line);
      border-radius: 14px;
      padding: 18px;
      margin-bottom: 16px;
      box-shadow: 0 8px 20px rgba(20, 57, 91, .06);
    }
    .notice {
      border: 2px solid #f0c36c;
      background: var(--yellow);
      border-radius: 14px;
      padding: 14px 16px;
      font-weight: 800;
      color: #5f3900;
      margin-bottom: 16px;
    }
    .kpis { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 10px; margin-top: 16px; }
    .kpi { background: white; color: var(--ink); border: 1px solid #c9def3; border-radius: 12px; padding: 12px; }
    .kpi b { display: block; color: var(--blue); font-size: 28px; line-height: 1; }
    .kpi span { display: block; color: var(--muted); font-size: 12px; margin-top: 5px; }
    .table-wrap { overflow-x: auto; border: 1px solid var(--line); border-radius: 12px; }
    table { width: 100%; min-width: 980px; border-collapse: collapse; table-layout: fixed; background: white; }
    th, td {
      border-bottom: 1px solid var(--line);
      border-right: 1px solid var(--line);
      padding: 9px 10px;
      vertical-align: top;
      text-align: left;
      overflow-wrap: anywhere;
      word-break: break-word;
      color: var(--ink);
    }
    th { background: #e8f4ff; color: #073b63; font-weight: 800; }
    tr:last-child td { border-bottom: 0; }
    th:last-child, td:last-child { border-right: 0; }
    .actions { display: flex; flex-wrap: wrap; gap: 10px; margin-top: 12px; }
    .button {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      min-height: 40px;
      padding: 8px 12px;
      border-radius: 10px;
      border: 1px solid #9dc7e8;
      background: #fff;
      color: var(--navy);
      text-decoration: none;
      font-weight: 800;
    }
    @media (max-width: 900px) {
      main { width: min(100% - 20px, 1180px); padding-top: 16px; }
      .kpis { grid-template-columns: 1fr 1fr; }
      table { min-width: 820px; }
    }
  </style>
</head>
<body>
  <main>
    <section class="hero">
      <h1>既存CSV 指標再利用スキャン</h1>
      <p>これまで蓄積したCSVの中から、PER/PBR/ROE/EPSなどの候補値を横断検索しました。見つかった値は採点へ自動投入せず、出典と基準確認が終わるまで未接続にします。</p>
      <div class="actions">
        <a class="button" href="missing_per_peer_fetch_queue_20260526.html">補完キューへ戻る</a>
        <a class="button" href="457_existing_per_reuse_candidates.csv">PER候補CSV</a>
        <a class="button" href="458_existing_metric_row_hits.csv">指標ヒットCSV</a>
        <a class="button" href="459_existing_metric_reuse_decision.csv">採用判断CSV</a>
      </div>
      <div class="kpis">
        <div class="kpi"><b>${csvFiles.length}</b><span>スキャンCSV</span></div>
        <div class="kpi"><b>${rowHits.length}</b><span>指標ヒット行</span></div>
        <div class="kpi"><b>${perCandidates.length}</b><span>PER候補値</span></div>
        <div class="kpi"><b>0件</b><span>採点へ再接続</span></div>
      </div>
    </section>

    <div class="notice">
      重要: 値が見つかっても、予想PERか実績PERか、基準日が合うか、公式/準公式の出典かを確認するまで、購入候補スコアには混ぜません。
    </div>

    <section class="panel">
      <h2>PER候補値</h2>
      ${table(
        [
          { key: 'ticker', label: '銘柄' },
          { key: 'company', label: '会社' },
          { key: 'source_file', label: 'ファイル' },
          { key: 'source_row', label: '行' },
          { key: 'per_column', label: '列' },
          { key: 'per_value', label: '値' },
          { key: 'use_decision', label: '採用' },
          { key: 'reason', label: '理由' },
        ],
        perCandidates.slice(0, 80),
      )}
    </section>

    <section class="panel">
      <h2>採用判断</h2>
      ${table(
        [
          { key: 'ticker', label: '銘柄' },
          { key: 'company', label: '会社' },
          { key: 'missing_item', label: '不足' },
          { key: 'candidate_count', label: '候補数' },
          { key: 'current_decision', label: '現判断' },
          { key: 'score_connection', label: 'スコア接続' },
          { key: 'next_action', label: '次作業' },
        ],
        decisionRows,
      )}
    </section>
  </main>
</body>
</html>`);

fs.writeFileSync(path.join(ROOT, 'existing_metric_reuse_scan_20260526.html'), html, 'utf8');

console.log('created existing_metric_reuse_scan_20260526.html');
console.log(`csv=${csvFiles.length}, hits=${rowHits.length}, per=${perCandidates.length}`);
