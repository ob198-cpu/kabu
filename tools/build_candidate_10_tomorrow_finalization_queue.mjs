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

function queueFor(row) {
  if (row.gate_result === '継続確認') {
    return {
      priority: 1,
      task: '候補説明の根拠整理',
      action: '公式決算値、PER/PBR/ROE、5日反応、質的仮説を1枚説明にまとめる',
      output: '候補として残す理由と20営業日待ちの注意点',
    };
  }
  if (row.gate_result === '反応待ち') {
    return {
      priority: 1,
      task: '5営業日反応の追加取得',
      action: '基準日、5営業日後株価、日経平均比較を取得し、暫定反応を更新する',
      output: '反応待ちから継続確認または要検算へ分類',
    };
  }
  if (row.gate_result === '要検算') {
    return {
      priority: 1,
      task: '弱い実績反応の検算',
      action: '決算日、基準終値、20営業日終値、日経平均比較を再確認する',
      output: '構造仮説を残すか、候補順位を下げるかの判断材料',
    };
  }
  if (row.gate_result === '比較対象') {
    return {
      priority: 2,
      task: '補欠候補の比較整理',
      action: '同業比較、質的仮説、5日反応を確認し、上位候補との差を明記する',
      output: '10社内に残す理由または控え候補扱い',
    };
  }
  if (row.gate_result === '補完待ち') {
    return {
      priority: 2,
      task: '不足データ補完',
      action: 'PERまたは財務指標の公式値・試算値を確認し、採点へ接続できるか判断する',
      output: '補完後に候補へ戻すか、今回は除外するかの判断',
    };
  }
  return {
    priority: 3,
    task: '追加確認',
    action: '未接続データを確認する',
    output: '扱いの再分類',
  };
}

const detailRows = readCsv('509_candidate_10_test_selection_gate_detail.csv');

const queueRows = detailRows.map((row) => {
  const q = queueFor(row);
  return {
    updated_at: generatedAt,
    priority: q.priority,
    gate_result: row.gate_result,
    ticker: row.ticker,
    company: row.company,
    quantitative_grade: row.quantitative_grade,
    reaction_layer: row.reaction_layer,
    task: q.task,
    action: q.action,
    output: q.output,
    current_reason: row.gate_reason,
  };
}).sort((a, b) => {
  if (Number(a.priority) !== Number(b.priority)) return Number(a.priority) - Number(b.priority);
  return String(a.gate_result).localeCompare(String(b.gate_result), 'ja');
});

const summaryRows = [
  {
    updated_at: generatedAt,
    item: '優先1',
    value: `${queueRows.filter((row) => Number(row.priority) === 1).length}社`,
    interpretation: '明日までに優先して説明根拠・反応・検算をそろえる対象。',
  },
  {
    updated_at: generatedAt,
    item: '優先2',
    value: `${queueRows.filter((row) => Number(row.priority) === 2).length}社`,
    interpretation: '補欠比較または不足補完で扱いを決める対象。',
  },
  {
    updated_at: generatedAt,
    item: '購入判断',
    value: '0社',
    interpretation: 'ここでは購入判断を行わず、候補説明と検算を進める。',
  },
];

writeCsv('511_candidate_10_tomorrow_finalization_queue.csv', queueRows, [
  'updated_at',
  'priority',
  'gate_result',
  'ticker',
  'company',
  'quantitative_grade',
  'reaction_layer',
  'task',
  'action',
  'output',
  'current_reason',
]);
writeCsv('512_candidate_10_tomorrow_finalization_summary.csv', summaryRows, [
  'updated_at',
  'item',
  'value',
  'interpretation',
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
  <title>候補10社 明日までの確定作業キュー</title>
  <style>
    :root {
      --ink: #071b31;
      --line: #c9d9ea;
      --bg: #f4f8fc;
      --navy: #0d3658;
      --blue: #0b6fa4;
      --soft: #eef7ff;
      --amber: #b45309;
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
    header p { margin: 0; color: #e7f3ff; font-weight: 800; max-width: 1080px; }
    main { width: min(1220px, calc(100% - 32px)); margin: 24px auto 56px; }
    section { background: #fff; border: 1px solid var(--line); border-radius: 8px; padding: 22px; margin: 18px 0; break-inside: avoid; }
    h2 { margin: 0 0 14px; padding-left: 12px; border-left: 8px solid var(--blue); font-size: 24px; }
    .summary { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 12px; }
    .metric { border: 1px solid var(--line); border-radius: 8px; padding: 14px; background: var(--soft); min-height: 120px; }
    .metric span { display: block; font-weight: 900; }
    .metric strong { display: block; color: var(--blue); font-size: 30px; }
    .notice { border-left: 8px solid var(--amber); background: #fff7ed; padding: 14px; border-radius: 8px; font-weight: 900; }
    .toolbar { display: flex; flex-wrap: wrap; gap: 10px; margin-top: 14px; }
    .button {
      display: inline-flex; align-items: center; min-height: 38px; padding: 8px 12px;
      border-radius: 8px; border: 1px solid #9cc8ec; background: #fff;
      color: var(--navy); text-decoration: none; font-weight: 900; font-size: 13px;
    }
    .table-wrap { overflow-x: auto; border: 1px solid var(--line); border-radius: 8px; }
    table { width: 100%; min-width: 1180px; border-collapse: collapse; table-layout: fixed; }
    th, td {
      border-bottom: 1px solid var(--line); border-right: 1px solid var(--line);
      padding: 9px; vertical-align: top; text-align: left; overflow-wrap: anywhere; word-break: break-word;
    }
    th { background: #e6f1fb; color: #073b63; font-weight: 900; }
    tr:last-child td { border-bottom: 0; }
    th:last-child, td:last-child { border-right: 0; }
    @media (max-width: 900px) {
      main { width: min(100% - 20px, 1220px); }
      .summary { grid-template-columns: 1fr; }
      section { padding: 16px; }
    }
  </style>
</head>
<body>
  <header>
    <h1>候補10社 明日までの確定作業キュー</h1>
    <p>テスト候補10社を根拠付きで説明するため、各銘柄の次作業を優先度別に整理しました。目的は候補説明の精度を上げることであり、この表では購入判断を行いません。</p>
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
      <p class="notice">優先1は、明日までに説明根拠をそろえるか、候補順位を下げるかを判断する対象です。</p>
      <div class="toolbar">
        <a class="button" href="511_candidate_10_tomorrow_finalization_queue.csv">511 作業キューCSV</a>
        <a class="button" href="512_candidate_10_tomorrow_finalization_summary.csv">512 要約CSV</a>
        <a class="button" href="candidate_10_test_selection_gate_20260526.html">テスト選定ゲートへ</a>
        <a class="button" href="index.html">メインページへ</a>
      </div>
    </section>

    <section>
      <h2>銘柄別作業キュー</h2>
      ${table(
        [
          { key: 'priority', label: '優先' },
          { key: 'gate_result', label: '現在の扱い' },
          { key: 'ticker', label: '銘柄' },
          { key: 'company', label: '会社' },
          { key: 'quantitative_grade', label: '量的評価' },
          { key: 'reaction_layer', label: '反応層' },
          { key: 'task', label: '作業' },
          { key: 'action', label: '具体内容' },
          { key: 'output', label: '成果物' },
        ],
        queueRows,
      )}
    </section>
  </main>
</body>
</html>`);

fs.writeFileSync(path.join(ROOT, 'candidate_10_tomorrow_finalization_queue_20260526.html'), html, 'utf8');

console.log(`created candidate_10_tomorrow_finalization_queue_20260526.html rows=${queueRows.length}`);
