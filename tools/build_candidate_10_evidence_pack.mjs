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

function byTicker(rows) {
  return new Map(rows.map((row) => [row.ticker, row]));
}

function num(value) {
  const text = String(value ?? '').replace(/[%,倍点円]/g, '').replace(/,/g, '').trim();
  if (!text || text === '未取得') return null;
  const parsed = Number(text);
  return Number.isFinite(parsed) ? parsed : null;
}

function display(value, fallback = '未取得') {
  const text = String(value ?? '').trim();
  return text ? text : fallback;
}

function candidateRole(row) {
  if (row.gate_result === '継続確認') return '優先候補';
  if (row.gate_result === '比較対象') return '比較候補';
  if (row.gate_result === '反応待ち') return '反応待ち';
  if (row.gate_result === '要検算') return '検算対象';
  if (row.gate_result === '補完待ち') return '補完対象';
  return '保留';
}

function roleOrder(role) {
  return {
    優先候補: 1,
    比較候補: 2,
    反応待ち: 3,
    検算対象: 4,
    補完対象: 5,
    保留: 6,
  }[role] || 9;
}

function explain(row, quant, queue) {
  const points = [];
  points.push(`量的評価${row.quantitative_grade}、データ信頼度${row.data_confidence}、準備点${row.data_readiness_score}`);
  if (quant) {
    points.push(`PER ${display(quant.per)}、PBR ${display(quant.pbr)}、ROE ${display(quant.roe_pct)}`);
    points.push(`売上成長 ${display(quant.revenue_yoy_pct)}、利益成長 ${display(quant.profit_yoy_pct)}、1年騰落 ${display(quant.ret1y_pct)}`);
  }
  points.push(`決算後反応: ${row.reaction_layer}（${row.reaction_note}）`);
  points.push(`質的層: ${row.qualitative_layer}（${row.qualitative_note}）`);
  if (queue) points.push(`次作業: ${queue.task}`);
  return points.join('。');
}

function caution(row, quant) {
  const items = [];
  if (row.gate_result === '要検算') items.push('実績反応が弱いため、構造仮説をそのまま採用しない。');
  if (row.gate_result === '反応待ち') items.push('1日反応のみのため、5営業日と20営業日を待つ。');
  if (row.gate_result === '補完待ち') items.push('PERまたは財務指標の不足を解消するまで順位を固定しない。');
  if (quant?.data_gap && quant.data_gap !== '主な不足なし') items.push(`不足: ${quant.data_gap}`);
  if (!items.length) items.push('20営業日反応の到達後に再判定する。');
  return items.join(' ');
}

const gateRows = readCsv('509_candidate_10_test_selection_gate_detail.csv');
const quantRows = readCsv('466_candidate_10_quantitative_evidence.csv');
const queueRows = readCsv('511_candidate_10_tomorrow_finalization_queue.csv');
const perBridgeRows = readCsv('488_candidate_10_per_estimate_detail.csv');

const quantByTicker = byTicker(quantRows);
const queueByTicker = byTicker(queueRows);
const perBridgeByTicker = byTicker(perBridgeRows);

const evidenceRows = gateRows.map((row) => {
  const quant = quantByTicker.get(row.ticker);
  const queue = queueByTicker.get(row.ticker);
  const perBridge = perBridgeByTicker.get(row.ticker);
  const perDisplay = quant?.per && quant.per !== '未取得'
    ? quant.per
    : perBridge?.actual_per_estimate
      ? `${perBridge.actual_per_estimate}（${perBridge.source_type}）`
      : '未取得';
  const role = candidateRole(row);
  const priority = queue?.priority || '';
  return {
    updated_at: generatedAt,
    provisional_rank: '',
    role,
    ticker: row.ticker,
    company: row.company,
    sector: row.sector,
    quantitative_grade: row.quantitative_grade,
    data_confidence: row.data_confidence,
    data_readiness_score: row.data_readiness_score,
    test_readiness_score: row.test_readiness_score,
    nisa_score_reference: row.nisa_score_reference,
    reaction_layer: row.reaction_layer,
    reaction_note: row.reaction_note,
    qualitative_layer: row.qualitative_layer,
    qualitative_note: row.qualitative_note,
    per: perDisplay,
    pbr: quant?.pbr || '未取得',
    roe_pct: quant?.roe_pct || '未取得',
    revenue_yoy_pct: quant?.revenue_yoy_pct || '未取得',
    profit_yoy_pct: quant?.profit_yoy_pct || '未取得',
    ret1y_pct: quant?.ret1y_pct || '未取得',
    max_drawdown60_pct: quant?.max_drawdown60_pct || '未取得',
    decision_boundary: row.gate_result,
    evidence_summary: explain(row, { ...quant, per: perDisplay }, queue),
    caution: caution(row, quant),
    tomorrow_priority: priority,
    tomorrow_action: queue?.action || '',
    output_expected: queue?.output || '',
    purchase_status: '購入判断ではない',
  };
});

evidenceRows.sort((a, b) => {
  const byRole = roleOrder(a.role) - roleOrder(b.role);
  if (byRole !== 0) return byRole;
  const byPriority = Number(a.tomorrow_priority || 9) - Number(b.tomorrow_priority || 9);
  if (byPriority !== 0) return byPriority;
  return (num(b.test_readiness_score) ?? 0) - (num(a.test_readiness_score) ?? 0);
});
evidenceRows.forEach((row, index) => {
  row.provisional_rank = String(index + 1);
});

const summaryRows = [
  {
    updated_at: generatedAt,
    item: '暫定候補',
    value: `${evidenceRows.length}社`,
    interpretation: '明日説明するための候補母集団。購入判断ではない。',
  },
  {
    updated_at: generatedAt,
    item: '優先候補',
    value: `${evidenceRows.filter((row) => row.role === '優先候補').length}社`,
    interpretation: '量的データと信頼度が比較に使え、説明根拠を優先整理する対象。',
  },
  {
    updated_at: generatedAt,
    item: '検算・補完',
    value: `${evidenceRows.filter((row) => ['検算対象', '補完対象', '反応待ち'].includes(row.role)).length}社`,
    interpretation: 'そのまま候補強化せず、追加確認が必要な対象。',
  },
  {
    updated_at: generatedAt,
    item: '明日の主作業',
    value: '根拠整理',
    interpretation: '優先候補の説明、反応待ちの更新、弱い実績反応の検算を進める。',
  },
];

writeCsv('513_candidate_10_evidence_pack_summary.csv', summaryRows, [
  'updated_at',
  'item',
  'value',
  'interpretation',
]);
writeCsv('514_candidate_10_evidence_pack_detail.csv', evidenceRows, [
  'updated_at',
  'provisional_rank',
  'role',
  'ticker',
  'company',
  'sector',
  'quantitative_grade',
  'data_confidence',
  'data_readiness_score',
  'test_readiness_score',
  'nisa_score_reference',
  'reaction_layer',
  'reaction_note',
  'qualitative_layer',
  'qualitative_note',
  'per',
  'pbr',
  'roe_pct',
  'revenue_yoy_pct',
  'profit_yoy_pct',
  'ret1y_pct',
  'max_drawdown60_pct',
  'decision_boundary',
  'evidence_summary',
  'caution',
  'tomorrow_priority',
  'tomorrow_action',
  'output_expected',
  'purchase_status',
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
  <title>候補10社 根拠パック 2026年5月26日</title>
  <style>
    :root {
      --ink: #061a33;
      --muted: #3f5168;
      --line: #c9d9ea;
      --bg: #f4f8fc;
      --navy: #0d3658;
      --blue: #0b6fa4;
      --soft: #eef7ff;
      --amber: #b45309;
      --green: #087f5b;
    }
    * { box-sizing: border-box; }
    body {
      margin: 0;
      font-family: "Yu Gothic", "Meiryo", system-ui, sans-serif;
      background: var(--bg);
      color: var(--ink);
      line-height: 1.75;
      letter-spacing: 0;
    }
    header { background: var(--navy); color: #fff; padding: 34px clamp(18px, 4vw, 58px); }
    h1 { margin: 0 0 10px; font-size: clamp(28px, 4vw, 42px); letter-spacing: 0; }
    header p { margin: 0; color: #e7f3ff; font-weight: 800; max-width: 1120px; }
    main { width: min(1240px, calc(100% - 32px)); margin: 24px auto 56px; }
    section { background: #fff; border: 1px solid var(--line); border-radius: 8px; padding: 22px; margin: 18px 0; break-inside: avoid; }
    h2 { margin: 0 0 14px; padding-left: 12px; border-left: 8px solid var(--blue); font-size: 24px; }
    .summary { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 12px; }
    .metric { border: 1px solid var(--line); border-radius: 8px; padding: 14px; background: var(--soft); min-height: 126px; }
    .metric span { display: block; color: var(--muted); font-weight: 900; }
    .metric strong { display: block; color: var(--blue); font-size: 30px; line-height: 1.2; }
    .notice { border-left: 8px solid var(--amber); background: #fff7ed; padding: 14px; border-radius: 8px; font-weight: 900; }
    .cards { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 14px; }
    .card { border: 1px solid var(--line); border-radius: 8px; padding: 14px; background: #fff; }
    .card h3 { margin: 0 0 8px; color: var(--navy); font-size: 18px; }
    .role { display: inline-flex; border: 1px solid #b7d4ec; border-radius: 999px; padding: 3px 9px; color: var(--green); font-weight: 900; font-size: 12px; }
    .card p { margin: 7px 0; font-size: 13px; }
    .toolbar { display: flex; flex-wrap: wrap; gap: 10px; margin-top: 14px; }
    .button { display: inline-flex; align-items: center; min-height: 38px; padding: 8px 12px; border-radius: 8px; border: 1px solid #9cc8ec; background: #fff; color: var(--navy); text-decoration: none; font-weight: 900; font-size: 13px; }
    .table-wrap { overflow-x: auto; border: 1px solid var(--line); border-radius: 8px; }
    table { width: 100%; min-width: 1280px; border-collapse: collapse; table-layout: fixed; }
    th, td { border-bottom: 1px solid var(--line); border-right: 1px solid var(--line); padding: 9px; vertical-align: top; text-align: left; overflow-wrap: anywhere; word-break: break-word; }
    th { background: #e6f1fb; color: #073b63; font-weight: 900; }
    tr:last-child td { border-bottom: 0; }
    th:last-child, td:last-child { border-right: 0; }
    @media (max-width: 900px) {
      main { width: min(100% - 20px, 1240px); }
      .summary, .cards { grid-template-columns: 1fr; }
      section { padding: 16px; }
    }
  </style>
</head>
<body>
  <header>
    <h1>候補10社 根拠パック</h1>
    <p>明日、候補10社を根拠付きで説明するための暫定資料です。量的データを主軸にし、質的情報と決算後反応は別層で扱います。</p>
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
      <p class="notice">この資料は候補説明用です。購入判断は、6月の市場イベント実数と20営業日反応の確認後に別途行います。</p>
      <div class="toolbar">
        <a class="button" href="513_candidate_10_evidence_pack_summary.csv">513 要約CSV</a>
        <a class="button" href="514_candidate_10_evidence_pack_detail.csv">514 詳細CSV</a>
        <a class="button" href="candidate_10_test_selection_gate_20260526.html">テスト選定ゲートへ</a>
        <a class="button" href="candidate_10_tomorrow_finalization_queue_20260526.html">明日作業キューへ</a>
        <a class="button" href="index.html">メインページへ</a>
      </div>
    </section>

    <section>
      <h2>候補カード</h2>
      <div class="cards">
        ${evidenceRows.map((row) => `
        <article class="card">
          <h3>${esc(row.provisional_rank)}. ${esc(row.ticker)} ${esc(row.company)}</h3>
          <span class="role">${esc(row.role)}</span>
          <p><b>根拠:</b> ${esc(row.evidence_summary)}</p>
          <p><b>注意:</b> ${esc(row.caution)}</p>
          <p><b>明日:</b> ${esc(row.tomorrow_action || '追加確認')}</p>
        </article>`).join('')}
      </div>
    </section>

    <section>
      <h2>詳細表</h2>
      ${table(
        [
          { key: 'provisional_rank', label: '暫定順位' },
          { key: 'role', label: '役割' },
          { key: 'ticker', label: '銘柄' },
          { key: 'company', label: '会社' },
          { key: 'quantitative_grade', label: '量的評価' },
          { key: 'data_confidence', label: '信頼度' },
          { key: 'test_readiness_score', label: '準備点' },
          { key: 'reaction_layer', label: '反応層' },
          { key: 'per', label: 'PER' },
          { key: 'pbr', label: 'PBR' },
          { key: 'roe_pct', label: 'ROE' },
          { key: 'revenue_yoy_pct', label: '売上成長' },
          { key: 'profit_yoy_pct', label: '利益成長' },
          { key: 'purchase_status', label: '扱い' },
        ],
        evidenceRows,
      )}
    </section>
  </main>
</body>
</html>`);

fs.writeFileSync(path.join(ROOT, 'candidate_10_evidence_pack_20260526.html'), html, 'utf8');

console.log(`created candidate_10_evidence_pack_20260526.html rows=${evidenceRows.length}`);
