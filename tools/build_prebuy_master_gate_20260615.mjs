import fs from 'node:fs';

const files = {
  eventValidator: 'june_event_ticket_validator_20260615.csv',
  reflectionPreview: 'june_event_reflection_preview_20260615.csv',
  p1Summary: 'p1_segment_next_gate_input_validator_summary_20260615.csv',
  accountGate: 'nisa_account_execution_gate_20260614.csv',
  legacySummary: 'integrated_purchase_decision_summary_20260614.csv',
};

const csvFile = 'prebuy_master_gate_20260615.csv';
const htmlFile = 'prebuy_master_gate_20260615.html';
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

function readCsv(file) {
  if (!fs.existsSync(file)) return [];
  return parseCsv(fs.readFileSync(file, 'utf8'));
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

function count(rows, field, value) {
  return rows.filter((row) => row[field] === value).length;
}

const eventRows = readCsv(files.eventValidator);
const reflectionRows = readCsv(files.reflectionPreview);
const p1Rows = readCsv(files.p1Summary);
const accountRows = readCsv(files.accountGate);
const legacyRows = readCsv(files.legacySummary);

const eventDone = count(eventRows, '判定', '完了');
const eventWarn = count(eventRows, '判定', '注意');
const eventStop = count(eventRows, '判定', '停止候補');
const eventMissing = count(eventRows, '判定', '未完了');

const reflectionOk = count(reflectionRows, '反映判定', '反映可能');
const reflectionBlock = count(reflectionRows, '反映判定', '反映禁止');
const reflectionHold = count(reflectionRows, '反映判定', '反映保留');
const reflectionStop = count(reflectionRows, '反映判定', '反映停止');

const p1Input = p1Rows.find((row) => row.項目 === '入力項目通過') ?? {};
const p1Gate = p1Rows.find((row) => row.項目 === 'ゲート通過') ?? {};
const p1Score = p1Rows.find((row) => row.項目 === 'スコア反映') ?? {};
const p1Buy = p1Rows.find((row) => row.項目 === 'P1復帰/買付') ?? {};

const accountReady = accountRows.filter((row) => row.account_ready === '購入可').length;
const accountLocked = accountRows.length - accountReady;
const accountUpperSum = accountRows.reduce((sum, row) => {
  const value = String(row.account_buy_upper_yen ?? '').replace(/[^\d.-]/g, '');
  return sum + (Number.isFinite(Number(value)) ? Number(value) : 0);
}, 0);

const gates = [
  {
    gate: '6月イベント入力',
    status: eventDone === eventRows.length && eventWarn === 0 && eventStop === 0 && eventRows.length > 0 ? '通過' : '未通過',
    value: `${eventDone}/${eventRows.length}完了、未完了${eventMissing}、注意${eventWarn}、停止候補${eventStop}`,
    blocker: eventMissing > 0 ? '日銀、FOMC、指数反応、個別反応、本人別確認のいずれかが未完了' : eventWarn + eventStop > 0 ? '注意または停止候補あり' : 'なし',
    next: '結果入力台帳に公式結果、出所、取得日時、反映状況を入れる',
    source: files.eventValidator,
  },
  {
    gate: '6月イベント反映',
    status: reflectionOk === reflectionRows.length && reflectionRows.length > 0 ? '通過' : '未通過',
    value: `${reflectionOk}/${reflectionRows.length}反映可能、反映禁止${reflectionBlock}、保留${reflectionHold}、停止${reflectionStop}`,
    blocker: reflectionBlock > 0 ? '未入力または根拠不足のため、P1や買付判定へ反映できない行がある' : reflectionHold + reflectionStop > 0 ? '保留または停止候補あり' : 'なし',
    next: '反映可能になった行だけ対象ゲートへ転記し、検証画面で再判定する',
    source: files.reflectionPreview,
  },
  {
    gate: 'P1入力・銘柄ゲート',
    status: p1Buy.判定 === '不可' || p1Score.判定 === '禁止' ? '未通過' : '通過',
    value: `${p1Input.値 || '不明'} / ${p1Gate.値 || '不明'} / ${p1Buy.値 || '不明'}`,
    blocker: p1Buy.説明 || 'P1復帰条件が未確定',
    next: 'イベント後の指数反応と個別反応を入れて、P1復帰可否を再判定する',
    source: files.p1Summary,
  },
  {
    gate: 'NISA口座・本人操作',
    status: accountReady === accountRows.length && accountRows.length > 0 ? '通過' : '未通過',
    value: `${accountReady}/${accountRows.length}口座確認済、合計買付上限${accountUpperSum.toLocaleString('ja-JP')}円`,
    blocker: accountLocked > 0 ? '本人名、証券会社、NISA口座、本人スマホ、本人銀行口座、二段階認証、NISA残枠が未確認' : 'なし',
    next: '本人別に口座情報を入力し、注文画面のNISA区分を確認する',
    source: files.accountGate,
  },
];

const allPass = gates.every((row) => row.status === '通過');
const finalDecision = allPass ? '次ゲートで資金配分を判定' : '購入判断不可';
const finalBuyLimit = allPass ? '資金配分ゲートで別途判定' : '0円';
const primaryBlockers = gates.filter((row) => row.status !== '通過');

writeCsv(csvFile, [
  ['作成時刻', '総合判定', '買付上限', 'ゲート', '状態', '数値', '止まっている理由', '次アクション', '参照元'],
  ...gates.map((row) => [
    generatedAt,
    finalDecision,
    finalBuyLimit,
    row.gate,
    row.status,
    row.value,
    row.blocker,
    row.next,
    row.source,
  ]),
]);

const gateRows = gates.map((row) => `<tr>
  <td>${h(row.gate)}</td>
  <td class="${row.status === '通過' ? 'ok' : 'bad'}">${h(row.status)}</td>
  <td>${h(row.value)}</td>
  <td>${h(row.blocker)}</td>
  <td>${h(row.next)}</td>
  <td>${h(row.source)}</td>
</tr>`).join('');

const blockerRows = primaryBlockers.map((row, index) => `<tr>
  <td>${index + 1}</td>
  <td>${h(row.gate)}</td>
  <td>${h(row.blocker)}</td>
  <td>${h(row.next)}</td>
</tr>`).join('');

const legacyText = legacyRows.map((row) => `${row.項目}: ${row.状態 || row.数値 || ''}`).join(' / ');

const html = `<!doctype html>
<html lang="ja">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>購入前 統合ゲート</title>
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
    .card strong{display:block;font-size:28px;line-height:1.25;color:var(--blue)}
    .notice{border:2px solid var(--red);background:#fff1f1;color:#8a0000;border-radius:10px;padding:14px 16px;font-weight:900;margin:0}
    .table-wrap{overflow-x:auto;border:1px solid var(--line);border-radius:10px}
    table{width:100%;border-collapse:collapse;background:#fff;table-layout:auto}
    th,td{border:1px solid var(--line);padding:10px 11px;vertical-align:top;overflow-wrap:anywhere}
    th{background:#e7f2fb;color:#06395f;text-align:left;font-weight:900}
    .ok{color:var(--green);font-weight:900}.warn{color:var(--amber);font-weight:900}.bad{color:var(--red);font-weight:900}
    .links{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:10px}
    .links a{display:block;text-decoration:none;background:#0b67a3;color:#fff;border-radius:9px;padding:12px 14px;font-weight:900;text-align:center}
    @media(max-width:900px){main{padding:12px}.cards,.links{grid-template-columns:1fr}body{font-size:16px}}
    @media print{body{background:#fff}header,section{break-inside:avoid;box-shadow:none}.table-wrap{overflow:visible}th,td{font-size:11px;padding:6px 7px}}
  </style>
</head>
<body>
<header>
  <h1>購入前 統合ゲート</h1>
  <p>イベント、P1銘柄ゲート、NISA口座・本人操作をまとめて確認し、購入判断へ進めるかを判定します。</p>
</header>
<main>
  <section>
    <h2>総合判定</h2>
    <div class="cards">
      <div class="card"><b>現在の結論</b><strong class="bad">${h(finalDecision)}</strong></div>
      <div class="card"><b>買付上限</b><strong>${h(finalBuyLimit)}</strong></div>
      <div class="card"><b>未通過ゲート</b><strong>${primaryBlockers.length}/${gates.length}</strong></div>
      <div class="card"><b>口座確認</b><strong>${accountReady}/${accountRows.length}</strong></div>
    </div>
  </section>
  <section>
    <p class="notice">この画面で全ゲートが通過するまで、P1復帰、買付金額、注文票には進みません。現在はイベント入力・反映、P1復帰、NISA本人操作確認が未完了のため、買付上限0円です。</p>
  </section>
  <section>
    <h2>止まっている理由</h2>
    <div class="table-wrap">
      <table>
        <thead><tr><th>No.</th><th>ゲート</th><th>理由</th><th>次アクション</th></tr></thead>
        <tbody>${blockerRows || '<tr><td colspan="4">未通過ゲートはありません。</td></tr>'}</tbody>
      </table>
    </div>
  </section>
  <section>
    <h2>ゲート別詳細</h2>
    <div class="table-wrap">
      <table>
        <thead><tr><th>ゲート</th><th>状態</th><th>数値</th><th>止まっている理由</th><th>次アクション</th><th>参照元</th></tr></thead>
        <tbody>${gateRows}</tbody>
      </table>
    </div>
  </section>
  <section>
    <h2>関連画面</h2>
    <div class="links">
      <a href="june_event_result_entry_20260615.html">結果入力台帳</a>
      <a href="june_event_ticket_validator_20260615.html">イベント入力検証</a>
      <a href="june_event_reflection_preview_20260615.html">反映プレビュー</a>
      <a href="p1_segment_next_gate_input_validator_20260615.html">P1入力検証</a>
      <a href="nisa_account_execution_gate_20260614.html">NISA口座ゲート</a>
      <a href="june_event_operation_calendar_20260615.html">6月運用表</a>
      <a href="event_post_reaction_workbench_20260615.html">反応判定</a>
      <a href="index.html">ホーム</a>
    </div>
  </section>
  <section>
    <h2>既存サマリーとの整合</h2>
    <p>${h(legacyText || '既存サマリーは未取得です。')}</p>
  </section>
</main>
</body>
</html>`;

fs.writeFileSync(htmlFile, html, 'utf8');

console.log(JSON.stringify({
  htmlFile,
  csvFile,
  finalDecision,
  finalBuyLimit,
  blockedGates: primaryBlockers.length,
  gates: gates.length,
  accountReady,
  accountRows: accountRows.length,
  generatedAt,
}, null, 2));
