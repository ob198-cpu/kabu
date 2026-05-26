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

function cleanLines(text) {
  return text
    .split('\n')
    .map((line) => line.replace(/[ \t]+$/g, ''))
    .join('\n');
}

function esc(value) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;');
}

function n(value) {
  const text = String(value ?? '').replace(/,/g, '').trim();
  if (text === '') return null;
  const parsed = Number(text);
  return Number.isFinite(parsed) ? parsed : null;
}

function median(values) {
  const nums = values.map(n).filter((v) => v !== null).sort((a, b) => a - b);
  if (!nums.length) return '';
  const mid = Math.floor(nums.length / 2);
  const value = nums.length % 2 ? nums[mid] : (nums[mid - 1] + nums[mid]) / 2;
  return Number(value.toFixed(2));
}

function fmt(value) {
  return value === null || value === '' || value === undefined ? '' : String(value);
}

const inputMapRows = readCsv('443_immediate_completion_input_map.csv');
const nisaRows = readCsv('245_nisa_1year_hold_score_top20.csv');
const selectionRows = readCsv('419_june_test_10_selection_board.csv');
const universeRows = readCsv('199_universe100_screening.csv');
const semiRows = readCsv('378_semiconductor_fundamental_completion_matrix.csv');

const dataByTicker = new Map();
for (const row of universeRows) {
  dataByTicker.set(row.ticker, {
    ticker: row.ticker,
    company: row.company,
    per: row.per_forecast,
    pbr: row.pbr_actual,
    roe_pct: row.roe_actual_pct,
    revenue_yoy_pct: row.revenue_yoy_pct,
    profit_yoy_pct: row.profit_yoy_pct,
    source: '199_universe100_screening.csv',
  });
}
for (const row of semiRows) {
  dataByTicker.set(row.ticker, {
    ticker: row.ticker,
    company: row.company,
    per: row.per,
    pbr: row.pbr,
    roe_pct: row.roe_pct,
    revenue_yoy_pct: row.revenue_yoy_pct,
    profit_yoy_pct: row.profit_yoy_pct,
    source: '378_semiconductor_fundamental_completion_matrix.csv',
  });
}
for (const row of nisaRows) {
  dataByTicker.set(row.ticker, {
    ticker: row.ticker,
    company: row.company,
    per: row.per,
    pbr: row.pbr,
    roe_pct: row.roe_pct,
    revenue_yoy_pct: row.revenue_yoy_pct,
    profit_yoy_pct: row.profit_yoy_pct,
    source: '245_nisa_1year_hold_score_top20.csv',
  });
}

function getMetric(ticker) {
  const local = dataByTicker.get(ticker);
  const selection = selectionRows.find((row) => row.ticker === ticker);
  return {
    ticker,
    company: local?.company || selection?.company || '',
    per: local?.per || '',
    pbr: local?.pbr || '',
    roe_pct: local?.roe_pct || '',
    revenue_yoy_pct: local?.revenue_yoy_pct || '',
    profit_yoy_pct: local?.profit_yoy_pct || '',
    source: local?.source || '',
  };
}

const peerMap = {
  '2802.T': ['2801.T', '2502.T', '2503.T', '4452.T'],
  '8306.T': ['8316.T', '8411.T'],
  '5020.T': ['1605.T', '5019.T'],
  '6146.T': ['6857.T', '6920.T', '7735.T', '8035.T'],
  '4385.T': ['3092.T', '4755.T', '4689.T', '6098.T'],
};

const financialRows = inputMapRows
  .filter((row) => row.task_category === '財務指標')
  .map((row) => {
    const metric = getMetric(row.ticker);
    const missing = ['per', 'pbr', 'roe_pct', 'revenue_yoy_pct', 'profit_yoy_pct']
      .filter((key) => fmt(metric[key]) === '');
    return {
      updated_at: generatedAt,
      ticker: row.ticker,
      company: row.company,
      task_category: row.task_category,
      per: metric.per,
      pbr: metric.pbr,
      roe_pct: metric.roe_pct,
      revenue_yoy_pct: metric.revenue_yoy_pct,
      profit_yoy_pct: metric.profit_yoy_pct,
      source_file: metric.source || '未取得',
      usable_fields: 5 - missing.length,
      missing_fields: missing.join(' / ') || 'なし',
      score_policy: missing.length ? '欠けた項目は点数に混ぜない' : '全項目を暫定スコアへ接続可能',
      completion_status: missing.length ? '部分接続' : '接続可能',
    };
  });

const sectorRows = inputMapRows
  .filter((row) => row.task_category === '業種別補正')
  .map((row) => {
    const target = getMetric(row.ticker);
    const peers = (peerMap[row.ticker] || []).map(getMetric);
    const peerPerMedian = median(peers.map((peer) => peer.per));
    const peerPbrMedian = median(peers.map((peer) => peer.pbr));
    const peerRoeMedian = median(peers.map((peer) => peer.roe_pct));
    const usablePeers = peers.filter((peer) => peer.per || peer.pbr || peer.roe_pct).length;
    const perVsPeer = target.per && peerPerMedian !== '' ? Number((n(target.per) - peerPerMedian).toFixed(2)) : '';
    const pbrVsPeer = target.pbr && peerPbrMedian !== '' ? Number((n(target.pbr) - peerPbrMedian).toFixed(2)) : '';
    const roeVsPeer = target.roe_pct && peerRoeMedian !== '' ? Number((n(target.roe_pct) - peerRoeMedian).toFixed(2)) : '';
    const status = usablePeers >= 2 && (peerPerMedian !== '' || peerPbrMedian !== '' || peerRoeMedian !== '') ? '部分接続' : '未接続';
    return {
      updated_at: generatedAt,
      ticker: row.ticker,
      company: row.company,
      task_category: row.task_category,
      target_per: target.per,
      target_pbr: target.pbr,
      target_roe_pct: target.roe_pct,
      peer_group: row.peer_group,
      peer_tickers_used: peers.filter((peer) => peer.source).map((peer) => peer.ticker).join(' / '),
      usable_peer_count: usablePeers,
      peer_per_median: peerPerMedian,
      peer_pbr_median: peerPbrMedian,
      peer_roe_median: peerRoeMedian,
      per_vs_peer: perVsPeer,
      pbr_vs_peer: pbrVsPeer,
      roe_vs_peer: roeVsPeer,
      source_files: [...new Set(peers.map((peer) => peer.source).filter(Boolean))].join(' / ') || '未取得',
      score_policy: status === '未接続' ? '同業中央値が不足。業種補正は点数に混ぜない' : '同業中央値は説明補助として接続。購入判断には未使用',
      completion_status: status,
    };
  });

const bridgeRows = inputMapRows.map((row) => {
  const financial = financialRows.find((item) => item.ticker === row.ticker);
  const sector = sectorRows.find((item) => item.ticker === row.ticker);
  const status = row.task_category === '財務指標' ? financial?.completion_status : sector?.completion_status;
  const missing = row.task_category === '財務指標'
    ? financial?.missing_fields
    : sector?.completion_status === '未接続'
      ? 'peer median'
      : '';
  return {
    updated_at: generatedAt,
    ticker: row.ticker,
    company: row.company,
    task_category: row.task_category,
    current_status: status || '未接続',
    score_connection: status === '接続可能'
      ? '暫定接続可'
      : status === '部分接続'
        ? '説明補助まで'
        : '接続不可',
    missing_or_limit: missing || 'なし',
    next_action: status === '接続可能'
      ? '検算表へ接続'
      : status === '部分接続'
        ? '不足値または同業数を追加取得'
        : '取得元を再確認',
  };
});

const summaryRows = [
  {
    updated_at: generatedAt,
    item: '即時補完8件',
    value: `${inputMapRows.length}件`,
    meaning: '入力欄レベルへ落とした対象',
  },
  {
    updated_at: generatedAt,
    item: '財務指標の接続可能',
    value: `${financialRows.filter((row) => row.completion_status === '接続可能').length}/${financialRows.length}件`,
    meaning: 'PER/PBR/ROE/売上成長/利益成長がそろった件数',
  },
  {
    updated_at: generatedAt,
    item: '業種補正の部分接続',
    value: `${sectorRows.filter((row) => row.completion_status === '部分接続').length}/${sectorRows.length}件`,
    meaning: '同業中央値を最低限計算できる件数',
  },
  {
    updated_at: generatedAt,
    item: '購入判断',
    value: '0社',
    meaning: 'ここは補完接続の工程。売買判断ではない',
  },
];

writeCsv('447_immediate_completion_reuse_summary.csv', summaryRows, ['updated_at', 'item', 'value', 'meaning']);
writeCsv('448_immediate_financial_metric_reuse.csv', financialRows, [
  'updated_at',
  'ticker',
  'company',
  'task_category',
  'per',
  'pbr',
  'roe_pct',
  'revenue_yoy_pct',
  'profit_yoy_pct',
  'source_file',
  'usable_fields',
  'missing_fields',
  'score_policy',
  'completion_status',
]);
writeCsv('449_immediate_sector_adjustment_bridge.csv', sectorRows, [
  'updated_at',
  'ticker',
  'company',
  'task_category',
  'target_per',
  'target_pbr',
  'target_roe_pct',
  'peer_group',
  'peer_tickers_used',
  'usable_peer_count',
  'peer_per_median',
  'peer_pbr_median',
  'peer_roe_median',
  'per_vs_peer',
  'pbr_vs_peer',
  'roe_vs_peer',
  'source_files',
  'score_policy',
  'completion_status',
]);
writeCsv('450_immediate_score_connection_gate.csv', bridgeRows, [
  'updated_at',
  'ticker',
  'company',
  'task_category',
  'current_status',
  'score_connection',
  'missing_or_limit',
  'next_action',
]);

const html = cleanLines(`<!doctype html>
<html lang="ja">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>即時補完8件 スコア接続状況</title>
  <style>
    :root {
      --ink: #111827;
      --muted: #4b5563;
      --line: #cfdced;
      --bg: #f5f8fc;
      --panel: #ffffff;
      --navy: #113a5c;
      --blue: #176da3;
      --green: #087a4d;
      --red: #b42318;
      --orange: #b65c00;
      --yellow: #fff7d6;
    }
    * { box-sizing: border-box; }
    body {
      margin: 0;
      font-family: "Yu Gothic", "Meiryo", Arial, sans-serif;
      color: var(--ink);
      background: var(--bg);
      line-height: 1.7;
      letter-spacing: 0;
    }
    main {
      width: min(1180px, calc(100% - 32px));
      margin: 0 auto;
      padding: 28px 0 56px;
    }
    .hero {
      background: var(--navy);
      color: white;
      border-radius: 18px;
      padding: 26px;
      margin-bottom: 18px;
    }
    h1 {
      font-size: clamp(26px, 4vw, 42px);
      line-height: 1.2;
      margin: 0 0 10px;
      letter-spacing: 0;
    }
    h2 {
      font-size: 24px;
      color: var(--navy);
      margin: 0 0 10px;
      letter-spacing: 0;
    }
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
    .kpis {
      display: grid;
      grid-template-columns: repeat(4, minmax(0, 1fr));
      gap: 10px;
      margin-top: 16px;
    }
    .kpi {
      background: white;
      color: var(--ink);
      border: 1px solid #c9def3;
      border-radius: 12px;
      padding: 12px;
    }
    .kpi b { display: block; color: var(--blue); font-size: 28px; line-height: 1; }
    .kpi span { display: block; color: var(--muted); font-size: 12px; margin-top: 5px; }
    .table-wrap { overflow-x: auto; border: 1px solid var(--line); border-radius: 12px; }
    table {
      width: 100%;
      min-width: 960px;
      border-collapse: collapse;
      table-layout: fixed;
      background: white;
    }
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
    th {
      background: #e8f4ff;
      color: #073b63;
      font-weight: 800;
    }
    tr:last-child td { border-bottom: 0; }
    th:last-child, td:last-child { border-right: 0; }
    .badge {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      min-height: 28px;
      padding: 4px 9px;
      border-radius: 999px;
      border: 1px solid var(--line);
      background: #f8fbff;
      font-weight: 800;
      font-size: 12px;
      white-space: nowrap;
    }
    .badge.green { color: var(--green); background: #edf9f3; border-color: #bce7d2; }
    .badge.orange { color: var(--orange); background: #fff3e2; border-color: #ffd7a3; }
    .badge.red { color: var(--red); background: #fff1f1; border-color: #ffd1d1; }
    .actions {
      display: flex;
      flex-wrap: wrap;
      gap: 10px;
      margin-top: 12px;
    }
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
      table { min-width: 780px; }
    }
  </style>
</head>
<body>
  <main>
    <section class="hero">
      <h1>即時補完8件 スコア接続状況</h1>
      <p>即時補完8件について、既存CSVから再利用できる数値と、本当にまだ埋まっていない項目を分けました。未入力項目は点数に混ぜず、部分接続は説明補助までに制限します。</p>
      <div class="actions">
        <a class="button" href="immediate_completion_input_map_20260526.html">入力マップへ戻る</a>
        <a class="button" href="450_immediate_score_connection_gate.csv">接続ゲートCSV</a>
        <a class="button" href="448_immediate_financial_metric_reuse.csv">財務CSV</a>
        <a class="button" href="449_immediate_sector_adjustment_bridge.csv">業種補正CSV</a>
      </div>
      <div class="kpis">
        <div class="kpi"><b>${inputMapRows.length}</b><span>即時補完対象</span></div>
        <div class="kpi"><b>${financialRows.filter((row) => row.completion_status === '接続可能').length}/${financialRows.length}</b><span>財務接続可能</span></div>
        <div class="kpi"><b>${sectorRows.filter((row) => row.completion_status === '部分接続').length}/${sectorRows.length}</b><span>業種補正部分接続</span></div>
        <div class="kpi"><b>0社</b><span>購入判断</span></div>
      </div>
    </section>

    <div class="notice">
      接続方針: 完全にそろった数値のみスコアへ接続します。欠けた項目、同業中央値が弱い項目、出典が弱い項目は説明補助または未接続にします。
    </div>

    <section class="panel">
      <h2>財務指標の再利用状況</h2>
      <div class="table-wrap">
        <table>
          <thead>
            <tr>
              <th style="width: 110px;">銘柄</th>
              <th style="width: 150px;">会社</th>
              <th style="width: 90px;">PER</th>
              <th style="width: 90px;">PBR</th>
              <th style="width: 90px;">ROE</th>
              <th style="width: 120px;">売上成長</th>
              <th style="width: 120px;">利益成長</th>
              <th style="width: 140px;">不足</th>
              <th style="width: 120px;">状態</th>
            </tr>
          </thead>
          <tbody>
            ${financialRows.map((row) => `
              <tr>
                <td>${esc(row.ticker)}</td>
                <td>${esc(row.company)}</td>
                <td>${esc(row.per)}</td>
                <td>${esc(row.pbr)}</td>
                <td>${esc(row.roe_pct)}</td>
                <td>${esc(row.revenue_yoy_pct)}</td>
                <td>${esc(row.profit_yoy_pct)}</td>
                <td>${esc(row.missing_fields)}</td>
                <td><span class="badge ${row.completion_status === '接続可能' ? 'green' : 'orange'}">${esc(row.completion_status)}</span></td>
              </tr>`).join('\n')}
          </tbody>
        </table>
      </div>
    </section>

    <section class="panel">
      <h2>業種別補正の接続状況</h2>
      <div class="table-wrap">
        <table>
          <thead>
            <tr>
              <th style="width: 110px;">銘柄</th>
              <th style="width: 150px;">会社</th>
              <th>同業ティッカー</th>
              <th style="width: 110px;">使用同業数</th>
              <th style="width: 110px;">同業PER中央値</th>
              <th style="width: 110px;">同業PBR中央値</th>
              <th style="width: 110px;">同業ROE中央値</th>
              <th style="width: 120px;">状態</th>
            </tr>
          </thead>
          <tbody>
            ${sectorRows.map((row) => `
              <tr>
                <td>${esc(row.ticker)}</td>
                <td>${esc(row.company)}</td>
                <td>${esc(row.peer_tickers_used || '未取得')}</td>
                <td>${esc(row.usable_peer_count)}</td>
                <td>${esc(row.peer_per_median)}</td>
                <td>${esc(row.peer_pbr_median)}</td>
                <td>${esc(row.peer_roe_median)}</td>
                <td><span class="badge ${row.completion_status === '部分接続' ? 'orange' : 'red'}">${esc(row.completion_status)}</span></td>
              </tr>`).join('\n')}
          </tbody>
        </table>
      </div>
    </section>

    <section class="panel">
      <h2>スコア接続ゲート</h2>
      <div class="table-wrap">
        <table>
          <thead>
            <tr>
              <th style="width: 110px;">銘柄</th>
              <th style="width: 150px;">会社</th>
              <th style="width: 130px;">カテゴリ</th>
              <th style="width: 120px;">状態</th>
              <th style="width: 130px;">接続</th>
              <th>不足・限界</th>
              <th>次の作業</th>
            </tr>
          </thead>
          <tbody>
            ${bridgeRows.map((row) => `
              <tr>
                <td>${esc(row.ticker)}</td>
                <td>${esc(row.company)}</td>
                <td>${esc(row.task_category)}</td>
                <td>${esc(row.current_status)}</td>
                <td><span class="badge ${row.score_connection === '暫定接続可' ? 'green' : row.score_connection === '説明補助まで' ? 'orange' : 'red'}">${esc(row.score_connection)}</span></td>
                <td>${esc(row.missing_or_limit)}</td>
                <td>${esc(row.next_action)}</td>
              </tr>`).join('\n')}
          </tbody>
        </table>
      </div>
      <div class="actions">
        <a class="button" href="447_immediate_completion_reuse_summary.csv">概要CSV</a>
        <a class="button" href="448_immediate_financial_metric_reuse.csv">財務CSV</a>
        <a class="button" href="449_immediate_sector_adjustment_bridge.csv">業種補正CSV</a>
        <a class="button" href="450_immediate_score_connection_gate.csv">接続ゲートCSV</a>
      </div>
    </section>
  </main>
</body>
</html>`);

fs.writeFileSync(path.join(ROOT, 'immediate_completion_score_bridge_20260526.html'), html, 'utf8');

console.log('created immediate_completion_score_bridge_20260526.html');
console.log(`financial=${financialRows.length}, sector=${sectorRows.length}`);
