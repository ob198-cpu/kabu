import fs from 'node:fs';

const ticketCsv = 'june_event_input_tickets_20260615.csv';
const entryCsv = 'june_event_result_entry_20260615.csv';
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

function blank(value) {
  return String(value ?? '').trim() === '';
}

function validateEntry(ticket, entry) {
  if (!entry) {
    return {
      status: '未完了',
      missing: '結果入力台帳の行',
      next: `${ticket.チケット}の結果入力行を作成する`,
    };
  }

  const missing = [];
  for (const field of ['結果値', '市場反応', '出所URL', '取得日時', '反映先', '反映状況']) {
    if (blank(entry[field]) || entry[field] === '未反映') missing.push(field);
  }

  if (entry.入力ステータス === '停止候補') {
    return {
      status: '停止候補',
      missing: missing.join('、') || 'なし',
      next: '停止条件に触れていないか、出所と数値を再確認する',
    };
  }
  if (entry.入力ステータス === '注意' || entry.入力ステータス === '部分確認') {
    return {
      status: '注意',
      missing: missing.join('、') || 'なし',
      next: '注意理由を確認し、買付停止または比率引き下げに接続する',
    };
  }
  if (entry.入力ステータス === '確認済' && missing.length === 0) {
    return {
      status: '完了',
      missing: 'なし',
      next: '次ゲートで総合判定する',
    };
  }
  return {
    status: '未完了',
    missing: missing.join('、') || '入力ステータス',
    next: `${ticket.チケット}の結果値、出所、取得日時、反映状況を入力する`,
  };
}

const tickets = parseCsv(fs.readFileSync(ticketCsv, 'utf8'));
const entries = fs.existsSync(entryCsv) ? parseCsv(fs.readFileSync(entryCsv, 'utf8')) : [];
const entryById = new Map(entries.map((row) => [row.ID, row]));

const resultRows = tickets.map((ticket) => {
  const entry = entryById.get(ticket.ID);
  const validation = validateEntry(ticket, entry);
  return {
    id: ticket.ID,
    timing: ticket.確認時期,
    title: ticket.チケット,
    status: validation.status,
    missing: validation.missing,
    next: validation.next,
    input: ticket.入力するもの,
    stop: ticket.停止条件,
    reflect: entry?.反映先 || ticket.反映先,
    result: entry?.結果値 || '',
    reaction: entry?.市場反応 || '',
    source: entry?.出所URL || '',
    reflectedStatus: entry?.反映状況 || '未反映',
  };
});

const done = resultRows.filter((row) => row.status === '完了').length;
const warn = resultRows.filter((row) => row.status === '注意').length;
const stop = resultRows.filter((row) => row.status === '停止候補').length;
const missing = resultRows.filter((row) => row.status === '未完了').length;
const allDone = done === resultRows.length;
const canProceed = allDone && warn === 0 && stop === 0;
const buyDecision = canProceed ? '次ゲートで資金配分を判定' : '買付不可';
const buyLimit = canProceed ? '資金配分ゲートで別途判定' : '0円';

writeCsv(csvFile, [
  ['作成時刻', 'ID', '確認時期', 'チケット', '判定', '不足項目', '次アクション', '結果値', '市場反応', '出所URL', '反映状況', '停止条件', '反映先'],
  ...resultRows.map((row) => [
    generatedAt,
    row.id,
    row.timing,
    row.title,
    row.status,
    row.missing,
    row.next,
    row.result,
    row.reaction,
    row.source,
    row.reflectedStatus,
    row.stop,
    row.reflect,
  ]),
]);

const tableRows = resultRows.map((row) => `<tr>
  <td class="id">${h(row.id)}</td>
  <td>${h(row.timing)}</td>
  <td>${h(row.title)}</td>
  <td class="${row.status === '完了' ? 'ok' : row.status === '未完了' ? 'bad' : 'warn'}">${h(row.status)}</td>
  <td>${h(row.missing)}</td>
  <td>${h(row.next)}</td>
  <td>${h(row.result || '未入力')}</td>
  <td>${h(row.reaction || '未入力')}</td>
  <td>${row.source ? `<a href="${h(row.source)}">${h(row.source)}</a>` : '未入力'}</td>
  <td>${h(row.reflectedStatus)}</td>
</tr>`).join('');

const html = `<!doctype html>
<html lang="ja">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>6月イベント入力検証</title>
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
    .cards{display:grid;grid-template-columns:repeat(5,minmax(0,1fr));gap:12px}
    .card{border:1px solid var(--line);border-radius:10px;background:#fbfdff;padding:14px}
    .card b{display:block;color:var(--navy);font-size:16px}
    .card strong{display:block;font-size:28px;line-height:1.25;color:var(--blue)}
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
  <h1>6月イベント入力検証</h1>
  <p>イベント結果入力台帳を読み込み、買付判定へ進めるだけの根拠が揃っているかを確認します。</p>
</header>
<main>
  <section>
    <h2>現在の判定</h2>
    <div class="cards">
      <div class="card"><b>完了</b><strong>${done}/${resultRows.length}</strong></div>
      <div class="card"><b>注意</b><strong>${warn}</strong></div>
      <div class="card"><b>停止候補</b><strong>${stop}</strong></div>
      <div class="card"><b>未完了</b><strong>${missing}</strong></div>
      <div class="card"><b>買付上限</b><strong>${h(buyLimit)}</strong></div>
    </div>
  </section>
  <section>
    <p class="notice">判定: ${h(buyDecision)}。イベント結果、出所、取得日時、反映状況が揃わない項目がある間は、P1復帰・買付金額・注文票へ進めません。</p>
  </section>
  <section>
    <h2>チケット別検証</h2>
    <div class="table-wrap">
      <table>
        <thead><tr><th>ID</th><th>確認時期</th><th>チケット</th><th>判定</th><th>不足項目</th><th>次アクション</th><th>結果値</th><th>市場反応</th><th>出所URL</th><th>反映状況</th></tr></thead>
        <tbody>${tableRows}</tbody>
      </table>
    </div>
  </section>
  <section>
    <h2>関連画面</h2>
    <div class="links">
      <a href="june_event_result_entry_20260615.html">結果入力台帳</a>
      <a href="june_event_reflection_preview_20260615.html">反映プレビュー</a>
      <a href="june_event_input_tickets_20260615.html">入力チケット</a>
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
  csvFile,
  entryCsv,
  tickets: resultRows.length,
  done,
  warn,
  stop,
  missing,
  buyDecision,
  buyLimit,
  generatedAt,
}, null, 2));
