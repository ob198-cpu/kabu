import fs from 'node:fs';

const outHtml = 'today_action_20260616.html';
const outCsv = 'today_action_20260616.csv';
const ticketCsv = 'june_event_ticket_validator_20260615.csv';
const sourceCsv = 'june_event_source_checklist_20260615.csv';
const prebuyCsv = 'prebuy_master_gate_20260615.csv';
const today = '2026-06-16';
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

function writeCsv(file, headers, rows) {
  fs.writeFileSync(
    file,
    `\uFEFF${[headers, ...rows.map((row) => headers.map((header) => row[header] ?? ''))]
      .map((row) => row.map(csvCell).join(','))
      .join('\n')}\n`,
    'utf8',
  );
}

function h(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function statusForTiming(timing) {
  if (String(timing).includes('2026-06-16')) return '本日確認';
  if (String(timing).includes('2026-06-17')) return '翌日以降';
  if (String(timing).includes('2026-06-18')) return '6/18以降';
  if (String(timing).includes('購入前')) return '購入直前';
  return '確認日待ち';
}

const tickets = fs.existsSync(ticketCsv) ? parseCsv(fs.readFileSync(ticketCsv, 'utf8')) : [];
const sources = fs.existsSync(sourceCsv) ? parseCsv(fs.readFileSync(sourceCsv, 'utf8')) : [];
const prebuyRows = fs.existsSync(prebuyCsv) ? parseCsv(fs.readFileSync(prebuyCsv, 'utf8')) : [];
const sourceById = new Map(sources.map((row) => [row.ID, row]));
const prebuyDecision = prebuyRows.find((row) => row.ゲート === '6月イベント入力')?.総合判定 || '購入判断不可';
const buyLimit = prebuyRows.find((row) => row.ゲート === '6月イベント入力')?.買付上限 || '0円';

const rows = tickets.map((ticket) => {
  const source = sourceById.get(ticket.ID) ?? {};
  const actionStatus = statusForTiming(ticket.確認時期);
  let action = 'まだ入力しない。確認時期になってから公式結果と市場反応を記録する。';
  if (actionStatus === '本日確認') {
    action = '日銀の公式結果が公表されたら、政策内容、ドル円、日経平均、TOPIX代替ETFを同じ基準で確認する。';
  } else if (actionStatus === '購入直前') {
    action = '本人別のNISA口座、本人スマホ、本人ログイン、NISA区分、入金、注文画面を確認する。';
  }
  return {
    作成時刻: generatedAt,
    今日: today,
    ID: ticket.ID,
    確認時期: ticket.確認時期,
    イベント: ticket.チケット,
    本日の扱い: actionStatus,
    判定: ticket.判定,
    今日の作業: action,
    見るページ: actionStatus === '本日確認' ? 'june_event_source_checklist_20260615.html → june_event_manual_input_form_20260615.html' : 'june_event_execution_flow_20260615.html',
    公式URL: source.公式URL || '',
    市場データURL: source.市場データURL || '',
    入力する数値: source.入力する数値 || ticket.不足項目,
    停止条件: ticket.停止条件,
  };
});

writeCsv(outCsv, ['作成時刻', '今日', 'ID', '確認時期', 'イベント', '本日の扱い', '判定', '今日の作業', '見るページ', '公式URL', '市場データURL', '入力する数値', '停止条件'], rows);

const todayRows = rows.filter((row) => row.本日の扱い === '本日確認');
const waitingRows = rows.filter((row) => row.本日の扱い !== '本日確認');

function table(list) {
  return `<div class="table-wrap"><table>
    <thead><tr><th>ID</th><th>イベント</th><th>扱い</th><th>今日の作業</th><th>入力する数値</th><th>停止条件</th><th>見るページ</th></tr></thead>
    <tbody>${list.map((row) => `<tr>
      <td class="id">${h(row.ID)}</td>
      <td>${h(row.イベント)}</td>
      <td class="${row.本日の扱い === '本日確認' ? 'warn' : 'muted'}">${h(row.本日の扱い)}</td>
      <td>${h(row.今日の作業)}</td>
      <td>${h(row.入力する数値)}</td>
      <td>${h(row.停止条件)}</td>
      <td>${h(row.見るページ)}</td>
    </tr>`).join('')}</tbody>
  </table></div>`;
}

const html = `<!doctype html>
<html lang="ja">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>本日の確認事項 2026年6月16日</title>
  <style>
    :root{--ink:#061827;--navy:#103b60;--blue:#0b67a3;--line:#c9dceb;--bg:#f4f8fb;--paper:#fff;--red:#b42318;--green:#116b4f;--amber:#9a5b00}
    *{box-sizing:border-box}
    body{margin:0;background:var(--bg);color:var(--ink);font-family:-apple-system,BlinkMacSystemFont,"Segoe UI","Noto Sans JP",Meiryo,sans-serif;font-size:19px;line-height:1.75}
    header{background:linear-gradient(135deg,#103b60,#0b67a3);color:#fff;padding:32px}
    header h1{margin:0 0 8px;font-size:clamp(34px,4vw,48px);line-height:1.18;letter-spacing:0}
    header p{margin:0;font-weight:900;max-width:1180px}
    main{max-width:1320px;margin:0 auto;padding:22px}
    section{background:var(--paper);border:1px solid var(--line);border-radius:12px;padding:20px;margin:0 0 18px;box-shadow:0 8px 20px rgba(20,60,90,.08);break-inside:avoid}
    h2{margin:0 0 12px;border-left:8px solid var(--blue);padding-left:12px;color:var(--navy);font-size:27px}
    .cards{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:12px}
    .card{border:1px solid var(--line);border-radius:10px;background:#fbfdff;padding:14px}
    .card b{display:block;color:var(--navy);font-size:16px}.card strong{display:block;font-size:30px;color:var(--blue);line-height:1.25}
    .notice{border:2px solid var(--red);background:#fff1f1;color:#8a0000;border-radius:10px;padding:14px 16px;font-weight:900;margin:0}
    .table-wrap{overflow-x:auto;border:1px solid var(--line);border-radius:10px}
    table{width:100%;border-collapse:collapse;background:#fff;table-layout:auto}
    th,td{border:1px solid var(--line);padding:10px 11px;vertical-align:top;overflow-wrap:anywhere}
    th{background:#e7f2fb;color:#06395f;text-align:left;font-weight:900}
    .id{font-weight:900;color:var(--navy);white-space:nowrap}
    .warn{color:var(--amber);font-weight:900}.bad{color:var(--red);font-weight:900}.muted{color:#52677a;font-weight:900}
    a{color:#075c94;font-weight:900}
    @media(max-width:900px){main{padding:12px}.cards{grid-template-columns:1fr}body{font-size:17px}}
    @media print{body{background:#fff}section{break-inside:avoid;box-shadow:none}.table-wrap{overflow:visible}th,td{font-size:11px;padding:6px 7px}}
  </style>
</head>
<body>
<header>
  <h1>本日の確認事項 2026年6月16日</h1>
  <p>6月イベント対応のうち、今日見るものと、まだ触らないものを分けた実務用画面です。</p>
</header>
<main>
  <section>
    <h2>現在の扱い</h2>
    <div class="cards">
      <div class="card"><b>本日確認</b><strong>${h(todayRows.length)}</strong></div>
      <div class="card"><b>待機・購入前</b><strong>${h(waitingRows.length)}</strong></div>
      <div class="card"><b>総合判定</b><strong>${h(prebuyDecision)}</strong></div>
      <div class="card"><b>買付上限</b><strong>${h(buyLimit)}</strong></div>
    </div>
  </section>
  <section>
    <p class="notice">今日の作業は日銀会合結果の公式確認と、確認後の市場反応入力です。FOMC、指数総合反応、候補銘柄個別反応、本人別NISA確認が揃うまでは、購入判断には進めません。</p>
  </section>
  <section>
    <h2>今日確認する項目</h2>
    ${table(todayRows)}
  </section>
  <section>
    <h2>今日はまだ買付判断に使わない項目</h2>
    ${table(waitingRows)}
  </section>
</main>
</body>
</html>`;

fs.writeFileSync(outHtml, html, 'utf8');

console.log(JSON.stringify({
  outHtml,
  outCsv,
  todayRows: todayRows.length,
  waitingRows: waitingRows.length,
  prebuyDecision,
  buyLimit,
}, null, 2));
