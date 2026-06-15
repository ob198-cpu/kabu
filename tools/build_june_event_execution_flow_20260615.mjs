import fs from 'node:fs';

const outHtml = 'june_event_execution_flow_20260615.html';
const outCsv = 'june_event_execution_flow_20260615.csv';
const validatorCsv = 'june_event_ticket_validator_20260615.csv';
const prebuyCsv = 'prebuy_master_gate_20260615.csv';
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

const validatorRows = fs.existsSync(validatorCsv) ? parseCsv(fs.readFileSync(validatorCsv, 'utf8')) : [];
const prebuyRows = fs.existsSync(prebuyCsv) ? parseCsv(fs.readFileSync(prebuyCsv, 'utf8')) : [];
const completedTickets = validatorRows.filter((row) => row.判定 === '完了').length;
const totalTickets = validatorRows.length || 5;
const incompleteTickets = totalTickets - completedTickets;
const prebuyDecision = prebuyRows.find((row) => row.区分 === '総合判定')?.内容 || '購入判断不可';
const buyLimit = prebuyRows.find((row) => row.区分 === '買付上限')?.内容 || '0円';

const steps = [
  {
    step: '1',
    name: '公式ソースを確認',
    page: 'june_event_source_checklist_20260615.html',
    purpose: '日銀、FRB、指数、候補銘柄、口座確認について、どの出所を見るかを確認する。',
    output: '公式結果、出所URL、取得日時',
    status: incompleteTickets > 0 ? '待機中' : '確認済',
    stop: '公式結果が未公表、または出所URLを残せない場合は次へ進めない。',
  },
  {
    step: '2',
    name: '結果をフォーム入力',
    page: 'june_event_manual_input_form_20260615.html',
    purpose: '公式結果と市場反応を入力し、反映用CSVを作成する。',
    output: 'june_event_result_entry_20260615_filled.csv',
    status: incompleteTickets > 0 ? '未完了' : '確認済',
    stop: '確認済にする行は、結果値、市場反応、出所URL、取得日時、反映先が必須。',
  },
  {
    step: '3',
    name: 'CSVを検証して反映',
    page: 'june_event_manual_input_apply_helper_20260615.html',
    purpose: 'フォームで出したCSVを検証し、問題があるデータを正本へ混ぜない。',
    output: '結果入力台帳、入力検証、反映プレビュー、購入前ゲートの再生成',
    status: incompleteTickets > 0 ? '準備完了' : '反映確認',
    stop: '列名、ID、確認済み時の必須項目、反映状況に不備があれば反映しない。',
  },
  {
    step: '4',
    name: '購入前ゲートを見る',
    page: 'prebuy_master_gate_20260615.html',
    purpose: 'イベント、P1候補、NISA口座、本人操作を統合して、買付へ進めるかを見る。',
    output: '購入判断、買付上限、未通過ゲート',
    status: prebuyDecision,
    stop: '未通過ゲートが残る場合、買付上限は0円のままにする。',
  },
];

writeCsv(outCsv, ['作成時刻', '順番', '作業', 'ページ', '目的', '出力', '状態', '停止条件'], steps.map((row) => ({
  作成時刻: generatedAt,
  順番: row.step,
  作業: row.name,
  ページ: row.page,
  目的: row.purpose,
  出力: row.output,
  状態: row.status,
  停止条件: row.stop,
})));

const stepHtml = steps.map((row) => `<article class="step-card">
  <div class="num">${h(row.step)}</div>
  <h3>${h(row.name)}</h3>
  <p>${h(row.purpose)}</p>
  <dl>
    <dt>見るページ</dt><dd><a href="${h(row.page)}">${h(row.page)}</a></dd>
    <dt>出力</dt><dd>${h(row.output)}</dd>
    <dt>状態</dt><dd class="${row.status.includes('不可') || row.status === '未完了' ? 'bad' : row.status.includes('待機') ? 'warn' : 'ok'}">${h(row.status)}</dd>
    <dt>止める条件</dt><dd>${h(row.stop)}</dd>
  </dl>
</article>`).join('');

const html = `<!doctype html>
<html lang="ja">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>6月イベント 実務フロー</title>
  <style>
    :root{--ink:#061827;--navy:#103b60;--blue:#0b67a3;--line:#c9dceb;--bg:#f4f8fb;--paper:#fff;--red:#b42318;--green:#116b4f;--amber:#9a5b00}
    *{box-sizing:border-box}
    body{margin:0;background:var(--bg);color:var(--ink);font-family:-apple-system,BlinkMacSystemFont,"Segoe UI","Noto Sans JP",Meiryo,sans-serif;font-size:19px;line-height:1.75}
    header{background:linear-gradient(135deg,#103b60,#0b67a3);color:#fff;padding:32px}
    header h1{margin:0 0 8px;font-size:clamp(34px,4vw,48px);line-height:1.18;letter-spacing:0}
    header p{margin:0;font-weight:900;max-width:1180px}
    main{max-width:1240px;margin:0 auto;padding:22px}
    section{background:var(--paper);border:1px solid var(--line);border-radius:12px;padding:20px;margin:0 0 18px;box-shadow:0 8px 20px rgba(20,60,90,.08);break-inside:avoid}
    h2{margin:0 0 12px;border-left:8px solid var(--blue);padding-left:12px;color:var(--navy);font-size:27px}
    .summary{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:12px}
    .box{border:1px solid var(--line);border-radius:10px;background:#fbfdff;padding:14px}
    .box b{display:block;color:var(--navy);font-size:16px}.box strong{display:block;font-size:30px;color:var(--blue);line-height:1.25}
    .notice{border:2px solid var(--red);background:#fff1f1;color:#8a0000;border-radius:10px;padding:14px 16px;font-weight:900;margin:0}
    .steps{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:14px}
    .step-card{border:1px solid var(--line);border-radius:12px;background:#fff;padding:16px;position:relative}
    .num{width:42px;height:42px;border-radius:50%;background:var(--blue);color:#fff;font-weight:900;display:grid;place-items:center;font-size:22px}
    h3{margin:10px 0 6px;color:var(--navy);font-size:24px}
    p{margin:0 0 10px}
    dl{display:grid;grid-template-columns:120px 1fr;gap:7px 10px;margin:0}
    dt{font-weight:900;color:#123a5a}dd{margin:0;overflow-wrap:anywhere}
    a{color:#075c94;font-weight:900}
    .ok{color:var(--green);font-weight:900}.warn{color:var(--amber);font-weight:900}.bad{color:var(--red);font-weight:900}
    @media(max-width:900px){main{padding:12px}.summary,.steps{grid-template-columns:1fr}body{font-size:17px}dl{grid-template-columns:1fr}}
    @media print{body{background:#fff}section,.step-card{break-inside:avoid;box-shadow:none}}
  </style>
</head>
<body>
<header>
  <h1>6月イベント 実務フロー</h1>
  <p>6月のCPI・日銀・FOMC・指数反応・候補銘柄反応を、どの順番で確認し、どこで止めるかを一本化した入口です。</p>
</header>
<main>
  <section>
    <h2>現在の扱い</h2>
    <div class="summary">
      <div class="box"><b>入力完了</b><strong>${h(completedTickets)}/${h(totalTickets)}</strong></div>
      <div class="box"><b>未完了</b><strong>${h(incompleteTickets)}</strong></div>
      <div class="box"><b>総合判定</b><strong>${h(prebuyDecision)}</strong></div>
      <div class="box"><b>買付上限</b><strong>${h(buyLimit)}</strong></div>
    </div>
  </section>
  <section>
    <p class="notice">公式結果と市場反応が出所付きで揃うまでは、候補銘柄の買付判断には進めません。現時点で未完了ゲートがある場合、買付上限は0円です。</p>
  </section>
  <section>
    <h2>見る順番</h2>
    <div class="steps">${stepHtml}</div>
  </section>
</main>
</body>
</html>`;

fs.writeFileSync(outHtml, html, 'utf8');

console.log(JSON.stringify({
  outHtml,
  outCsv,
  completedTickets,
  totalTickets,
  prebuyDecision,
  buyLimit,
}, null, 2));
