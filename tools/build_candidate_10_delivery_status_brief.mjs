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

function table(headers, rows, className = '') {
  return `
    <div class="table-wrap ${className}">
      <table>
        <thead><tr>${headers.map((header) => `<th>${esc(header.label)}</th>`).join('')}</tr></thead>
        <tbody>
          ${rows.map((row) => `<tr>${headers.map((header) => `<td>${esc(row[header.key])}</td>`).join('')}</tr>`).join('')}
        </tbody>
      </table>
    </div>`;
}

const detailRows = readCsv('534_candidate_10_selection_completion_detail.csv');

const statusRows = [
  {
    updated_at: generatedAt,
    section: '完了',
    item: '候補10社の整理',
    detail: '100社前後の母集団から、詳細確認へ進める10社を主候補・比較枠・反応待ち・補完待ち・検算枠に分類。',
  },
  {
    updated_at: generatedAt,
    section: '完了',
    item: '質的仮説の扱い修正',
    detail: '時流・イベント・新商品・政策テーマは単独加点せず、確認条件と除外条件を置く形へ修正。',
  },
  {
    updated_at: generatedAt,
    section: '完了',
    item: '未到達データの分離',
    detail: '20営業日反応など未来日待ちのデータは暫定扱いとし、最終採点へ混ぜない形に整理。',
  },
  {
    updated_at: generatedAt,
    section: '未完了',
    item: '6月イベント後の再判定',
    detail: 'CPI、日銀、FOMC後に市場環境と候補銘柄の反応を更新し、NISA 1年保有テストの対象を再判定する。',
  },
  {
    updated_at: generatedAt,
    section: '未完了',
    item: '未来日到達待ち',
    detail: 'TDK、味の素、三井住友FGなど複数銘柄で20営業日反応が6月に到達するため、日付到達後に更新する。',
  },
];

const tomorrowRows = [
  {
    order: 1,
    task: '主候補3社の説明根拠整理',
    target: 'TDK、三井住友FG、味の素',
    output: '数値根拠、質的仮説、確認条件、除外条件を1社ごとに整理。',
  },
  {
    order: 2,
    task: '比較枠3社の扱い整理',
    target: 'ENEOS、ダイキン工業、三菱電機',
    output: '主候補に上げる条件、比較のまま残す条件を明記。',
  },
  {
    order: 3,
    task: '反応待ち・補完待ちの更新準備',
    target: '東京海上HD、メルカリ、三菱UFJ FG',
    output: '決算後反応、PER補助値、同業比較の不足を再確認。',
  },
  {
    order: 4,
    task: '検算枠の扱い確認',
    target: 'ディスコ',
    output: '20営業日対日経-19.66%の原因を確認し、主候補に戻す条件を明確化。',
  },
  {
    order: 5,
    task: '6月再判定ルールへの接続',
    target: '候補10社全体',
    output: 'S&P500、日経平均、TOPIXを1%以上上回る目標と接続。',
  },
];

const messageRows = [
  {
    type: '報告文',
    text: 'NISA 1年保有テストに向けて、候補10社を主候補・比較枠・反応待ち・補完待ち・検算枠に分類し、数値根拠と確認条件を整理しました。',
  },
  {
    type: '報告文',
    text: '現時点では、TDK、三井住友FG、味の素を主候補として説明可能な状態にし、他の7社は比較・反応確認・補完・検算の役割を分けています。',
  },
  {
    type: '報告文',
    text: '明日は、各社の不足データと決算後反応を確認し、6月のCPI・日銀・FOMC後に再判定できる形へ整えます。',
  },
];

writeCsv('536_candidate_10_delivery_status.csv', statusRows, [
  'updated_at',
  'section',
  'item',
  'detail',
]);

writeCsv('537_candidate_10_delivery_next_tasks.csv', tomorrowRows, [
  'order',
  'task',
  'target',
  'output',
]);

writeCsv('538_candidate_10_delivery_message.csv', messageRows, [
  'type',
  'text',
]);

const roleRows = ['主候補', '比較枠', '反応待ち', '補完待ち', '検算枠'].map((role) => ({
  role,
  count: detailRows.filter((row) => row.test_role === role).length,
  companies: detailRows
    .filter((row) => row.test_role === role)
    .map((row) => `${row.company}（${row.ticker}）`)
    .join('、') || '該当なし',
}));

const html = cleanLines(`<!doctype html>
<html lang="ja">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>候補10社 作業完了状況ブリーフ 2026年5月26日</title>
  <style>
    :root { --ink:#061a33; --muted:#334155; --line:#c9d9ea; --bg:#f4f8fc; --navy:#0d3658; --blue:#0b6fa4; --soft:#eef7ff; --green:#0f766e; --amber:#b45309; }
    * { box-sizing:border-box; }
    body { margin:0; font-family:"Yu Gothic","Meiryo",system-ui,sans-serif; background:var(--bg); color:var(--ink); line-height:1.72; letter-spacing:0; }
    header { background:var(--navy); color:#fff; padding:34px clamp(18px,4vw,58px); }
    h1 { margin:0 0 8px; font-size:clamp(28px,4vw,42px); letter-spacing:0; }
    header p { margin:0; color:#fff; font-weight:800; max-width:1120px; }
    main { width:min(1160px, calc(100% - 32px)); margin:24px auto 56px; }
    section { background:#fff; border:1px solid var(--line); border-radius:8px; padding:22px; margin:18px 0; break-inside:avoid; }
    h2 { margin:0 0 14px; padding-left:12px; border-left:8px solid var(--blue); font-size:24px; }
    .cards { display:grid; grid-template-columns:repeat(5,minmax(0,1fr)); gap:12px; }
    .card { border:1px solid var(--line); border-radius:8px; padding:14px; background:var(--soft); }
    .card span { display:block; color:var(--muted); font-weight:900; }
    .card strong { display:block; color:var(--green); font-size:28px; }
    .notice { border-left:8px solid var(--amber); background:#fff7ed; padding:14px; border-radius:8px; font-weight:900; color:#111827; }
    .toolbar { display:flex; flex-wrap:wrap; gap:10px; margin-top:14px; }
    .button { display:inline-flex; align-items:center; min-height:38px; padding:8px 12px; border-radius:8px; border:1px solid #9cc8ec; background:#fff; color:var(--navy); text-decoration:none; font-weight:900; font-size:13px; }
    .table-wrap { overflow-x:auto; border:1px solid var(--line); border-radius:8px; }
    table { width:100%; min-width:920px; border-collapse:collapse; table-layout:fixed; }
    th,td { border-bottom:1px solid var(--line); border-right:1px solid var(--line); padding:9px; vertical-align:top; text-align:left; overflow-wrap:anywhere; word-break:break-word; color:#061a33; }
    th { background:#e6f1fb; color:#073b63; font-weight:900; }
    tr:last-child td { border-bottom:0; }
    th:last-child,td:last-child { border-right:0; }
    @media (max-width:900px) { .cards { grid-template-columns:1fr 1fr; } }
    @media (max-width:620px) { main { width:min(100% - 20px,1160px); } .cards { grid-template-columns:1fr; } section { padding:16px; } }
  </style>
</head>
<body>
  <header>
    <h1>候補10社 作業完了状況ブリーフ</h1>
    <p>本日の到達点、未完了項目、明日の作業を、顧客向けに説明できる形で整理した資料です。</p>
  </header>
  <main>
    <section>
      <h2>候補10社の状態</h2>
      <div class="cards">
        ${roleRows.map((row) => `
        <div class="card">
          <span>${esc(row.role)}</span>
          <strong>${esc(row.count)}社</strong>
          <small>${esc(row.companies)}</small>
        </div>`).join('')}
      </div>
      <p class="notice">候補10社の説明準備は進みました。投資実行判断は、6月の市場イベントと未到達データ更新後に行います。</p>
      <div class="toolbar">
        <a class="button" href="candidate_10_selection_completion_pack_20260526.html">選定完了パックへ</a>
        <a class="button" href="candidate_10_next_data_tasks_20260526.html">次データ確認タスクへ</a>
        <a class="button" href="536_candidate_10_delivery_status.csv">536 状況CSV</a>
        <a class="button" href="537_candidate_10_delivery_next_tasks.csv">537 次作業CSV</a>
        <a class="button" href="538_candidate_10_delivery_message.csv">538 報告文CSV</a>
      </div>
    </section>

    <section>
      <h2>完了・未完了</h2>
      ${table(
        [
          { key: 'section', label: '区分' },
          { key: 'item', label: '項目' },
          { key: 'detail', label: '内容' },
        ],
        statusRows,
      )}
    </section>

    <section>
      <h2>明日の作業</h2>
      ${table(
        [
          { key: 'order', label: '順序' },
          { key: 'task', label: '作業' },
          { key: 'target', label: '対象' },
          { key: 'output', label: '成果' },
        ],
        tomorrowRows,
      )}
    </section>

    <section>
      <h2>共有文</h2>
      ${table(
        [
          { key: 'type', label: '区分' },
          { key: 'text', label: '文面' },
        ],
        messageRows,
      )}
    </section>
  </main>
</body>
</html>`);

fs.writeFileSync(path.join(ROOT, 'candidate_10_delivery_status_brief_20260526.html'), html, 'utf8');

console.log('created candidate_10_delivery_status_brief_20260526.html');
