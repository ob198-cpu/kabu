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

function num(value) {
  const text = String(value ?? '').replace(/[%,倍点円]/g, '').replace(/,/g, '').trim();
  if (!text || text === '未取得' || text === '未算出') return null;
  const parsed = Number(text);
  return Number.isFinite(parsed) ? parsed : null;
}

function median(values) {
  const nums = values.filter((value) => Number.isFinite(value)).sort((a, b) => a - b);
  if (!nums.length) return null;
  const mid = Math.floor(nums.length / 2);
  return nums.length % 2 ? nums[mid] : (nums[mid - 1] + nums[mid]) / 2;
}

function round(value, digits = 2) {
  if (value === null || value === undefined || !Number.isFinite(value)) return '';
  return Number(value).toFixed(digits).replace(/\.?0+$/, '');
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

const broadGroups = {
  食品: ['食品', '飲料', '生活必需品', '化粧品'],
  エネルギー: ['エネルギー', '素材', '化学'],
  空調: ['空調', '機械', 'FA', '制御機器', '建機'],
  総合電機: ['総合電機', 'FA', '制御機器', '電子部品'],
  ネット: ['ネット', 'ネット/通信', 'ネット広告', 'EC', 'IT', '人材/IT'],
};

const universeRows = readCsv('199_universe100_screening.csv');
const sectorRows = readCsv('300_candidate_sector_adjustment.csv');
const perBridgeRows = fs.existsSync(path.join(ROOT, '488_candidate_10_per_estimate_detail.csv'))
  ? readCsv('488_candidate_10_per_estimate_detail.csv')
  : [];
const perBridgeByTicker = new Map(perBridgeRows.map((row) => [row.ticker, row]));

for (const row of universeRows) {
  const bridge = perBridgeByTicker.get(row.ticker);
  if ((!row.per_forecast || row.per_forecast === '未取得') && bridge?.actual_per_estimate) {
    row.per_forecast = bridge.actual_per_estimate;
  }
}

function metricsFor(sectors) {
  const rows = universeRows.filter((row) => sectors.includes(row.sector));
  const per = rows.map((row) => num(row.per_forecast));
  const pbr = rows.map((row) => num(row.pbr_actual));
  const roe = rows.map((row) => num(row.roe_actual_pct));
  return {
    rows,
    perCount: per.filter((value) => value !== null).length,
    pbrCount: pbr.filter((value) => value !== null).length,
    roeCount: roe.filter((value) => value !== null).length,
    perMedian: median(per),
    pbrMedian: median(pbr),
    roeMedian: median(roe),
  };
}

const broadRows = sectorRows.map((row) => {
  const sectors = broadGroups[row.sector] || [row.sector];
  const metrics = metricsFor(sectors);
  const canReference = metrics.rows.length >= 3
    && metrics.perCount >= 3
    && metrics.pbrCount >= 3
    && metrics.roeCount >= 3
    && [num(row.per), num(row.pbr), num(row.roe_pct)].filter((value) => value !== null).length >= 2;
  return {
    updated_at: generatedAt,
    ticker: row.ticker,
    company: row.company,
    exact_sector: row.sector,
    broad_group: sectors.join(' / '),
    broad_peer_count: metrics.rows.length,
    per_count: metrics.perCount,
    pbr_count: metrics.pbrCount,
    roe_count: metrics.roeCount,
    broad_per_median: round(metrics.perMedian),
    broad_pbr_median: round(metrics.pbrMedian),
    broad_roe_median_pct: round(metrics.roeMedian),
    exact_status: row.adjustment_status,
    broad_status: canReference ? '広義参考可' : '広義でも不足',
    treatment: canReference ? '説明補助。テスト判定用スコアには混ぜない。' : '不足理由を表示し、無理に比較しない。',
    reason: canReference
      ? '広義グループで3社以上、PER/PBR/ROEが3件以上そろう。'
      : `広義${metrics.rows.length}社、PER ${metrics.perCount}件、PBR ${metrics.pbrCount}件、ROE ${metrics.roeCount}件。`,
  };
});

const summaryRows = [
  {
    updated_at: generatedAt,
    item: '候補10社',
    value: `${broadRows.length}社`,
    meaning: '厳密な同業比較が不足する銘柄に対し、広義比較が可能か確認。',
  },
  {
    updated_at: generatedAt,
    item: '広義参考可',
    value: `${broadRows.filter((row) => row.broad_status === '広義参考可').length}社`,
    meaning: '説明補助として使えるが、テスト判定用スコアには混ぜない。',
  },
  {
    updated_at: generatedAt,
    item: '広義でも不足',
    value: `${broadRows.filter((row) => row.broad_status !== '広義参考可').length}社`,
    meaning: '近い業種まで広げても公開CSV内では指標不足。',
  },
];

writeCsv('527_candidate_10_broad_peer_reference_summary.csv', summaryRows, [
  'updated_at',
  'item',
  'value',
  'meaning',
]);

writeCsv('528_candidate_10_broad_peer_reference_detail.csv', broadRows, [
  'updated_at',
  'ticker',
  'company',
  'exact_sector',
  'broad_group',
  'broad_peer_count',
  'per_count',
  'pbr_count',
  'roe_count',
  'broad_per_median',
  'broad_pbr_median',
  'broad_roe_median_pct',
  'exact_status',
  'broad_status',
  'treatment',
  'reason',
]);

function table(headers, rows) {
  return `
    <div class="table-wrap">
      <table>
        <thead><tr>${headers.map((header) => `<th>${esc(header.label)}</th>`).join('')}</tr></thead>
        <tbody>
          ${rows.map((row) => `<tr>${headers.map((header) => `<td>${esc(row[header.key])}</td>`).join('')}</tr>`).join('')}
        </tbody>
      </table>
    </div>`;
}

const html = cleanLines(`<!doctype html>
<html lang="ja">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>候補10社 広義同業参考 2026年5月26日</title>
  <style>
    :root { --ink:#061a33; --muted:#3f5168; --line:#c9d9ea; --bg:#f4f8fc; --navy:#0d3658; --blue:#0b6fa4; --soft:#eef7ff; --amber:#b45309; }
    * { box-sizing:border-box; }
    body { margin:0; font-family:"Yu Gothic","Meiryo",system-ui,sans-serif; background:var(--bg); color:var(--ink); line-height:1.72; letter-spacing:0; }
    header { background:var(--navy); color:#fff; padding:34px clamp(18px,4vw,58px); }
    h1 { margin:0 0 8px; font-size:clamp(28px,4vw,42px); letter-spacing:0; }
    header p { margin:0; color:#e7f3ff; font-weight:800; max-width:1120px; }
    main { width:min(1240px, calc(100% - 32px)); margin:24px auto 56px; }
    section { background:#fff; border:1px solid var(--line); border-radius:8px; padding:22px; margin:18px 0; break-inside:avoid; }
    h2 { margin:0 0 14px; padding-left:12px; border-left:8px solid var(--blue); font-size:24px; }
    .summary { display:grid; grid-template-columns:repeat(3,minmax(0,1fr)); gap:12px; }
    .metric { border:1px solid var(--line); border-radius:8px; padding:14px; background:var(--soft); min-height:118px; }
    .metric span { display:block; color:var(--muted); font-weight:900; }
    .metric strong { display:block; color:var(--blue); font-size:30px; line-height:1.2; }
    .notice { border-left:8px solid var(--amber); background:#fff7ed; padding:14px; border-radius:8px; font-weight:900; }
    .toolbar { display:flex; flex-wrap:wrap; gap:10px; margin-top:14px; }
    .button { display:inline-flex; align-items:center; min-height:38px; padding:8px 12px; border-radius:8px; border:1px solid #9cc8ec; background:#fff; color:var(--navy); text-decoration:none; font-weight:900; font-size:13px; }
    .table-wrap { overflow-x:auto; border:1px solid var(--line); border-radius:8px; }
    table { width:100%; min-width:1320px; border-collapse:collapse; table-layout:fixed; }
    th,td { border-bottom:1px solid var(--line); border-right:1px solid var(--line); padding:9px; vertical-align:top; text-align:left; overflow-wrap:anywhere; word-break:break-word; }
    th { background:#e6f1fb; color:#073b63; font-weight:900; }
    tr:last-child td { border-bottom:0; }
    th:last-child,td:last-child { border-right:0; }
    @media (max-width:900px) { main { width:min(100% - 20px,1240px); } .summary { grid-template-columns:1fr; } section { padding:16px; } }
  </style>
</head>
<body>
  <header>
    <h1>候補10社 広義同業参考</h1>
    <p>厳密な同業比較が不足する銘柄について、近い業種まで広げた場合に説明補助として使えるかを確認します。</p>
  </header>
  <main>
    <section>
      <h2>概要</h2>
      <div class="summary">
        ${summaryRows.map((row) => `
        <div class="metric">
          <span>${esc(row.item)}</span>
          <strong>${esc(row.value)}</strong>
          <small>${esc(row.meaning)}</small>
        </div>`).join('')}
      </div>
      <p class="notice">広義比較は説明補助です。厳密な同業比較と違うため、テスト判定用スコアには混ぜません。</p>
      <div class="toolbar">
        <a class="button" href="527_candidate_10_broad_peer_reference_summary.csv">527 要約CSV</a>
        <a class="button" href="528_candidate_10_broad_peer_reference_detail.csv">528 詳細CSV</a>
        <a class="button" href="sector_adjustment_20260525.html">厳密同業比較へ</a>
        <a class="button" href="candidate_10_tomorrow_brief_20260526.html">明日説明ブリーフへ</a>
        <a class="button" href="index.html">メインページへ</a>
      </div>
    </section>

    <section>
      <h2>広義比較表</h2>
      ${table(
        [
          { key: 'ticker', label: '銘柄' },
          { key: 'company', label: '会社' },
          { key: 'exact_sector', label: '厳密業種' },
          { key: 'broad_group', label: '広義グループ' },
          { key: 'broad_peer_count', label: '社数' },
          { key: 'per_count', label: 'PER件数' },
          { key: 'pbr_count', label: 'PBR件数' },
          { key: 'roe_count', label: 'ROE件数' },
          { key: 'broad_per_median', label: '広義PER中央値' },
          { key: 'broad_pbr_median', label: '広義PBR中央値' },
          { key: 'broad_roe_median_pct', label: '広義ROE中央値' },
          { key: 'exact_status', label: '厳密比較' },
          { key: 'broad_status', label: '広義比較' },
          { key: 'treatment', label: '扱い' },
          { key: 'reason', label: '理由' },
        ],
        broadRows,
      )}
    </section>
  </main>
</body>
</html>`);

fs.writeFileSync(path.join(ROOT, 'candidate_10_broad_peer_reference_20260526.html'), html, 'utf8');

console.log(`created candidate_10_broad_peer_reference_20260526.html rows=${broadRows.length}`);
