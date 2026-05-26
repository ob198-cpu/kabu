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

const draftRows = readCsv('519_candidate_10_selection_draft_detail.csv');
const closureRows = readCsv('515_candidate_10_completion_closure_summary.csv');

const statusOrder = ['説明優先', '比較維持', '反応更新待ち', '補完後に再判定', '検算優先'];

const briefRows = statusOrder.map((status) => {
  const rows = draftRows.filter((row) => row.work_status === status);
  return {
    updated_at: generatedAt,
    status,
    count: `${rows.length}社`,
    companies: rows.map((row) => `${row.company}（${row.ticker}）`).join('、') || 'なし',
    explanation:
      status === '説明優先' ? '明日、最初に根拠を説明する対象。数字は比較的そろっているが、6月再判定までは実行判断ではない。'
        : status === '比較維持' ? '10社内に残し、上位候補との差と弱点を説明する対象。'
          : status === '反応更新待ち' ? '決算後反応がまだ不足しているため、反応更新後に扱いを決める対象。'
            : status === '補完後に再判定' ? '不足値または試算値があり、補完後に順位を固定する対象。'
              : '実績反応が弱く、構造仮説を残すかどうかを検算する対象。',
  };
});

const taskRows = [
  {
    updated_at: generatedAt,
    task_rank: '1',
    task: '説明優先3社の根拠整理',
    detail: 'TDK、三井住友FG、味の素について、量的根拠、質的仮説、残課題、6月再判定条件を1社ずつ説明できる形にする。',
  },
  {
    updated_at: generatedAt,
    task_rank: '2',
    task: '比較維持3社の位置づけ整理',
    detail: 'ENEOS、ダイキン工業、三菱電機について、なぜ上位ではなく比較維持なのかを数字で説明する。',
  },
  {
    updated_at: generatedAt,
    task_rank: '3',
    task: '反応待ち・補完・検算の分岐確認',
    detail: '東京海上HD、メルカリ、三菱UFJ FG、ディスコは、足りないデータまたは弱い反応を明記して扱う。',
  },
  {
    updated_at: generatedAt,
    task_rank: '4',
    task: '6月再判定条件との接続',
    detail: 'CPI、日銀、FOMC、20営業日反応の到達後に、10社を再分類する条件へ接続する。',
  },
];

const lineRows = [
  {
    updated_at: generatedAt,
    line: '候補10社について、量的データ・決算後反応・同業比較・質的仮説を分けて整理し、明日説明する作業順位を作成しました。',
  },
  {
    updated_at: generatedAt,
    line: '現時点ではTDK、三井住友FG、味の素を説明優先、ENEOS・ダイキン・三菱電機を比較維持、東京海上HDなどは反応待ち・補完・検算に分類しています。',
  },
  {
    updated_at: generatedAt,
    line: '質的仮説は単独で加点せず、売上・利益・受注・決算後反応などで確認できるものだけ根拠として扱う方針にしています。',
  },
];

writeCsv('524_candidate_10_tomorrow_brief_status.csv', briefRows, [
  'updated_at',
  'status',
  'count',
  'companies',
  'explanation',
]);

writeCsv('525_candidate_10_tomorrow_brief_tasks.csv', taskRows, [
  'updated_at',
  'task_rank',
  'task',
  'detail',
]);

writeCsv('526_candidate_10_tomorrow_line_text.csv', lineRows, [
  'updated_at',
  'line',
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
  <title>候補10社 明日説明ブリーフ 2026年5月26日</title>
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
    body { margin: 0; font-family: "Yu Gothic", "Meiryo", system-ui, sans-serif; background: var(--bg); color: var(--ink); line-height: 1.72; letter-spacing: 0; }
    header { background: var(--navy); color: #fff; padding: 34px clamp(18px, 4vw, 58px); }
    h1 { margin: 0 0 8px; font-size: clamp(28px, 4vw, 42px); letter-spacing: 0; }
    header p { margin: 0; color: #e7f3ff; font-weight: 800; max-width: 1120px; }
    main { width: min(1240px, calc(100% - 32px)); margin: 24px auto 56px; }
    section { background: #fff; border: 1px solid var(--line); border-radius: 8px; padding: 22px; margin: 18px 0; break-inside: avoid; }
    h2 { margin: 0 0 14px; padding-left: 12px; border-left: 8px solid var(--blue); font-size: 24px; }
    .cards { display: grid; grid-template-columns: repeat(5, minmax(0, 1fr)); gap: 12px; }
    .card { border: 1px solid var(--line); border-radius: 8px; padding: 14px; background: var(--soft); min-height: 150px; }
    .card span { display: block; color: var(--muted); font-weight: 900; }
    .card strong { display: block; color: var(--blue); font-size: 30px; line-height: 1.2; }
    .line-box { border-left: 8px solid var(--green); background: #f0fff8; padding: 14px; border-radius: 8px; font-weight: 900; }
    .notice { border-left: 8px solid var(--amber); background: #fff7ed; padding: 14px; border-radius: 8px; font-weight: 900; }
    .toolbar { display: flex; flex-wrap: wrap; gap: 10px; margin-top: 14px; }
    .button { display: inline-flex; align-items: center; min-height: 38px; padding: 8px 12px; border-radius: 8px; border: 1px solid #9cc8ec; background: #fff; color: var(--navy); text-decoration: none; font-weight: 900; font-size: 13px; }
    .table-wrap { overflow-x: auto; border: 1px solid var(--line); border-radius: 8px; }
    table { width: 100%; min-width: 980px; border-collapse: collapse; table-layout: fixed; }
    th, td { border-bottom: 1px solid var(--line); border-right: 1px solid var(--line); padding: 9px; vertical-align: top; text-align: left; overflow-wrap: anywhere; word-break: break-word; }
    th { background: #e6f1fb; color: #073b63; font-weight: 900; }
    tr:last-child td { border-bottom: 0; }
    th:last-child, td:last-child { border-right: 0; }
    @media (max-width: 1000px) {
      main { width: min(100% - 20px, 1240px); }
      .cards { grid-template-columns: 1fr; }
      section { padding: 16px; }
    }
  </style>
</head>
<body>
  <header>
    <h1>候補10社 明日説明ブリーフ</h1>
    <p>候補10社を明日説明するための要点整理です。実行判断ではなく、根拠整理と再判定準備の資料です。</p>
  </header>
  <main>
    <section>
      <h2>分類サマリー</h2>
      <div class="cards">
        ${briefRows.map((row) => `
        <div class="card">
          <span>${esc(row.status)}</span>
          <strong>${esc(row.count)}</strong>
          <small>${esc(row.companies)}</small>
        </div>`).join('')}
      </div>
      <p class="notice">6月の市場イベントと20営業日反応を確認するまでは、最終判断として扱いません。</p>
      <div class="toolbar">
        <a class="button" href="524_candidate_10_tomorrow_brief_status.csv">524 分類CSV</a>
        <a class="button" href="525_candidate_10_tomorrow_brief_tasks.csv">525 タスクCSV</a>
        <a class="button" href="526_candidate_10_tomorrow_line_text.csv">526 LINE文CSV</a>
        <a class="button" href="candidate_10_selection_draft_20260526.html">選定ドラフトへ</a>
        <a class="button" href="candidate_10_qualitative_validation_checklist_20260526.html">質的仮説チェックへ</a>
        <a class="button" href="index.html">メインページへ</a>
      </div>
    </section>

    <section>
      <h2>報告文</h2>
      <div class="line-box">
        ${lineRows.map((row) => `<p>${esc(row.line)}</p>`).join('')}
      </div>
    </section>

    <section>
      <h2>明日の作業</h2>
      ${table(
        [
          { key: 'task_rank', label: '順番' },
          { key: 'task', label: '作業' },
          { key: 'detail', label: '内容' },
        ],
        taskRows,
      )}
    </section>

    <section>
      <h2>分類詳細</h2>
      ${table(
        [
          { key: 'status', label: '分類' },
          { key: 'count', label: '件数' },
          { key: 'companies', label: '銘柄' },
          { key: 'explanation', label: '説明' },
        ],
        briefRows,
      )}
    </section>
  </main>
</body>
</html>`);

fs.writeFileSync(path.join(ROOT, 'candidate_10_tomorrow_brief_20260526.html'), html, 'utf8');

console.log(`created candidate_10_tomorrow_brief_20260526.html rows=${briefRows.length}`);
