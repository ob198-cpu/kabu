import fs from 'node:fs';

const ticketCsv = 'june_event_input_tickets_20260615.csv';
const entryCsv = 'june_event_result_entry_20260615.csv';
const htmlFile = 'june_event_result_entry_20260615.html';
const generatedAt = new Date().toLocaleString('ja-JP', {
  timeZone: 'Asia/Tokyo',
  hour12: false,
});

function parseCsv(text) {
  const clean = String(text ?? '').replace(/^\uFEFF/, '');
  const rows = [];
  let row = [];
  let cell = '';
  let quote = false;
  for (let i = 0; i < clean.length; i += 1) {
    const ch = clean[i];
    const next = clean[i + 1];
    if (quote) {
      if (ch === '"' && next === '"') {
        cell += '"';
        i += 1;
      } else if (ch === '"') {
        quote = false;
      } else {
        cell += ch;
      }
      continue;
    }
    if (ch === '"') quote = true;
    else if (ch === ',') {
      row.push(cell);
      cell = '';
    } else if (ch === '\n') {
      row.push(cell.replace(/\r$/, ''));
      rows.push(row);
      row = [];
      cell = '';
    } else {
      cell += ch;
    }
  }
  if (cell.length || row.length) {
    row.push(cell.replace(/\r$/, ''));
    rows.push(row);
  }
  const headers = rows.shift() ?? [];
  return rows
    .filter((values) => values.some((value) => String(value ?? '').trim() !== ''))
    .map((values) => Object.fromEntries(headers.map((header, index) => [header, values[index] ?? ''])));
}

function csvCell(value) {
  const text = String(value ?? '');
  return /[",\n\r]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

function writeCsv(file, rows) {
  fs.writeFileSync(file, `\uFEFF${rows.map((row) => row.map(csvCell).join(',')).join('\n')}\n`, 'utf8');
}

function h(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

const tickets = parseCsv(fs.readFileSync(ticketCsv, 'utf8'));
const existing = fs.existsSync(entryCsv) ? parseCsv(fs.readFileSync(entryCsv, 'utf8')) : [];
const existingById = new Map(existing.map((row) => [row.ID, row]));

const rows = tickets.map((ticket) => {
  const old = existingById.get(ticket.ID) ?? {};
  return {
    作成時刻: old.作成時刻 || generatedAt,
    更新時刻: generatedAt,
    ID: ticket.ID,
    確認時期: ticket.確認時期,
    イベント: ticket.チケット,
    入力するもの: ticket.入力するもの,
    取得元候補: ticket.取得元,
    入力ステータス: old.入力ステータス || '未入力',
    結果値: old.結果値 || '',
    市場反応: old.市場反応 || '',
    出所URL: old.出所URL || '',
    出所時刻または対象期間: old.出所時刻または対象期間 || '',
    取得日時: old.取得日時 || '',
    反映先: old.反映先 || ticket.反映先,
    反映状況: old.反映状況 || '未反映',
    次アクション: old.次アクション || '公式結果と市場反応を確認後に入力',
    停止条件メモ: old.停止条件メモ || ticket.停止条件,
    確認者メモ: old.確認者メモ || '',
  };
});

const headers = [
  '作成時刻',
  '更新時刻',
  'ID',
  '確認時期',
  'イベント',
  '入力するもの',
  '取得元候補',
  '入力ステータス',
  '結果値',
  '市場反応',
  '出所URL',
  '出所時刻または対象期間',
  '取得日時',
  '反映先',
  '反映状況',
  '次アクション',
  '停止条件メモ',
  '確認者メモ',
];

writeCsv(entryCsv, [headers, ...rows.map((row) => headers.map((header) => row[header]))]);

const complete = rows.filter((row) => row.入力ステータス === '確認済').length;
const caution = rows.filter((row) => ['注意', '停止候補', '部分確認'].includes(row.入力ステータス)).length;
const missing = rows.length - complete - caution;

const tableRows = rows.map((row) => `<tr>
  <td class="id">${h(row.ID)}</td>
  <td>${h(row.確認時期)}</td>
  <td>${h(row.イベント)}</td>
  <td class="${row.入力ステータス === '確認済' ? 'ok' : row.入力ステータス === '未入力' ? 'bad' : 'warn'}">${h(row.入力ステータス)}</td>
  <td>${h(row.入力するもの)}</td>
  <td>${h(row.結果値 || '未入力')}</td>
  <td>${h(row.市場反応 || '未入力')}</td>
  <td>${row.出所URL ? `<a href="${h(row.出所URL)}">${h(row.出所URL)}</a>` : '未入力'}</td>
  <td>${h(row.反映状況)}</td>
  <td>${h(row.次アクション)}</td>
</tr>`).join('');

const html = `<!doctype html>
<html lang="ja">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>6月イベント結果入力台帳</title>
  <style>
    :root{--ink:#061827;--navy:#103b60;--blue:#0b67a3;--line:#c9dceb;--bg:#f4f8fb;--paper:#fff;--red:#b42318;--green:#116b4f;--amber:#9a5b00}
    *{box-sizing:border-box}
    body{margin:0;background:var(--bg);color:var(--ink);font-family:-apple-system,BlinkMacSystemFont,"Segoe UI","Noto Sans JP",Meiryo,sans-serif;font-size:18px;line-height:1.75}
    header{background:linear-gradient(135deg,#103b60,#0b67a3);color:#fff;padding:30px}
    header h1{margin:0 0 8px;font-size:clamp(32px,4vw,44px);line-height:1.2;letter-spacing:0}
    header p{margin:0;font-weight:800;max-width:1180px}
    main{max-width:1320px;margin:0 auto;padding:22px}
    section{background:var(--paper);border:1px solid var(--line);border-radius:12px;padding:20px;margin:0 0 18px;box-shadow:0 8px 20px rgba(20,60,90,.08);break-inside:avoid}
    h2{margin:0 0 12px;border-left:8px solid var(--blue);padding-left:12px;color:var(--navy);font-size:27px}
    .cards{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:12px}
    .card{border:1px solid var(--line);border-radius:10px;background:#fbfdff;padding:14px}
    .card b{display:block;color:var(--navy);font-size:16px}
    .card strong{display:block;font-size:30px;line-height:1.25;color:var(--blue)}
    .notice{border:2px solid var(--red);background:#fff1f1;color:#8a0000;border-radius:10px;padding:14px 16px;font-weight:900;margin:0}
    .table-wrap{overflow-x:auto;border:1px solid var(--line);border-radius:10px}
    table{width:100%;border-collapse:collapse;background:#fff;table-layout:auto}
    th,td{border:1px solid var(--line);padding:10px 11px;vertical-align:top;overflow-wrap:anywhere}
    th{background:#e7f2fb;color:#06395f;text-align:left;font-weight:900}
    .id{font-weight:900;color:var(--navy);white-space:nowrap}
    .ok{color:var(--green);font-weight:900}.warn{color:var(--amber);font-weight:900}.bad{color:var(--red);font-weight:900}
    .links{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:10px}
    .links a{display:block;text-decoration:none;background:#0b67a3;color:#fff;border-radius:9px;padding:12px 14px;font-weight:900;text-align:center}
    @media(max-width:900px){main{padding:12px}.cards,.links{grid-template-columns:1fr}body{font-size:16px}}
    @media print{body{background:#fff}header,section{break-inside:avoid;box-shadow:none}.table-wrap{overflow:visible}th,td{font-size:11px;padding:6px 7px}}
  </style>
</head>
<body>
<header>
  <h1>6月イベント結果入力台帳</h1>
  <p>日銀・FOMC・指数反応・候補銘柄反応・本人別NISA確認を、出所付きで入力するための台帳です。</p>
</header>
<main>
  <section>
    <h2>現在の状態</h2>
    <div class="cards">
      <div class="card"><b>確認済</b><strong>${complete}/${rows.length}</strong></div>
      <div class="card"><b>注意・部分確認</b><strong>${caution}</strong></div>
      <div class="card"><b>未入力</b><strong>${missing}</strong></div>
      <div class="card"><b>買付上限</b><strong>0円</strong></div>
    </div>
  </section>
  <section>
    <p class="notice">未入力・出所未確認・反映先未確認の項目は、購入判断に使いません。全チケットの結果値、出所、取得日時、反映状況が揃うまで、P1復帰0社・買付上限0円を維持します。</p>
  </section>
  <section>
    <h2>入力台帳</h2>
    <div class="table-wrap">
      <table>
        <thead><tr><th>ID</th><th>確認時期</th><th>イベント</th><th>状態</th><th>入力するもの</th><th>結果値</th><th>市場反応</th><th>出所URL</th><th>反映状況</th><th>次アクション</th></tr></thead>
        <tbody>${tableRows}</tbody>
      </table>
    </div>
  </section>
  <section>
    <h2>関連画面</h2>
    <div class="links">
      <a href="june_event_input_tickets_20260615.html">入力チケット</a>
      <a href="june_event_ticket_validator_20260615.html">入力検証</a>
      <a href="june_event_operation_calendar_20260615.html">運用カレンダー</a>
      <a href="event_post_reaction_workbench_20260615.html">反応判定</a>
    </div>
  </section>
</main>
</body>
</html>`;

fs.writeFileSync(htmlFile, html, 'utf8');

console.log(JSON.stringify({
  htmlFile,
  entryCsv,
  rows: rows.length,
  complete,
  caution,
  missing,
  generatedAt,
}, null, 2));
