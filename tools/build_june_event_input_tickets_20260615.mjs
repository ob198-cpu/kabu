import fs from 'node:fs';

const htmlFile = 'june_event_input_tickets_20260615.html';
const csvFile = 'june_event_input_tickets_20260615.csv';
const generatedAt = new Date().toLocaleString('ja-JP', {
  timeZone: 'Asia/Tokyo',
  hour12: false,
});

const tickets = [
  {
    id: 'T01',
    timing: '2026-06-16以降',
    title: '日銀会合結果',
    input: '政策変更、国債買入方針、声明文、ドル円、日経平均、TOPIX代替ETF',
    source: '日銀公表資料、為替、指数データ',
    complete: '政策内容と市場反応を同じ基準日で記録する',
    pass: '急な円高ショックと日本株急落が同時に出ない',
    fail: 'ドル円-3.5%以上、日経/TOPIX代替ETF-5%以上なら買付停止候補',
    reflect: '102_june_event_result_input.csv / event_post_reaction_workbench_20260615.csv',
    status: '未入力',
  },
  {
    id: 'T02',
    timing: '2026-06-17以降',
    title: 'FOMC結果',
    input: '政策金利見通し、ドットプロット、議長会見、米10年金利、NASDAQ、SOX、VIX',
    source: 'FRB公表資料、米金利、米国指数データ',
    complete: 'FOMC後の金利・指数・VIXをイベント前基準値と比較する',
    pass: '米長期金利が急騰せず、NASDAQ/SOXが大崩れしない',
    fail: '米10年金利+25bp以上、NASDAQ/SOX-5%以上、VIX+35%以上なら買付停止候補',
    reflect: '102_june_event_result_input.csv / event_post_reaction_workbench_20260615.csv',
    status: '未入力',
  },
  {
    id: 'T03',
    timing: '2026-06-18以降',
    title: '指数の総合反応',
    input: '日経平均、TOPIX代替ETF、S&P500、NASDAQ、SOX、VIXのイベント前後変化',
    source: 'Yahoo Finance chart API等の時系列データ',
    complete: 'イベント前基準値との差分を%またはbpで記録する',
    pass: '地合いが崩れておらず、個別株比率を上げても説明できる',
    fail: '指数が弱い場合は個別株比率を下げ、現金比率を上げる',
    reflect: 'p1_event_gate_remaining_20260615.csv / p1_segment_next_gate_input_queue_20260615.csv',
    status: '未入力',
  },
  {
    id: 'T04',
    timing: '2026-06-18以降',
    title: '候補銘柄の個別反応',
    input: '6503.T、8035.Tの1日反応、5日反応、指数との差、出来高変化',
    source: '株価時系列、出来高、日経平均/TOPIX/SOXとの比較',
    complete: '候補銘柄が指数に対して強いか弱いかを記録する',
    pass: '個別株が指数に明確に劣後せず、停止条件に触れない',
    fail: '候補銘柄-7%以上、または指数に明確に劣後した場合はP1復帰見送り',
    reflect: 'p1_segment_next_gate_input_queue_20260615.csv / p1_segment_next_gate_input_validator_20260615.csv',
    status: '未入力',
  },
  {
    id: 'T05',
    timing: '購入前',
    title: '本人別NISA・注文前確認',
    input: '本人スマホ、本人ログイン、NISA口座区分、NISA残枠、入金、注文画面',
    source: '証券会社画面、本人確認、口座別チェック表',
    complete: '本人ごとに注文前チェックが完了している',
    pass: '本人操作、NISA区分、金額、注文銘柄が確認済み',
    fail: '本人操作未確認、NISA口座区分不明、証券会社画面未確認なら買付上限0円',
    reflect: 'nisa_account_execution_gate_20260614.html / 購入前チェック',
    status: '未入力',
  },
];

function h(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function csvCell(value) {
  const text = String(value ?? '');
  return /[",\n\r]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

function writeCsv(file, data) {
  fs.writeFileSync(file, `\uFEFF${data.map((row) => row.map(csvCell).join(',')).join('\n')}\n`, 'utf8');
}

writeCsv(csvFile, [
  ['作成時刻', 'ID', '確認時期', 'チケット', '入力するもの', '取得元', '完了条件', '通過条件', '停止条件', '反映先', '状態'],
  ...tickets.map((ticket) => [
    generatedAt,
    ticket.id,
    ticket.timing,
    ticket.title,
    ticket.input,
    ticket.source,
    ticket.complete,
    ticket.pass,
    ticket.fail,
    ticket.reflect,
    ticket.status,
  ]),
]);

const rows = tickets.map((ticket) => `<tr>
  <td class="id">${h(ticket.id)}</td>
  <td class="date">${h(ticket.timing)}</td>
  <td>${h(ticket.title)}</td>
  <td>${h(ticket.input)}</td>
  <td>${h(ticket.complete)}</td>
  <td>${h(ticket.pass)}</td>
  <td class="stop">${h(ticket.fail)}</td>
  <td>${h(ticket.reflect)}</td>
  <td class="bad">${h(ticket.status)}</td>
</tr>`).join('');

const html = `<!doctype html>
<html lang="ja">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>6月イベント後 入力チケット</title>
  <style>
    :root{--ink:#061827;--navy:#103b60;--blue:#0b67a3;--line:#c9dceb;--bg:#f4f8fb;--paper:#fff;--red:#b42318;--green:#116b4f;--amber:#9a5b00}
    *{box-sizing:border-box}
    body{margin:0;background:var(--bg);color:var(--ink);font-family:-apple-system,BlinkMacSystemFont,"Segoe UI","Noto Sans JP",Meiryo,sans-serif;font-size:18px;line-height:1.75}
    header{background:linear-gradient(135deg,#103b60,#0b67a3);color:#fff;padding:30px}
    header h1{margin:0 0 8px;font-size:clamp(32px,4vw,44px);line-height:1.2;letter-spacing:0}
    header p{margin:0;font-weight:800;max-width:1180px}
    main{max-width:1380px;margin:0 auto;padding:22px}
    section{background:var(--paper);border:1px solid var(--line);border-radius:12px;padding:20px;margin:0 0 18px;box-shadow:0 8px 20px rgba(20,60,90,.08);break-inside:avoid}
    h2{margin:0 0 12px;border-left:8px solid var(--blue);padding-left:12px;color:var(--navy);font-size:27px}
    .notice{border:2px solid var(--red);background:#fff1f1;color:#8a0000;border-radius:10px;padding:14px 16px;font-weight:900;margin:0}
    .table-wrap{overflow-x:auto;border:1px solid var(--line);border-radius:10px;margin-top:10px}
    table{width:100%;border-collapse:collapse;background:#fff;table-layout:auto}
    th,td{border:1px solid var(--line);padding:10px 11px;vertical-align:top;overflow-wrap:anywhere;word-break:normal}
    th{background:#e7f2fb;color:#06395f;text-align:left;font-weight:900}
    .id,.date{font-weight:900;color:var(--navy);white-space:nowrap}
    .bad,.stop{color:var(--red);font-weight:900}
    .links{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:10px}
    .links a{display:block;text-decoration:none;background:#0b67a3;color:#fff;border-radius:9px;padding:12px 14px;font-weight:900;text-align:center}
    @media(max-width:900px){main{padding:12px}.links{grid-template-columns:1fr}body{font-size:16px}}
    @media print{body{background:#fff}header,section{break-inside:avoid;box-shadow:none}.table-wrap{overflow:visible}th,td{font-size:11px;padding:6px 7px}}
  </style>
</head>
<body>
<header>
  <h1>6月イベント後 入力チケット</h1>
  <p>日銀・FOMC後に、どのデータを入れれば次の判定へ進めるかを固定した入力表です。</p>
</header>
<main>
  <section>
    <p class="notice">全チケットが未入力です。発表後の実データ、出所、取得日時を確認するまで、P1復帰0社・買付上限0円を維持します。</p>
  </section>
  <section>
    <h2>入力チケット</h2>
    <div class="table-wrap">
      <table>
        <thead><tr><th>ID</th><th>時期</th><th>チケット</th><th>入力するもの</th><th>完了条件</th><th>通過条件</th><th>停止条件</th><th>反映先</th><th>状態</th></tr></thead>
        <tbody>${rows}</tbody>
      </table>
    </div>
  </section>
  <section>
    <h2>関連画面</h2>
    <div class="links">
      <a href="june_event_operation_calendar_20260615.html">6月イベント運用表</a>
      <a href="event_post_reaction_workbench_20260615.html">イベント後反応ワークベンチ</a>
      <a href="p1_segment_next_gate_input_validator_20260615.html">P1入力バリデーター</a>
      <a href="102_june_event_result_input.csv">6月イベント入力CSV</a>
      <a href="event_pre_baseline_20260615.html">イベント前基準値</a>
      <a href="nisa_account_execution_gate_20260614.html">NISA口座・本人操作ゲート</a>
    </div>
  </section>
</main>
</body>
</html>`;

fs.writeFileSync(htmlFile, html, 'utf8');

console.log(JSON.stringify({
  htmlFile,
  csvFile,
  tickets: tickets.length,
  generatedAt,
  buyLimit: '0円',
}, null, 2));
