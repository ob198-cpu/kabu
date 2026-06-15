import fs from 'node:fs';

const htmlFile = 'june_event_operation_calendar_20260615.html';
const csvFile = 'june_event_operation_calendar_20260615.csv';
const generatedAt = new Date().toLocaleString('ja-JP', {
  timeZone: 'Asia/Tokyo',
  hour12: false,
});

const rows = [
  {
    date: '2026-06-15',
    step: 'イベント前基準値を固定',
    status: '完了',
    input: '日経平均、TOPIX代替ETF、ドル円、6503.T、8035.T、米10年金利、NASDAQ、SOX、VIX',
    decision: '買付判断には使わない。イベント後の比較基準にする。',
    stop: 'なし。基準値の記録だけ。',
    link: 'event_pre_baseline_20260615.html',
  },
  {
    date: '2026-06-16以降',
    step: '日銀会合後の反応確認',
    status: '未入力',
    input: '政策変更、ドル円、日経平均、TOPIX代替ETF、6503.T、8035.Tの反応',
    decision: '円高ショックと日本株急落がないかを見る。',
    stop: 'ドル円-3.5%以上の円高、または日経/TOPIX代替ETF-5%以上なら買付停止候補。',
    link: 'event_post_reaction_workbench_20260615.html',
  },
  {
    date: '2026-06-17以降',
    step: 'FOMC後の反応確認',
    status: '未入力',
    input: '米10年金利、NASDAQ、SOX、VIX、ドル円、候補銘柄の反応',
    decision: '米長期金利急騰と半導体指数急落がないかを見る。',
    stop: '米10年金利+25bp以上、NASDAQ/SOX-5%以上、VIX+35%以上なら買付停止候補。',
    link: 'event_post_reaction_workbench_20260615.html',
  },
  {
    date: '2026-06-18以降',
    step: '指数・個別株のイベント後反応を再判定',
    status: '未入力',
    input: 'イベント前基準値からの変化率、候補銘柄の1日/5日反応、指数との差',
    decision: 'P1復帰可否を判定する。ただし復帰しても即購入ではなく、資金配分ゲートへ進む。',
    stop: '候補銘柄-7%以上、または指数に明確に劣後した場合はP1復帰見送り。',
    link: 'p1_event_gate_remaining_20260615.html',
  },
  {
    date: '2026-06-18以降',
    step: '購入前バリデーション',
    status: '未入力',
    input: 'イベント後ゲート、本人別NISA口座、注文口座区分、NISA残枠、証券会社画面',
    decision: '全ゲートが揃った場合のみ、候補復帰と資金配分の検討へ進む。',
    stop: '未入力、本人操作未確認、NISA口座区分不明、証券会社画面未確認なら買付上限0円。',
    link: 'p1_segment_next_gate_input_validator_20260615.html',
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

function updateNav(file) {
  if (!fs.existsSync(file)) return;
  let html = fs.readFileSync(file, 'utf8');
  if (html.includes(htmlFile)) return;
  const link = `<a href="${htmlFile}">6月イベント運用表</a>`;
  html = html.replace('</nav>', `  ${link}\n</nav>`);
  fs.writeFileSync(file, html, 'utf8');
}

writeCsv(csvFile, [
  ['作成時刻', '日付', '工程', '状態', '入力するもの', '判定', '停止条件', '確認リンク'],
  ...rows.map((row) => [generatedAt, row.date, row.step, row.status, row.input, row.decision, row.stop, row.link]),
]);

const tableRows = rows.map((row) => `<tr>
  <td class="date">${h(row.date)}</td>
  <td>${h(row.step)}</td>
  <td class="${row.status === '完了' ? 'ok' : 'bad'}">${h(row.status)}</td>
  <td>${h(row.input)}</td>
  <td>${h(row.decision)}</td>
  <td class="stop">${h(row.stop)}</td>
  <td><a href="${h(row.link)}">開く</a></td>
</tr>`).join('');

const html = `<!doctype html>
<html lang="ja">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>6月イベント運用表</title>
  <style>
    :root{--ink:#061827;--navy:#103b60;--blue:#0b67a3;--line:#c9dceb;--bg:#f4f8fb;--paper:#fff;--red:#b42318;--warn:#9a5b00;--green:#116b4f}
    *{box-sizing:border-box}
    body{margin:0;background:var(--bg);color:var(--ink);font-family:-apple-system,BlinkMacSystemFont,"Segoe UI","Noto Sans JP",Meiryo,sans-serif;font-size:19px;line-height:1.75}
    header{background:linear-gradient(135deg,#103b60,#0b67a3);color:#fff;padding:30px}
    header h1{margin:0 0 8px;font-size:clamp(32px,4vw,44px);line-height:1.2;letter-spacing:0}
    header p{margin:0;font-weight:800;max-width:1180px}
    main{max-width:1280px;margin:0 auto;padding:22px}
    section{background:var(--paper);border:1px solid var(--line);border-radius:12px;padding:20px;margin:0 0 18px;box-shadow:0 8px 20px rgba(20,60,90,.08);break-inside:avoid}
    h2{margin:0 0 12px;border-left:8px solid var(--blue);padding-left:12px;color:var(--navy);font-size:27px}
    .notice{border:2px solid var(--red);background:#fff1f1;color:#8a0000;border-radius:10px;padding:14px 16px;font-weight:900;margin:0}
    .cards{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:12px}
    .card{border:1px solid var(--line);border-radius:10px;background:#fbfdff;padding:14px}
    .card b{display:block;color:var(--navy);font-size:16px}
    .card strong{display:block;font-size:30px;line-height:1.25;color:var(--blue)}
    .card span{font-weight:800;color:#263e55}
    .table-wrap{overflow-x:auto;border:1px solid var(--line);border-radius:10px;margin-top:10px}
    table{width:100%;border-collapse:collapse;background:#fff;table-layout:auto}
    th,td{border:1px solid var(--line);padding:11px 12px;vertical-align:top;overflow-wrap:anywhere;word-break:normal}
    th{background:#e7f2fb;color:#06395f;text-align:left;font-weight:900}
    .date{font-weight:900;color:var(--navy);white-space:nowrap}
    .ok{color:var(--green);font-weight:900}
    .bad,.stop{color:var(--red);font-weight:900}
    .links{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:10px}
    .links a{display:block;text-decoration:none;background:#0b67a3;color:#fff;border-radius:9px;padding:12px 14px;font-weight:900;text-align:center}
    a{color:#005f99;font-weight:900}
    @media(max-width:900px){main{padding:12px}.cards,.links{grid-template-columns:1fr}body{font-size:17px}}
    @media print{body{background:#fff}header,section{break-inside:avoid;box-shadow:none}.table-wrap{overflow:visible}th,td{font-size:12px;padding:7px 8px}}
  </style>
</head>
<body>
<header>
  <h1>6月イベント運用表</h1>
  <p>日銀・FOMC後に、何を入力し、どの条件で止めるかを一枚で確認する実用画面です。</p>
</header>
<main>
  <section>
    <h2>現在の扱い</h2>
    <div class="cards">
      <div class="card"><b>購入判断</b><strong>不可</strong><span>イベント後データ未完了</span></div>
      <div class="card"><b>P1復帰</b><strong>0社</strong><span>候補復帰はまだしない</span></div>
      <div class="card"><b>買付上限</b><strong>0円</strong><span>注文票に進めない</span></div>
      <div class="card"><b>次の節目</b><strong>6/16以降</strong><span>日銀・FOMC後に更新</span></div>
    </div>
  </section>
  <section>
    <p class="notice">この表は売買指示ではありません。未発表の結果を推測で埋めず、発表後の実データを入力してから再判定します。</p>
  </section>
  <section>
    <h2>日程と判定</h2>
    <div class="table-wrap">
      <table>
        <thead><tr><th>日付</th><th>工程</th><th>状態</th><th>入力するもの</th><th>判定</th><th>停止条件</th><th>確認</th></tr></thead>
        <tbody>${tableRows}</tbody>
      </table>
    </div>
  </section>
  <section>
    <h2>主要リンク</h2>
    <div class="links">
      <a href="event_pre_baseline_20260615.html">イベント前基準値</a>
      <a href="event_post_reaction_workbench_20260615.html">イベント後反応ワークベンチ</a>
      <a href="p1_event_gate_remaining_20260615.html">イベント後ゲート残項目</a>
      <a href="p1_segment_next_gate_input_validator_20260615.html">P1入力バリデーター</a>
      <a href="p1_segment_next_gate_input_queue_20260615.html">P1入力キュー</a>
      <a href="102_june_event_result_input.csv">6月イベント入力CSV</a>
    </div>
  </section>
</main>
</body>
</html>`;

fs.writeFileSync(htmlFile, html, 'utf8');

for (const file of ['index.html', 'latest_practical_start_20260614.html', 'daily_practical_compact_board_20260614.html']) {
  updateNav(file);
}

console.log(JSON.stringify({
  htmlFile,
  csvFile,
  rows: rows.length,
  buyLimit: '0円',
  generatedAt,
}, null, 2));
