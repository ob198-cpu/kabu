import fs from 'node:fs';

const ticketCsv = 'june_event_input_tickets_20260615.csv';
const htmlFile = 'june_event_ticket_validator_20260615.html';
const csvFile = 'june_event_ticket_validator_20260615.csv';
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

function normalizeStatus(status) {
  const text = String(status ?? '').trim();
  if (['完了', '確認済', '通過'].includes(text)) return '完了';
  if (['注意', '部分確認'].includes(text)) return '注意';
  return '未完了';
}

function nextAction(row) {
  const status = normalizeStatus(row['状態']);
  if (status === '完了') return '次のチケットへ進む';
  if (status === '注意') return '停止条件に触れていないか、反映先の数値を再確認する';
  return `${row['チケット']}の実データ、出所、取得日時、反映先を入力する`;
}

const tickets = parseCsv(fs.readFileSync(ticketCsv, 'utf8'));
const resultRows = tickets.map((row) => {
  const status = normalizeStatus(row['状態']);
  return {
    id: row['ID'],
    timing: row['確認時期'],
    title: row['チケット'],
    status,
    input: row['入力するもの'],
    complete: row['完了条件'],
    stop: row['停止条件'],
    reflect: row['反映先'],
    next: nextAction(row),
  };
});

const done = resultRows.filter((row) => row.status === '完了').length;
const warn = resultRows.filter((row) => row.status === '注意').length;
const missing = resultRows.filter((row) => row.status === '未完了').length;
const allDone = done === resultRows.length;
const buyDecision = allDone && warn === 0 ? '次ゲート確認へ進める' : '買付不可';
const buyLimit = allDone && warn === 0 ? '資金配分ゲートで別途判定' : '0円';

writeCsv(csvFile, [
  ['作成時刻', 'ID', '確認時期', 'チケット', '状態', '次の作業', '停止条件', '反映先'],
  ...resultRows.map((row) => [generatedAt, row.id, row.timing, row.title, row.status, row.next, row.stop, row.reflect]),
]);

const tableRows = resultRows.map((row) => `<tr>
  <td class="id">${h(row.id)}</td>
  <td>${h(row.timing)}</td>
  <td>${h(row.title)}</td>
  <td class="${row.status === '完了' ? 'ok' : row.status === '注意' ? 'warn' : 'bad'}">${h(row.status)}</td>
  <td>${h(row.next)}</td>
  <td class="stop">${h(row.stop)}</td>
  <td>${h(row.reflect)}</td>
</tr>`).join('');

const html = `<!doctype html>
<html lang="ja">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>6月イベントチケット 検証画面</title>
  <style>
    :root{--ink:#061827;--navy:#103b60;--blue:#0b67a3;--line:#c9dceb;--bg:#f4f8fb;--paper:#fff;--red:#b42318;--green:#116b4f;--amber:#9a5b00}
    *{box-sizing:border-box}
    body{margin:0;background:var(--bg);color:var(--ink);font-family:-apple-system,BlinkMacSystemFont,"Segoe UI","Noto Sans JP",Meiryo,sans-serif;font-size:18px;line-height:1.75}
    header{background:linear-gradient(135deg,#103b60,#0b67a3);color:#fff;padding:30px}
    header h1{margin:0 0 8px;font-size:clamp(32px,4vw,44px);line-height:1.2;letter-spacing:0}
    header p{margin:0;font-weight:800;max-width:1180px}
    main{max-width:1280px;margin:0 auto;padding:22px}
    section{background:var(--paper);border:1px solid var(--line);border-radius:12px;padding:20px;margin:0 0 18px;box-shadow:0 8px 20px rgba(20,60,90,.08);break-inside:avoid}
    h2{margin:0 0 12px;border-left:8px solid var(--blue);padding-left:12px;color:var(--navy);font-size:27px}
    .cards{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:12px}
    .card{border:1px solid var(--line);border-radius:10px;background:#fbfdff;padding:14px}
    .card b{display:block;color:var(--navy);font-size:16px}
    .card strong{display:block;font-size:30px;line-height:1.25;color:var(--blue)}
    .card span{font-weight:800;color:#263e55}
    .notice{border:2px solid var(--red);background:#fff1f1;color:#8a0000;border-radius:10px;padding:14px 16px;font-weight:900;margin:0}
    .table-wrap{overflow-x:auto;border:1px solid var(--line);border-radius:10px;margin-top:10px}
    table{width:100%;border-collapse:collapse;background:#fff;table-layout:auto}
    th,td{border:1px solid var(--line);padding:10px 11px;vertical-align:top;overflow-wrap:anywhere;word-break:normal}
    th{background:#e7f2fb;color:#06395f;text-align:left;font-weight:900}
    .id{font-weight:900;color:var(--navy);white-space:nowrap}
    .ok{color:var(--green);font-weight:900}.warn{color:var(--amber);font-weight:900}.bad,.stop{color:var(--red);font-weight:900}
    .links{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:10px}
    .links a{display:block;text-decoration:none;background:#0b67a3;color:#fff;border-radius:9px;padding:12px 14px;font-weight:900;text-align:center}
    @media(max-width:900px){main{padding:12px}.cards,.links{grid-template-columns:1fr}body{font-size:16px}}
    @media print{body{background:#fff}header,section{break-inside:avoid;box-shadow:none}.table-wrap{overflow:visible}th,td{font-size:11px;padding:6px 7px}}
  </style>
</head>
<body>
<header>
  <h1>6月イベントチケット 検証画面</h1>
  <p>入力チケットの完了状況を確認し、買付判断へ進める状態かを判定します。</p>
</header>
<main>
  <section>
    <h2>現在の判定</h2>
    <div class="cards">
      <div class="card"><b>完了</b><strong>${done}/${resultRows.length}</strong><span>入力チケット</span></div>
      <div class="card"><b>注意</b><strong>${warn}</strong><span>再確認が必要な項目</span></div>
      <div class="card"><b>未完了</b><strong>${missing}</strong><span>未入力または未確認</span></div>
      <div class="card"><b>買付上限</b><strong>${h(buyLimit)}</strong><span>${h(buyDecision)}</span></div>
    </div>
  </section>
  <section>
    <p class="notice">未完了または注意が残る間は、候補復帰・買付金額・注文票に進みません。全チケットの実データ、出所、取得日時、反映先を揃えてから再判定します。</p>
  </section>
  <section>
    <h2>チケット別の次作業</h2>
    <div class="table-wrap">
      <table>
        <thead><tr><th>ID</th><th>確認時期</th><th>チケット</th><th>状態</th><th>次の作業</th><th>停止条件</th><th>反映先</th></tr></thead>
        <tbody>${tableRows}</tbody>
      </table>
    </div>
  </section>
  <section>
    <h2>関連画面</h2>
    <div class="links">
      <a href="june_event_input_tickets_20260615.html">入力チケット</a>
      <a href="june_event_operation_calendar_20260615.html">6月イベント運用表</a>
      <a href="event_post_reaction_workbench_20260615.html">イベント後反応ワークベンチ</a>
      <a href="p1_segment_next_gate_input_validator_20260615.html">P1入力バリデーター</a>
      <a href="nisa_account_execution_gate_20260614.html">NISA口座・本人操作ゲート</a>
      <a href="102_june_event_result_input.csv">6月イベント入力CSV</a>
    </div>
  </section>
</main>
</body>
</html>`;

fs.writeFileSync(htmlFile, html, 'utf8');

console.log(JSON.stringify({
  htmlFile,
  csvFile,
  tickets: resultRows.length,
  done,
  warn,
  missing,
  buyDecision,
  buyLimit,
  generatedAt,
}, null, 2));
